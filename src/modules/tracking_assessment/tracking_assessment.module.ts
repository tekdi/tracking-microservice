import { Module } from '@nestjs/common';
import { TrackingAssessmentService } from './tracking_assessment.service';
import { TrackingAssessmentController } from './tracking_assessment.controller';
import { AssessmentTracking } from 'src/modules/tracking_assessment/entities/tracking-assessment-entity';
import { AssessmentTrackingScoreDetail } from 'src/modules/tracking_assessment/entities/tracking-assessment-score-details-entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerService } from 'src/common/logger/logger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssessmentTracking,
      AssessmentTrackingScoreDetail,
    ]),
  ],
  controllers: [TrackingAssessmentController],
  providers: [TrackingAssessmentService, LoggerService],
})
export class TrackingAssessmentModule {}
