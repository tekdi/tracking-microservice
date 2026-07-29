import { CacheService } from './cache.service';
import { MemoryCacheStore } from './memory-cache.store';
import { CacheStore } from './cache-store.interface';

function fakeConfigService(overrides: Record<string, any> = {}) {
  const defaults: Record<string, any> = {
    CACHE_ENABLED: 'true',
    CACHE_PROVIDER: 'memory',
    CACHE_KEY_PREFIX: 'tms',
    CACHE_DISABLED_NAMESPACES: '',
    CACHE_OP_TIMEOUT_MS: 150,
    CACHE_CB_FAILURES: 3,
    CACHE_CB_COOLDOWN_MS: 30000,
    CACHE_METRICS_INTERVAL_MS: 3600000,
    ...overrides,
  };
  return { get: (key: string) => defaults[key] } as any;
}

class AlwaysFailingStore implements CacheStore {
  async get(): Promise<string | null> {
    throw new Error('redis is down');
  }
  async set(): Promise<void> {
    throw new Error('redis is down');
  }
  async incr(): Promise<number> {
    throw new Error('redis is down');
  }
  isHealthy(): boolean {
    return false;
  }
}

describe('CacheService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('miss: calls the loader and caches the result on the first read', async () => {
    const store = new MemoryCacheStore();
    const service = new CacheService(fakeConfigService(), store);
    const loader = jest.fn().mockResolvedValue({ value: 'fresh' });

    const result = await service.getOrLoad({
      namespace: 'content:t1',
      key: 'search:abc',
      ttlSeconds: 60,
      loader,
    });

    expect(result).toEqual({ value: 'fresh' });
    expect(loader).toHaveBeenCalledTimes(1);
    service.onModuleDestroy();
  });

  it('hit: a second read for the same key does not call the loader again', async () => {
    const store = new MemoryCacheStore();
    const service = new CacheService(fakeConfigService(), store);
    const loader = jest.fn().mockResolvedValue({ value: 'fresh' });

    await service.getOrLoad({
      namespace: 'content:t1',
      key: 'search:abc',
      ttlSeconds: 60,
      loader,
    });
    const second = await service.getOrLoad({
      namespace: 'content:t1',
      key: 'search:abc',
      ttlSeconds: 60,
      loader,
    });

    expect(second).toEqual({ value: 'fresh' });
    expect(loader).toHaveBeenCalledTimes(1);
    service.onModuleDestroy();
  });

  it('write-then-fresh: invalidate() forces the next read to reload', async () => {
    const store = new MemoryCacheStore();
    const service = new CacheService(fakeConfigService(), store);
    const loader = jest
      .fn()
      .mockResolvedValueOnce({ value: 'v1' })
      .mockResolvedValueOnce({ value: 'v2' });

    const first = await service.getOrLoad({
      namespace: 'content:t1',
      key: 'search:abc',
      ttlSeconds: 60,
      loader,
    });
    expect(first).toEqual({ value: 'v1' });

    await service.invalidate('content:t1', 'testWrite');

    const second = await service.getOrLoad({
      namespace: 'content:t1',
      key: 'search:abc',
      ttlSeconds: 60,
      loader,
    });

    expect(second).toEqual({ value: 'v2' });
    expect(loader).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
  });

  it('invalidate only affects the bumped namespace, not others', async () => {
    const store = new MemoryCacheStore();
    const service = new CacheService(fakeConfigService(), store);
    const contentLoader = jest
      .fn()
      .mockResolvedValueOnce({ value: 'content-v1' })
      .mockResolvedValueOnce({ value: 'content-v2' });
    const courseLoader = jest.fn().mockResolvedValue({ value: 'course-v1' });

    await service.getOrLoad({
      namespace: 'content:t1',
      key: 'search:abc',
      ttlSeconds: 60,
      loader: contentLoader,
    });
    await service.getOrLoad({
      namespace: 'course:t1',
      key: 'status:abc',
      ttlSeconds: 60,
      loader: courseLoader,
    });

    await service.invalidate('content:t1', 'testWrite');

    await service.getOrLoad({
      namespace: 'content:t1',
      key: 'search:abc',
      ttlSeconds: 60,
      loader: contentLoader,
    });
    await service.getOrLoad({
      namespace: 'course:t1',
      key: 'status:abc',
      ttlSeconds: 60,
      loader: courseLoader,
    });

    expect(contentLoader).toHaveBeenCalledTimes(2);
    expect(courseLoader).toHaveBeenCalledTimes(1);
    service.onModuleDestroy();
  });

  it('redis-down: a failing store passes through to the loader without throwing', async () => {
    const store = new AlwaysFailingStore();
    const service = new CacheService(fakeConfigService(), store);
    const loader = jest.fn().mockResolvedValue({ value: 'from-db' });

    const result = await service.getOrLoad({
      namespace: 'content:t1',
      key: 'search:abc',
      ttlSeconds: 60,
      loader,
    });

    expect(result).toEqual({ value: 'from-db' });
    expect(loader).toHaveBeenCalledTimes(1);
    service.onModuleDestroy();
  });

  it('circuit breaker opens after CACHE_CB_FAILURES consecutive failures and bypasses the store', async () => {
    const store = new AlwaysFailingStore();
    const getSpy = jest.spyOn(store, 'get');
    const service = new CacheService(
      fakeConfigService({ CACHE_CB_FAILURES: 2 }),
      store,
    );
    const loader = jest.fn().mockResolvedValue({ value: 'from-db' });

    await service.getOrLoad({ namespace: 'content:t1', key: 'k1', ttlSeconds: 60, loader });
    await service.getOrLoad({ namespace: 'content:t1', key: 'k1', ttlSeconds: 60, loader });
    expect(getSpy).toHaveBeenCalledTimes(2);

    // Circuit is now open - the store should not be touched on the next call.
    await service.getOrLoad({ namespace: 'content:t1', key: 'k1', ttlSeconds: 60, loader });
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(loader).toHaveBeenCalledTimes(3);
    service.onModuleDestroy();
  });

  it('CACHE_ENABLED=false bypasses the store entirely and always calls the loader', async () => {
    const store = new MemoryCacheStore();
    const getSpy = jest.spyOn(store, 'get');
    const service = new CacheService(
      fakeConfigService({ CACHE_ENABLED: 'false' }),
      store,
    );
    const loader = jest.fn().mockResolvedValue({ value: 'from-db' });

    await service.getOrLoad({ namespace: 'content:t1', key: 'k1', ttlSeconds: 60, loader });
    await service.getOrLoad({ namespace: 'content:t1', key: 'k1', ttlSeconds: 60, loader });

    expect(getSpy).not.toHaveBeenCalled();
    expect(loader).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
  });

  it('does not cache null, false, or empty-array results (no negative caching)', async () => {
    const store = new MemoryCacheStore();
    const service = new CacheService(fakeConfigService(), store);

    const nullLoader = jest.fn().mockResolvedValue(null);
    await service.getOrLoad({ namespace: 'assessmentread:x', key: 'core:t1', ttlSeconds: 60, loader: nullLoader });
    await service.getOrLoad({ namespace: 'assessmentread:x', key: 'core:t1', ttlSeconds: 60, loader: nullLoader });
    expect(nullLoader).toHaveBeenCalledTimes(2);

    const emptyArrayLoader = jest.fn().mockResolvedValue([]);
    await service.getOrLoad({ namespace: 'content:t1', key: 'search:x', ttlSeconds: 60, loader: emptyArrayLoader });
    await service.getOrLoad({ namespace: 'content:t1', key: 'search:x', ttlSeconds: 60, loader: emptyArrayLoader });
    expect(emptyArrayLoader).toHaveBeenCalledTimes(2);

    service.onModuleDestroy();
  });

  it('CACHE_DISABLED_NAMESPACES bypasses only the matching family', async () => {
    const store = new MemoryCacheStore();
    const service = new CacheService(
      fakeConfigService({ CACHE_DISABLED_NAMESPACES: 'course' }),
      store,
    );
    const courseLoader = jest.fn().mockResolvedValue({ value: 'course' });
    const contentLoader = jest.fn().mockResolvedValue({ value: 'content' });

    await service.getOrLoad({ namespace: 'course:t1', key: 'k1', ttlSeconds: 60, loader: courseLoader });
    await service.getOrLoad({ namespace: 'course:t1', key: 'k1', ttlSeconds: 60, loader: courseLoader });
    expect(courseLoader).toHaveBeenCalledTimes(2);

    await service.getOrLoad({ namespace: 'content:t1', key: 'k1', ttlSeconds: 60, loader: contentLoader });
    await service.getOrLoad({ namespace: 'content:t1', key: 'k1', ttlSeconds: 60, loader: contentLoader });
    expect(contentLoader).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();
  });
});
