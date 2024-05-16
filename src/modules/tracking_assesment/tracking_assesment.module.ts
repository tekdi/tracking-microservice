import { Module } from '@nestjs/common';
import { TrackingAssesmentService } from './tracking_assesment.service';
import { TrackingAssesmentController } from './tracking_assesment.controller';

@Module({
  controllers: [TrackingAssesmentController],
  providers: [TrackingAssesmentService],
})
export class TrackingAssesmentModule {}
