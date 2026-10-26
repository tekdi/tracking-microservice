import { Injectable } from '@nestjs/common';
import { CacheStore } from './cache-store.interface';

interface Entry {
  value: string;
  expiresAt: number | null;
}

@Injectable()
export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, Entry>();

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const next = (current ? parseInt(current, 10) : 0) + 1;
    await this.set(key, String(next));
    return next;
  }

  isHealthy(): boolean {
    return true;
  }
}
