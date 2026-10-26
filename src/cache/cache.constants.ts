export const CACHE_STORE = 'CACHE_STORE';

export interface CacheConfig {
  enabled: boolean;
  provider: 'memory' | 'redis';
  redisUrl?: string;
  keyPrefix: string;
  disabledNamespaces: string[];
  opTimeoutMs: number;
  cbFailures: number;
  cbCooldownMs: number;
}

export function loadCacheConfig(get: (key: string) => any): CacheConfig {
  const disabledNamespacesRaw: string = get('CACHE_DISABLED_NAMESPACES') || '';
  return {
    enabled: String(get('CACHE_ENABLED') ?? 'false').toLowerCase() === 'true',
    provider: (get('CACHE_PROVIDER') || 'memory') as 'memory' | 'redis',
    redisUrl: get('REDIS_URL'),
    keyPrefix: get('CACHE_KEY_PREFIX') || 'tms',
    disabledNamespaces: disabledNamespacesRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    opTimeoutMs: Number(get('CACHE_OP_TIMEOUT_MS') ?? 150),
    cbFailures: Number(get('CACHE_CB_FAILURES') ?? 5),
    cbCooldownMs: Number(get('CACHE_CB_COOLDOWN_MS') ?? 30000),
  };
}
