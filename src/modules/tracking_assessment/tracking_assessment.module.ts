import { Module } from '@nestjs/common';
import { TrackingAssessmentService } from './tracking_assessment.service';
import { TrackingAssessmentController } from './tracking_assessment.controller';
import { AssessmentTracking } from 'src/modules/tracking_assessment/entities/tracking-assessment-entity';
import { AssessmentTrackingScoreDetail } from 'src/modules/tracking_assessment/entities/tracking-assessment-score-details-entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerService } from 'src/common/logger/logger.service';
import { KafkaModule } from "src/kafka/kafka.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssessmentTracking,
      AssessmentTrackingScoreDetail,
    ]),
    KafkaModule,
  ],
  controllers: [TrackingAssessmentController],
  providers: [TrackingAssessmentService, LoggerService],
})
export class TrackingAssessmentModule {}
