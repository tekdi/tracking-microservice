import {
  BadRequestException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { IsUUID, isUUID } from 'class-validator';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { LoggerService } from 'src/common/logger/logger.service';
import { KafkaService } from 'src/kafka/kafka.service';
import { AnswerSheetSubmissions } from './entities/answer-sheet-submissions-entity';
import { AnswerSheetSubmissionsCreateDto } from './dto/answer-sheet-submissions-create-dto';
import axios from 'axios';

type TrackerInsertObject = {
  questionSetId: string;
  userId: string;
  fileUrls: string[];
  status: 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  metadata: Record<string, any>;
  created_at: Date;
  resultsHistory: ResultHistoryItem[];
};
type ResultHistoryItem = {
  date: string;
  result: string;
  userId: string;
};

@Injectable()
export class AnswerSheetSubmissionsService {
  private ttl;
  constructor(
    @InjectRepository(AnswerSheetSubmissions)
    private answerSheetSubmissionsRepository: Repository<AnswerSheetSubmissions>,
    private configService: ConfigService,
    private loggerService: LoggerService,
  ) {}

  public async getAnswerSheetSubmissionDetails(
    request: any,
    answerSheetSubmissionId: string,
    response: Response,
  ) {
    const apiId = 'api.get.answerSheetSubmissionId';
    try {
      const result: any = await this.findAnswerSheetSubmission(
        answerSheetSubmissionId,
      );
      delete result.metadata;
      if (!result) {
        this.loggerService.error(
          'No data found.',
          'NOT_FOUND',
          apiId,
          answerSheetSubmissionId,
        );
        return APIResponse.error(
          response,
          apiId,
          'No data found.',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }
      this.loggerService.log(
        'Answer Sheet Submission data fetch successfully.',
        apiId,
        answerSheetSubmissionId,
      );
      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        'Answer Sheet Submission data fetch successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        'Something went wrong in Answer Sheet Submission creation',
        errorMessage,
        apiId,
        answerSheetSubmissionId,
      );
      return APIResponse.error(
        response,
        apiId,
        'Something went wrong in Answer Sheet Submission creation',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async findAnswerSheetSubmission(answerSheetSubmissionId: string) {
    const result = await this.answerSheetSubmissionsRepository.findOne({
      where: {
        id: answerSheetSubmissionId,
      },
    });
    if (result) {
      return result;
    }
    return false;
  }

  public async createAnswerSheetSubmission(
    request: any,
    createAnswerSheetSubmissionDto: AnswerSheetSubmissionsCreateDto,
    response: Response,
  ) {
    const apiId = 'api.create.answerSheetSubmission';
    try {
      const existing = await this.answerSheetSubmissionsRepository.findOne({
        where: { questionSetId: createAnswerSheetSubmissionDto.questionSetId },
      });

      if (existing) {
        this.loggerService.error(
          'Answer Sheet Submission with this Question Set Id already exists.',
          'CONFLICT',
          apiId,
          createAnswerSheetSubmissionDto.questionSetId,
        );
        return APIResponse.error(
          response,
          apiId,
          'Answer Sheet Submission with this question_set_id already exists.',
          'CONFLICT',
          HttpStatus.CONFLICT,
        );
      }

      const insertObject = this.transformToInsertObject(
        createAnswerSheetSubmissionDto,
      );
      const result =
        await this.answerSheetSubmissionsRepository.save(insertObject);
      delete result.metadata;
      delete result.resultsHistory;
      delete result.created_at;
      //call external API send result.id as identifier

      await this.answerSheetSubmissionsRepository.update(result.id, {
        status: 'PROCESSING',
      });

      if (result) {
        this.loggerService.log(
          'Answer Sheet Submission created successfully.',
          apiId,
          result.id,
        );
      }
      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        'Answer Sheet Submission created successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        'Something went wrong in Answer Sheet Submission creation',
        errorMessage,
        apiId,
        createAnswerSheetSubmissionDto.questionSetId,
      );
      return APIResponse.error(
        response,
        apiId,
        'Something went wrong in Answer Sheet Submission creation',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public transformToInsertObject(
    input: AnswerSheetSubmissionsCreateDto,
    assessmentMode: 'ONLINE' | 'OFFLINE' = 'OFFLINE',
  ): TrackerInsertObject {
    return {
      questionSetId: input.questionSetId,
      userId: input.userId,
      fileUrls: input.fileUrls,
      status: 'RECEIVED',
      metadata: input.metadata,
      resultsHistory: input.resultsHistory,
      created_at: new Date(),
    };
  }

  public async updateStatusByQuestionSetId(
    Id: string,
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED',
    response: Response,
  ) {
    const apiId = 'api.update.answerSheetSubmissionStatus';
    try {
      const record = await this.answerSheetSubmissionsRepository.findOne({
        where: { id: Id },
      });

      if (!record) {
        this.loggerService.error(
          'No Answer Sheet Submission found for the given Question Set Id.',
          'NOT_FOUND',
          apiId,
          Id,
        );
        return APIResponse.error(
          response,
          apiId,
          'No Answer Sheet Submission found for the given Question Set Id.',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }

      record.status = status;
      await this.answerSheetSubmissionsRepository.save(record);
      delete record.metadata;
      delete record.resultsHistory;

      this.loggerService.log(
        'Answer Sheet Submission status updated successfully.',
        apiId,
        record.id,
      );
      return APIResponse.success(
        response,
        apiId,
        record,
        HttpStatus.OK,
        'Answer Sheet Submission status updated successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        'Something went wrong while updating Answer Sheet Submission status',
        errorMessage,
        apiId,
        Id,
      );
      return APIResponse.error(
        response,
        apiId,
        'Something went wrong while updating Answer Sheet Submission status',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
