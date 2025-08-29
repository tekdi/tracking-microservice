import { Module } from '@nestjs/common';
import { AnswerSheetSubmissionsService } from './answer_sheet_submissions.service';
import { AnswerSheetSubmissionsController } from './answer_sheet_submissions.controller';
import { AnswerSheetSubmissions } from './entities/answer-sheet-submissions-entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerService } from 'src/common/logger/logger.service';
import { KafkaModule } from 'src/kafka/kafka.module';

@Module({
  imports: [TypeOrmModule.forFeature([AnswerSheetSubmissions]), KafkaModule],
  controllers: [AnswerSheetSubmissionsController],
  providers: [AnswerSheetSubmissionsService, LoggerService],
})
export class AnswerSheetSubmissionsModule {} 


