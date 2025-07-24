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
import { AiAssessment } from 'src/modules/ai_assessment/entities/ai-assessment-entity';
import { AiAssessmentCreateDto } from './dto/ai-assessment-create-dto';
import axios from 'axios';

type TrackerInsertObject = {
  question_set_id: string;
  assessment_mode: 'ONLINE' | 'OFFLINE';
  status: 'INITIATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  response_message: string | null;
  metadata: Record<string, any>;
  token?: string;
};

type ExternalApiRequestObject = {
  questionSetId: string;
  framework?: string;
  channel?: string;
  difficulty_level?: string;
  question_types?: string[];
  metadata: Record<string, any>;
  questionsDetails: any[];
  content: any[];
  createdBy: string;
  tenantId?: string;
  token?: string;
};

@Injectable()
export class AiAssessmentService {
  private ttl;
  constructor(
    @InjectRepository(AiAssessment)
    private aiAssessmentRepository: Repository<AiAssessment>,
    private configService: ConfigService,
    private loggerService: LoggerService,
    private readonly dataSource: DataSource,
  ) {
    this.ttl = this.configService.get('TTL');
  }

  public async getAiAssessmentDetails(
    request: any,
    aiAssessmentId: string,
    response: Response,
  ) {
    const apiId = 'api.get.aiAssessmentId';
    try {
      const result: any = await this.findAiAssessment(aiAssessmentId);
      delete result.metadata;
      if (!result) {
        this.loggerService.error(
          'No data found.',
          'NOT_FOUND',
          apiId,
          aiAssessmentId,
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
        'AI Assessment data fetch successfully.',
        apiId,
        aiAssessmentId,
      );
      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        'AI Assessment data fetch successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        'Something went wrong in AI assessment creation',
        errorMessage,
        apiId,
        aiAssessmentId,
      );
      return APIResponse.error(
        response,
        apiId,
        'Something went wrong in AI assessment creation',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  public async findAiAssessment(aiAssessmentId: string) {
    const result = await this.aiAssessmentRepository.findOne({
      where: {
        question_set_id: aiAssessmentId,
      },
    });
    if (result) {
      return result;
    }
    return false;
  }
  public async createAiAssessment(
    request: any,
    createAiAssessmentDto: AiAssessmentCreateDto,
    response: Response,
  ) {
    const apiId = 'api.create.aiAssessment';
    try {
      console.log('createAiAssessmentDto', createAiAssessmentDto);
      // Check if record exists for question_set_id
      const existing = await this.aiAssessmentRepository.findOne({
        where: { question_set_id: createAiAssessmentDto.questionSetId },
      });
      if (existing) {
        this.loggerService.error(
          'AI Assessment with this Question Set Id   already exists.',
          'CONFLICT',
          apiId,
          createAiAssessmentDto.questionSetId,
        );
        return APIResponse.error(
          response,
          apiId,
          'AI Assessment with this question_set_id already exists.',
          'CONFLICT',
          HttpStatus.CONFLICT,
        );
      }
      const insertObject = this.transformToInsertObject(createAiAssessmentDto);
      console.log('insertObject', insertObject);
      const result = await this.aiAssessmentRepository.save(insertObject);

      // Call external AI API
      const externalApiObject = this.transformToExternalApiObject(
        createAiAssessmentDto,
      );
      const generatedQuestionResponse =
        await this.callExternalAiApi(externalApiObject);
      this.loggerService.log(
        'External AI API called successfully.',
        apiId,
        result.id,
      );

      // Update database with external API response data
      await this.aiAssessmentRepository.update(result.id, {
        status: 'PROCESSING',
        response_message: generatedQuestionResponse.message,
        metadata: {
          ...result.metadata,
          externalApiResponse: {
            request_id: generatedQuestionResponse.request_id,
            question_set_id: generatedQuestionResponse.question_set_id,
            status: generatedQuestionResponse.status,
            message: generatedQuestionResponse.message,
          },
        },
      });

      // Fetch updated result to include external API response
      const updatedResult = await this.aiAssessmentRepository.findOne({
        where: { id: result.id },
      });

      if (updatedResult) {
        this.loggerService.log(
          'AI Assessment created successfully.',
          apiId,
          updatedResult.id,
        );
      }
      return APIResponse.success(
        response,
        apiId,
        {
          ...updatedResult,
          externalApiResponse: {
            request_id: generatedQuestionResponse.request_id,
            question_set_id: generatedQuestionResponse.question_set_id,
            status: generatedQuestionResponse.status,
            message: generatedQuestionResponse.message,
          },
        },
        HttpStatus.OK,
        'AI Assessment created successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        'Something went wrong in AI assessment creation',
        errorMessage,
        apiId,
        createAiAssessmentDto.questionSetId,
      );
      return APIResponse.error(
        response,
        apiId,
        'Something went wrong in AI assessment creation',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public transformToInsertObject(
    input: AiAssessmentCreateDto,
    assessmentMode: 'ONLINE' | 'OFFLINE' = 'OFFLINE',
  ): TrackerInsertObject {
    return {
      question_set_id: input.questionSetId,
      assessment_mode: assessmentMode,
      status: 'INITIATED',
      response_message: null,
      metadata: {
        ...input.metadata,
        questionsDetails: input.questionsDetails,
        content: input.content,
        createdBy: input.createdBy,
      },
    };
  }

  public transformToExternalApiObject(
    input: AiAssessmentCreateDto,
  ): ExternalApiRequestObject {
    return {
      questionSetId: input.questionSetId,
      framework: input.framework,
      channel: input.channel,
      difficulty_level: input.difficulty_level,
      question_types: input.question_types,
      metadata: input.metadata,
      questionsDetails: input.questionsDetails,
      content: input.content,
      createdBy: input.createdBy,
      tenantId: input.tenantId,
      token: input.token,
    };
  }

  public async updateStatusByQuestionSetId(
    questionSetId: string,
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED',
    responseMessage,
    response: Response,
  ) {
    const apiId = 'api.update.aiAssessmentStatus';
    try {
      const record = await this.aiAssessmentRepository.findOne({
        where: { question_set_id: questionSetId },
      });
      if (!record) {
        this.loggerService.error(
          'No AI Assessment found for the given Question Set Id.',
          'NOT_FOUND',
          apiId,
          questionSetId,
        );
        return APIResponse.error(
          response,
          apiId,
          'No AI Assessment found for the given Question Set Id.',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }
      record.status = status;
      record.response_message = responseMessage || null;
      await this.aiAssessmentRepository.save(record);
      delete record.metadata;
      this.loggerService.log(
        'AI Assessment status updated successfully.',
        apiId,
        record.id,
      );
      return APIResponse.success(
        response,
        apiId,
        record,
        HttpStatus.OK,
        'AI Assessment status updated successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        'Something went wrong while updating AI assessment status',
        errorMessage,
        apiId,
        questionSetId,
      );
      return APIResponse.error(
        response,
        apiId,
        'Something went wrong while updating AI assessment status',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async searchAiAssessment(
    request: any,
    searchFilter: any,
    response: Response,
  ) {
    try {
      const conditions = [];
      const params = [];

      // Dynamically build WHERE clause from provided filters
      if (searchFilter?.id) {
        conditions.push(`"id" = $${params.length + 1}`);
        params.push(searchFilter.id);
      }

      if (searchFilter?.question_set_id?.length) {
        conditions.push(`"question_set_id" = ANY($${params.length + 1})`);
        params.push(searchFilter.question_set_id); // array of question_set_ids
      }

      if (searchFilter?.assessment_mode) {
        conditions.push(`"assessment_mode" = $${params.length + 1}`);
        params.push(searchFilter.assessment_mode);
      }

      if (searchFilter?.status) {
        conditions.push(`"status" = $${params.length + 1}`);
        params.push(searchFilter.status);
      }

      // Build final SQL query
      const whereClause = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      const result = await this.dataSource.query(
        `SELECT * FROM assessment_generate_tracker ${whereClause} ORDER BY "created_at" DESC`,
        params,
      );

      return response.status(200).send({
        success: true,
        message: 'success',
        data: result,
      });
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        errorMessage,
        errorMessage,
        'searchAiAssessment',
      );
      return response.status(500).send({
        success: false,
        message: errorMessage,
        data: {},
      });
    }
  }

  /**
   * Call external AI API to process the assessment
   */
  private async callExternalAiApi(
    insertObject: ExternalApiRequestObject,
  ): Promise<any> {
    console.log('insertObject', insertObject);
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
        `${apiUrl}/request-questions`,
        insertObject,
        { headers },
      );

      this.loggerService.log(
        'External AI API response received',
        'callExternalAiApi',
        insertObject.questionSetId,
      );
      console.log('response.data', response);
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
  /**
   * Call external AI API - webhook for question set update
   */
  async updateQuestionSet(questionSetDoId, response: Response): Promise<any> {
    const apiUrl = this.configService.get<string>('AI_API_BASE_URL');
    //check assessmnet is created by AI ?
    const record = await this.aiAssessmentRepository.findOne({
      where: { question_set_id: questionSetDoId },
    });
    if (!record) {
      this.loggerService.error(
        'No AI Assessment found for the given Question Set Id for updating questionset mode',
        'NOT_FOUND',
        'api.update.questionSet',
        questionSetDoId,
      );
      return APIResponse.error(
        response,
        'api.update.questionSet',
        'No AI Assessment found for the given Question Set Id for updating questionset mode',
        'NOT_FOUND',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!apiUrl) {
      throw new Error('AI_API_BASE_URL environment variable is not configured');
    }
    // Need to Add security token
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + this.configService.get<string>('TOKEN'),
    };

    const payload = { questionSetId: questionSetDoId };
    try {
      const result = await axios.post(
        `${apiUrl}/update-questionset/`,
        payload,
        {
          headers,
        },
      );

      this.loggerService.log(
        'External AI API response received',
        'callExternalAiApi',
        questionSetDoId,
      );
      //update assessment mode by checking qtype
      const qTypes = await this.fetchQTypes(questionSetDoId);
      if (qTypes.length > 0) {
        let assessment_mode; // Default to ONLINE
        if (qTypes.includes('SA')) {
          assessment_mode = 'OFFLINE';
        } else {
          assessment_mode = 'ONLINE';
        }
        try {
          if (record.assessment_mode !== assessment_mode) {
            // Update if they are different
            console.log('Assessment modes are different');
            record.assessment_mode = assessment_mode;
            await this.aiAssessmentRepository.save(record);
          }
          this.loggerService.log(
            'AI Assessment status updated successfully.',
            'api.update.questionSet',
            record.id,
          );
          return APIResponse.success(
            response,
            'api.update.questionSet',
            record,
            HttpStatus.OK,
            'AI Assessment status updated successfully.',
          );
        } catch (e) {
          const errorMessage = e.message || 'Internal Server Error';
          this.loggerService.error(
            'Something went wrong while updating AI assessment status',
            errorMessage,
            'api.update.questionSet',
            questionSetDoId,
          );
          return APIResponse.error(
            response,
            'api.update.questionSet',
            'Something went wrong while updating AI assessment status',
            errorMessage,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      return APIResponse.success(
        response,
        'api.update.questionSet',
        result.data,
        HttpStatus.OK,
        'AI Assessment status updated successfully.',
      );
    } catch (error) {
      this.loggerService.error(
        'External AI API call failed',
        error.response?.data?.message || error.message,
        'callExternalAiApi',
        questionSetDoId,
      );
      throw new Error(
        `External AI API call failed: ${error.response?.data?.message || error.message}`,
      );
    }
  }
  async fetchQTypes(questionSetId: string): Promise<string[]> {
    const apiUrl =
      this.configService.get<string>('MIDDLEWARE_SERVICE_BASE_URL') +
      '/action/questionset/v2/hierarchy/' +
      questionSetId +
      '?mode=edit';
    try {
      const response = await axios.get(apiUrl, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      const questionset = response.data?.result?.questionset;
      const qTypes = this.extractQTypes(questionset?.children || []);
      return qTypes;
    } catch (error) {
      console.error('Error fetching question set:', error.message);
      throw error;
    }
  }

  private extractQTypes(
    nodes: any[],
    qTypes: Set<string> = new Set(),
  ): string[] {
    for (const node of nodes) {
      if (node.objectType === 'Question' && node.qType) {
        qTypes.add(node.qType);
      }

      if (Array.isArray(node.children)) {
        this.extractQTypes(node.children, qTypes);
      }
    }
    return Array.from(qTypes);
  }
}
