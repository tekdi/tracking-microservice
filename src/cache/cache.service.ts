import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_STORE, CacheConfig, loadCacheConfig } from './cache.constants';
import { CacheStore } from './cache-store.interface';

interface GetOrLoadArgs<T> {
  namespace: string;
  key: string;
  ttlSeconds: number;
  loader: () => Promise<T>;
}

export interface FamilyMetrics {
  hit: number;
  miss: number;
  error: number;
  bypass: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger('CacheService');
  private readonly config: CacheConfig;
  private readonly metrics = new Map<string, FamilyMetrics>();

  private cbFailureCount = 0;
  private cbOpenUntil = 0;

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_STORE) private readonly store: CacheStore,
  ) {
    this.config = loadCacheConfig((k) => this.configService.get(k));
  }

  async getOrLoad<T>({
    namespace,
    key,
    ttlSeconds,
    loader,
  }: GetOrLoadArgs<T>): Promise<T> {
    if (!this.config.enabled) {
      return loader();
    }
    if (this.isNamespaceDisabled(namespace)) {
      this.record(namespace, 'bypass');
      return loader();
    }
    if (this.isCircuitOpen()) {
      this.record(namespace, 'bypass');
      return loader();
    }

    let entryKey: string | null = null;
    let version: number | null = null;
    let cached: string | null = null;
    try {
      version = await this.withTimeout(this.getVersion(namespace));
      entryKey = this.entryKey(namespace, version, key);
      cached = await this.withTimeout(this.store.get(entryKey));
      this.onOpSuccess();
    } catch (err: any) {
      this.onOpFailure();
      this.record(namespace, 'error');
      this.logger.debug(
        `cache ERROR ns=${namespace} key=${key} msg=${err.message}`,
      );
      return loader();
    }

    if (cached !== null && cached !== undefined) {
      try {
        const parsed = JSON.parse(cached) as T;
        this.record(namespace, 'hit');
        this.logger.debug(`cache HIT ns=${namespace} key=${key}`);
        return parsed;
      } catch {
        // Corrupt entry - fall through and treat as a miss.
      }
    }

    this.record(namespace, 'miss');
    this.logger.debug(`cache MISS ns=${namespace} key=${key}`);
    const result = await loader();
    if (entryKey && this.isCacheable(result)) {
      this.writeCacheEntry(namespace, key, entryKey, ttlSeconds, result);
    }
    return result;
  }

  async invalidate(
    namespace: string | string[],
    caller = 'unknown',
  ): Promise<void> {
    const namespaces = Array.isArray(namespace) ? namespace : [namespace];
    await Promise.all(namespaces.map((ns) => this.invalidateOne(ns, caller)));
  }

  isCacheable(value: unknown): boolean {
    if (value === null || value === undefined || value === false) {
      return false;
    }
    if (Array.isArray(value) && value.length === 0) {
      return false;
    }
    return true;
  }

  getHealthInfo() {
    const counters: Record<string, FamilyMetrics> = {};
    for (const [family, m] of this.metrics.entries()) {
      counters[family] = { ...m };
    }
    return {
      enabled: this.config.enabled,
      provider: this.config.provider,
      redis:
        this.config.provider === 'redis'
          ? this.store.isHealthy()
            ? 'up'
            : 'down'
          : 'n/a',
      circuitOpen: this.circuitOpenStatus(),
      disabledNamespaces: this.config.disabledNamespaces,
      counters,
    };
  }

  private async invalidateOne(namespace: string, caller: string): Promise<void> {
    try {
      const v = await this.withTimeout(this.store.incr(this.versionKey(namespace)));
      this.onOpSuccess();
      this.logger.debug(`cache INCR ns=${namespace} v=${v} caller=${caller}`);
    } catch (err: any) {
      this.onOpFailure();
      this.logger.error(
        `cache INCR failed ns=${namespace} caller=${caller}: ${err.message}`,
      );
    }
  }

  private writeCacheEntry(
    namespace: string,
    key: string,
    entryKey: string,
    ttlSeconds: number,
    result: unknown,
  ) {
    this.withTimeout(
      this.store.set(entryKey, JSON.stringify(result), ttlSeconds),
    )
      .then(() => {
        this.onOpSuccess();
        this.logger.debug(`cache SET ns=${namespace} key=${key}`);
      })
      .catch((err) => {
        this.onOpFailure();
        this.logger.error(
          `cache ERROR ns=${namespace} key=${key} msg=${err.message}`,
        );
      });
  }

  private async getVersion(namespace: string): Promise<number> {
    const raw = await this.store.get(this.versionKey(namespace));
    const v = raw ? parseInt(raw, 10) : NaN;
    // A missing counter is treated as version 0, not 1: real INCR on a missing
    // key also lands on 1, so defaulting reads to 1 here would make the first
    // invalidate() after any read a no-op (same version before and after).
    return Number.isFinite(v) && v >= 0 ? v : 0;
  }

  private versionKey(namespace: string): string {
    return `${this.config.keyPrefix}:v:${namespace}`;
  }

  private entryKey(namespace: string, version: number, key: string): string {
    return `${this.config.keyPrefix}:${namespace}:v${version}:${key}`;
  }

  private isNamespaceDisabled(namespace: string): boolean {
    if (this.config.disabledNamespaces.length === 0) {
      return false;
    }
    const family = namespace.split(':')[0];
    return this.config.disabledNamespaces.some(
      (d) => d === namespace || d === family,
    );
  }

  private isCircuitOpen(): boolean {
    if (this.cbOpenUntil === 0) {
      return false;
    }
    if (Date.now() >= this.cbOpenUntil) {
      this.cbOpenUntil = 0;
      this.cbFailureCount = 0;
      return false;
    }
    return true;
  }

  private circuitOpenStatus(): boolean {
    return this.cbOpenUntil !== 0 && Date.now() < this.cbOpenUntil;
  }

  private onOpFailure() {
    this.cbFailureCount++;
    if (this.cbFailureCount >= this.config.cbFailures) {
      this.cbOpenUntil = Date.now() + this.config.cbCooldownMs;
    }
  }

  private onOpSuccess() {
    this.cbFailureCount = 0;
  }

  private withTimeout<T>(p: Promise<T>): Promise<T> {
    const timeoutMs = this.config.opTimeoutMs;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`cache op timeout after ${timeoutMs}ms`)),
        timeoutMs,
      );
      p.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }

  private record(namespace: string, kind: keyof FamilyMetrics) {
    const family = namespace.split(':')[0];
    const m = this.metrics.get(family) || {
      hit: 0,
      miss: 0,
      error: 0,
      bypass: 0,
    };
    m[kind]++;
    this.metrics.set(family, m);
  }
}
