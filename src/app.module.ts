import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database/database.module';
import { CacheModule } from '@nestjs/cache-manager';
import { MemoryStore } from 'cache-manager-memory-store';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackingAssessmentModule } from 'src/modules/tracking_assessment/tracking_assessment.module';
import { TrackingContentModule } from 'src/modules/tracking_content/tracking_content.module';

@Module({
  imports: [
    TrackingAssessmentModule,
    TrackingContentModule,
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CacheModule.register({ isGlobal: true, store: MemoryStore }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
