import { Module } from '@nestjs/common';
import { AiAssessmentService } from './ai_assessment.service';
import { AiAssessmentController } from './ai_assessment.controller';
import { AiAssessment } from 'src/modules/ai_assessment/entities/ai-assessment-entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerService } from 'src/common/logger/logger.service';
import { KafkaModule } from 'src/kafka/kafka.module';

@Module({
  imports: [TypeOrmModule.forFeature([AiAssessment]), KafkaModule],
  controllers: [AiAssessmentController],
  providers: [AiAssessmentService, LoggerService],
})
export class AiAssessmentModule {}
