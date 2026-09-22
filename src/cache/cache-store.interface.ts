export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  incr(key: string): Promise<number>;
  isHealthy(): boolean;
  onModuleDestroy?(): Promise<void> | void;
}
