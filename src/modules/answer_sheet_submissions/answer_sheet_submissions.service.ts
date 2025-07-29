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
import { SubmitAssessmentToAiDto } from '../ai_assessment/dto/submit_assessment_to_ai.dto';

type TrackerInsertObject = {
  questionSetId: string;
  userId: string;
  fileUrls: string[];
  status: 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  metadata: Record<string, any>;
  created_at: Date;
  resultsHistory: ResultHistoryItem[];
  identifier?: string;
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
    private dataSource: DataSource,
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
        'Something went wrong while fetching Answer Sheet Submission details',
        errorMessage,
        apiId,
        answerSheetSubmissionId,
      );
      return APIResponse.error(
        response,
        apiId,
        'Something went wrong while fetching Answer Sheet Submission details',
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
        where: {
          questionSetId: createAnswerSheetSubmissionDto.questionSetId,
          userId: createAnswerSheetSubmissionDto.userId,
        },
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
      let payload: SubmitAssessmentToAiDto = {
        questionSetId: result.questionSetId,
        userId: result.userId,
        fileUrls: createAnswerSheetSubmissionDto.fileUrls,
        identifier: result.id,
      };

      //call external API send result.id as identifier
      // Call external AI API
      // internal and external API objcet are same

      this.loggerService.log('request for API: ', apiId);
      const generatedAssessmentResponse =
        await this.callExternalAiApiForEvaluation(payload);
      this.loggerService.log(
        'External AI API called successfully.',
        apiId,
        result.id,
      );

      if (result) {
        this.loggerService.log(
          'Answer Sheet submitted successfully.',
          apiId,
          result.id,
        );
      }
      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        'Answer Sheet submitted successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        'Something went wrong in Answer Sheet Submission',
        errorMessage,
        apiId,
        createAnswerSheetSubmissionDto.questionSetId,
      );
      return APIResponse.error(
        response,
        apiId,
        'Something went wrong in Answer Sheet Submission',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  public transformToInsertObject(
    input: AnswerSheetSubmissionsCreateDto,
    assessmentMode: 'ONLINE' | 'OFFLINE' = 'OFFLINE',
  ): TrackerInsertObject {
    let fileUrls = input.fileUrls.map((url) => {
      const urlObj = new URL(url);
      return urlObj.pathname.slice(1); // removes the leading '/'
    });
    return {
      questionSetId: input.questionSetId,
      userId: input.userId,
      fileUrls: fileUrls,
      status: 'RECEIVED',
      metadata: input.metadata,
      resultsHistory: input.resultsHistory,
      created_at: new Date(),
    };
  }
  private async callExternalAiApiForEvaluation(
    insertObject: SubmitAssessmentToAiDto,
  ): Promise<any> {
    const apiUrl = this.configService.get<string>('AI_API_BASE_URL');
    if (!apiUrl) {
      throw new Error('AI_API_BASE_URL environment variable is not configured');
    }

    // Need to Add security token
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + this.configService.get<string>('TOKEN'),
    };

    try {
      const response = await axios.post(
        `${apiUrl}/answer-sheet-submission/`,
        insertObject,
        { headers },
      );

      this.loggerService.log(
        'External AI API response received',
        'callExternalAiApi',
        insertObject.questionSetId,
      );
      console.log('response.data', response.data);
      return response.data;
    } catch (error) {
      this.loggerService.error(
        'External AI API call failed',
        error.response?.data?.message || error.message,
        'callExternalAiApi',
        insertObject.questionSetId,
      );
      throw new Error(
        `External AI API call failed: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  public async updateStatusByQuestionSetId(
    Id: string,
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED',
    responseMessage,
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
      record.response_message = responseMessage;
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
  public async searchAnswerSheetSubmissions(
    request: any,
    searchFilter: any,
    response: Response,
  ) {
    try {
      const conditions = [];
      const params = [];

      if (searchFilter?.id) {
        conditions.push(`"id" = $${params.length + 1}`);
        params.push(searchFilter.id);
      }

      if (searchFilter?.userId?.length) {
        conditions.push(`"user_id" = ANY($${params.length + 1})`);
        params.push(searchFilter.userId); // This should be an array
      }

      if (searchFilter?.questionSetId) {
        conditions.push(`"question_set_id" = $${params.length + 1}`);
        params.push(searchFilter.questionSetId);
      }

      if (searchFilter?.status) {
        conditions.push(`"status" = $${params.length + 1}`);
        params.push(searchFilter.status);
      }

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      const result = await this.dataSource.query(
        `SELECT * FROM answersheet_submissions ${whereClause} ORDER BY "created_at" DESC`,
        params,
      );

      return response.status(200).send({
        success: true,
        message: 'success',
        data: result,
      });
    } catch (error) {
      const errorMessage = error.message || 'Internal Server Error';
      return response.status(500).send({
        success: false,
        message: errorMessage,
        data: [],
      });
    }
  }
}
