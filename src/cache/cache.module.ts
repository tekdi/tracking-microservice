import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_STORE, loadCacheConfig } from './cache.constants';
import { MemoryCacheStore } from './memory-cache.store';
import { RedisCacheStore } from './redis-cache.store';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [
    {
      provide: CACHE_STORE,
      useFactory: (configService: ConfigService) => {
        const config = loadCacheConfig((k) => configService.get(k));
        if (config.provider === 'redis') {
          if (!config.redisUrl) {
            throw new Error(
              'REDIS_URL is required when CACHE_PROVIDER=redis',
            );
          }
          return new RedisCacheStore(config.redisUrl);
        }
        return new MemoryCacheStore();
      },
      inject: [ConfigService],
    },
    CacheService,
  ],
  exports: [CacheService],
})
export class CacheModule {}
