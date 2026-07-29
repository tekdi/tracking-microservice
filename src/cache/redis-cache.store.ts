import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { CacheStore } from './cache-store.interface';

@Injectable()
export class RedisCacheStore implements CacheStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheStore.name);
  private readonly client: RedisClientType;
  private connected = false;

  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl });
    this.client.on('error', (err) => {
      this.connected = false;
      this.logger.error(`Redis connection error: ${err.message}`);
    });
    this.client.on('ready', () => {
      this.connected = true;
    });
    this.client.on('end', () => {
      this.connected = false;
    });
    // Fire-and-forget connect; individual ops still guard against a not-yet-connected client.
    this.client.connect().catch((err) => {
      this.connected = false;
      this.logger.error(`Redis initial connection failed: ${err.message}`);
    });
  }

  private ensureConnected() {
    if (!this.connected || !this.client.isOpen) {
      throw new Error('Redis client not connected');
    }
  }

  async get(key: string): Promise<string | null> {
    this.ensureConnected();
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.ensureConnected();
    if (ttlSeconds) {
      await this.client.set(key, value, { EX: ttlSeconds });
    } else {
      await this.client.set(key, value);
    }
  }

  async incr(key: string): Promise<number> {
    this.ensureConnected();
    return this.client.incr(key);
  }

  isHealthy(): boolean {
    return this.connected && this.client.isOpen;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}
