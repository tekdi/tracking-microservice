import { Module } from '@nestjs/common';
import { TrackingAssessmentService } from './tracking_assessment.service';
import { TrackingAssessmentController } from './tracking_assessment.controller';
import { AssessmentTracking } from 'src/modules/tracking_assessment/entities/tracking-assessment-entity';
import { AssessmentTrackingScoreDetail } from 'src/modules/tracking_assessment/entities/tracking-assessment-score-details-entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerService } from 'src/common/logger/logger.service';
import { KafkaModule } from 'src/kafka/kafka.module';
import { AiAssessment } from '../ai_assessment/entities/ai-assessment-entity';
import { AnswerSheetSubmissions } from '../answer_sheet_submissions/entities/answer-sheet-submissions-entity';
import { AnswerSheetSubmissionsModule } from '../answer_sheet_submissions/answer_sheet_submissions.module';
import { AnswerSheetSubmissionsService } from '../answer_sheet_submissions/answer_sheet_submissions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssessmentTracking,
      AssessmentTrackingScoreDetail,
      AiAssessment,
      AnswerSheetSubmissions,
    ]),
    KafkaModule,
    AnswerSheetSubmissionsModule,
  ],
  controllers: [TrackingAssessmentController],
  providers: [TrackingAssessmentService, LoggerService,AnswerSheetSubmissionsService],
})
export class TrackingAssessmentModule {}
