import { Module } from '@nestjs/common';
import { TrackingContentService } from './tracking_content.service';
import { TrackingContentController } from './tracking_content.controller';
import { ContentTracking } from 'src/modules/tracking_content/entities/tracking-content-entity';
import { ContentTrackingDetail } from 'src/modules/tracking_content/entities/tracking-content-details-entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentTracking,
      ContentTrackingDetail,
    ]),
  ],
  controllers: [TrackingContentController],
  providers: [TrackingContentService],
})
export class TrackingContentModule {}
