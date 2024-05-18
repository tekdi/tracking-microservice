import { Module } from '@nestjs/common';
import { TrackingAssesmentService } from './tracking_assesment.service';
import { TrackingAssesmentController } from './tracking_assesment.controller';
import { AssessmentTracking } from "./entities/tracking-assessment-entity";
import { TypeOrmModule } from '@nestjs/typeorm';


@Module({
  imports: [
    TypeOrmModule.forFeature([AssessmentTracking]),
  ],
  controllers: [TrackingAssesmentController],
  providers: [TrackingAssesmentService],
})
export class TrackingAssesmentModule {}
