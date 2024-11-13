import { Module } from '@nestjs/common';
import { TrackingContentService } from './tracking_content.service';
import { TrackingContentController } from './tracking_content.controller';
import { ContentTracking } from 'src/modules/tracking_content/entities/tracking-content-entity';
import { ContentTrackingDetail } from 'src/modules/tracking_content/entities/tracking-content-details-entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerService } from 'src/common/logger/logger.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContentTracking, ContentTrackingDetail])],
  controllers: [TrackingContentController],
  providers: [TrackingContentService, LoggerService],
})
export class TrackingContentModule {}
