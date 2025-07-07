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
      console.log("createAiAssessmentDto",createAiAssessmentDto)
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
      console.log("insertObject",insertObject);
      const result = await this.aiAssessmentRepository.save(insertObject);
      
      // Call external AI API
      const externalApiObject = this.transformToExternalApiObject(createAiAssessmentDto);
      const generatedQuestionResponse = await this.callExternalAiApi(externalApiObject);
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
            message: generatedQuestionResponse.message
          }
        }
      });

      // Fetch updated result to include external API response
      const updatedResult = await this.aiAssessmentRepository.findOne({
        where: { id: result.id }
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
            message: generatedQuestionResponse.message
          }
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
  // //for testing only
  // async updateQuestionSetHierarchy(doId: string, token): Promise<any> {
  //   const url =
  //     'https://qa-interface.prathamdigital.org/interface/v1/action/questionset/v2/hierarchy/update';

  //   const headers = {
  //     Accept: 'application/json, text/plain, */*',
  //     'Content-Type': 'application/json',
  //     'X-Channel-Id': 'pos-channel',
  //     'X-Request-Id': 'dcf4f9e4-a956-485f-8c2a-d5b19a93a32e',
  //     tenantid: '6c8b810a-66c2-4f0d-8c0c-c025415a4414',
  //     Authorization: `Bearer ${token}`, //  Replace this with valid token
  //   };

  //   const body = {
  //     request: {
  //       data: {
  //         nodesModified: {
  //           [doId]: {
  //             root: true,
  //             objectType: 'QuestionSet',
  //             metadata: {
  //               appIcon: '',
  //               name: 'QuestionSet 1',
  //               program: ['Open School'],
  //               subject: ['Job Readiness'],
  //               targetAgeGroup: ['18 yrs +'],
  //               primaryUser: ['Learners/Children'],
  //               showTimer: false,
  //               requiresSubmit: 'No',
  //               author: 'sanket patil',
  //               primaryCategory: 'Practice Question Set',
  //               attributions: [],
  //               timeLimits: {
  //                 questionSet: { max: 0, min: 0 },
  //               },
  //               description: 'QuestionSet 1',
  //               domain: 'Learning for Work',
  //               subDomain: ['New Age Skills'],
  //               contentLanguage: 'English',
  //               assessmentType: 'Post Test',
  //               outcomeDeclaration: {
  //                 maxScore: {
  //                   cardinality: 'single',
  //                   type: 'integer',
  //                   defaultValue: 0,
  //                 },
  //               },
  //             },
  //             isNew: false,
  //           },
  //           '12c4bc48-dc45-4e3c-b155-f22721b73296': {
  //             root: false,
  //             objectType: 'QuestionSet',
  //             metadata: {
  //               mimeType: 'application/vnd.sunbird.questionset',
  //               code: '12c4bc48-dc45-4e3c-b155-f22721b73296',
  //               name: 'Section 1',
  //               visibility: 'Parent',
  //               primaryCategory: 'Practice Question Set',
  //               shuffle: true,
  //               showFeedback: false,
  //               showSolutions: false,
  //               attributions: [],
  //               timeLimits: {
  //                 questionSet: { max: 0, min: 0 },
  //               },
  //               description: 'section 1',
  //             },
  //             isNew: true,
  //           },
  //         },
  //         hierarchy: {
  //           [doId]: {
  //             name: 'QuestionSet 1',
  //             children: ['12c4bc48-dc45-4e3c-b155-f22721b73296'],
  //             root: true,
  //           },
  //           '12c4bc48-dc45-4e3c-b155-f22721b73296': {
  //             name: 'Section 1',
  //             children: [],
  //             root: false,
  //           },
  //         },
  //         lastUpdatedBy: '82470f1e-0154-48d2-aa2c-407b42b3c83f',
  //       },
  //     },
  //   };

  //   try {
  //     const response = await axios.patch(url, body, { headers });
  //     return response.data;
  //   } catch (error) {
  //     console.error(
  //       'Error updating hierarchy:',
  //       error.response?.data || error.message,
  //     );
  //     throw error;
  //   }
  // }
  // //for testing only
  // async updateQuestionSetWithQuestion(
  //   rootDoId: string,
  //   sectionDoId: string,
  //   token,
  // ) {
  //   const url =
  //     'https://qa-interface.prathamdigital.org/interface/v1/action/questionset/v2/hierarchy/update';

  //   const headers = {
  //     Accept: 'application/json, text/plain, */*',
  //     'Content-Type': 'application/json',
  //     'X-Channel-Id': 'pos-channel',
  //     'X-Request-Id': 'c06e0789-b764-4ab7-98c2-7e0a4e67de7e',
  //     tenantid: '6c8b810a-66c2-4f0d-8c0c-c025415a4414',
  //     Authorization: `Bearer ${token}`, //  Replace this with valid token
  //   };

  //   const body = {
  //     request: {
  //       data: {
  //         nodesModified: {
  //           '47ef9f98-e4b0-4c62-b3ac-9edbb170e64f': {
  //             metadata: {
  //               mimeType: 'application/vnd.sunbird.question',
  //               media: [],
  //               editorState: {
  //                 options: [
  //                   {
  //                     answer: true,
  //                     value: { body: '<p>Front end developer</p>', value: 0 },
  //                   },
  //                   {
  //                     answer: false,
  //                     value: { body: '<p>Backend Developer</p>', value: 1 },
  //                   },
  //                   {
  //                     answer: false,
  //                     value: { body: '<p>DB Designer</p>', value: 2 },
  //                   },
  //                   {
  //                     answer: false,
  //                     value: { body: '<p>Cloud engineer&nbsp;</p>', value: 3 },
  //                   },
  //                 ],
  //                 question:
  //                   '<p>AI generated Question — &nbsp;UI developer is refereed as -------------- .&nbsp;</p>',
  //               },
  //               templateId: 'mcq-vertical',
  //               answer:
  //                 "<div class='answer-container'><div class='answer-body'><p>Front end developer</p></div></div>",
  //               maxScore: 1,
  //               name: 'Question 1',
  //               responseDeclaration: {
  //                 response1: {
  //                   cardinality: 'single',
  //                   type: 'integer',
  //                   correctResponse: { value: 0 },
  //                   mapping: [{ value: 0, score: 1 }],
  //                 },
  //               },
  //               outcomeDeclaration: {
  //                 maxScore: {
  //                   cardinality: 'single',
  //                   type: 'integer',
  //                   defaultValue: 1,
  //                 },
  //                 hint: {
  //                   cardinality: 'single',
  //                   type: 'string',
  //                   defaultValue: 'f685949d-5757-47d4-aee2-23e708af84f2',
  //                 },
  //               },
  //               interactionTypes: ['choice'],
  //               interactions: {
  //                 response1: {
  //                   type: 'choice',
  //                   options: [
  //                     {
  //                       label: '<p>Front end developer</p>',
  //                       value: 0,
  //                       hint: '',
  //                     },
  //                     { label: '<p>Backend Developer</p>', value: 1, hint: '' },
  //                     { label: '<p>DB Designer</p>', value: 2, hint: '' },
  //                     {
  //                       label: '<p>Cloud engineer&nbsp;</p>',
  //                       value: 3,
  //                       hint: '',
  //                     },
  //                   ],
  //                   validation: { required: 'Yes' },
  //                 },
  //               },
  //               hints: {},
  //               qType: 'MCQ',
  //               primaryCategory: 'Multiple Choice Question',
  //               body: "<div class='question-body' tabindex='-1'><div class='mcq-title' tabindex='0'><p>AI generated Question — &nbsp;UI developer is refereed as -------------- .&nbsp;</p></div><div data-choice-interaction='response1' class='mcq-vertical'></div></div>",
  //               solutions: {},
  //               createdBy: '82470f1e-0154-48d2-aa2c-407b42b3c83f',
  //               subject: ['Job Readiness'],
  //               domain: 'Learning for Work',
  //               subDomain: ['New Age Skills'],
  //               program: ['Open School'],
  //               author: 'sanket patil',
  //               channel: 'pos-channel',
  //               framework: 'pos-framework',
  //               license: 'CC BY 4.0',
  //               visibility: 'Default',
  //             },
  //             objectType: 'Question',
  //             root: false,
  //             isNew: true,
  //           },
  //         },
  //         hierarchy: {
  //           [rootDoId]: {
  //             name: 'QuestionSet 1',
  //             children: [sectionDoId],
  //             root: true,
  //           },
  //           [sectionDoId]: {
  //             name: 'Section 1',
  //             children: ['47ef9f98-e4b0-4c62-b3ac-9edbb170e64f'],
  //             root: false,
  //           },
  //         },
  //       },
  //     },
  //   };

  //   try {
  //     const response = await axios.patch(url, body, { headers });
  //     return response.data;
  //   } catch (error) {
  //     console.error(
  //       'Failed to update QuestionSet with question:',
  //       error.response?.data || error.message,
  //     );
  //     throw error;
  //   }
  // }

  /**
   * Call external AI API to process the assessment
   */
  private async callExternalAiApi(
    insertObject: ExternalApiRequestObject,
  ): Promise<any> {
    console.log("insertObject",insertObject);
    const apiUrl = this.configService.get<string>('AI_API_BASE_URL');
    if (!apiUrl) {
      throw new Error('AI_API_BASE_URL environment variable is not configured');
    }
    
    // Need to Add security token
    const headers = {
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios.post(
        `${apiUrl}/request-questions/`,
        insertObject,
        { headers }
      );

      this.loggerService.log(
        'External AI API response received',
        'callExternalAiApi',
        insertObject.questionSetId
      );
      console.log("response.data",response);
      return response.data;
    } catch (error) {
      this.loggerService.error(
        'External AI API call failed',
        error.response?.data?.message || error.message,
        'callExternalAiApi',
        insertObject.questionSetId
      );
      throw new Error(
        `External AI API call failed: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Call external AI API to process the assessment
   */
}

