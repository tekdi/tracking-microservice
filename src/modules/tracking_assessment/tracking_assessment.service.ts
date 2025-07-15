import {
  BadRequestException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AssessmentTracking } from 'src/modules/tracking_assessment/entities/tracking-assessment-entity';
import { AssessmentTrackingScoreDetail } from 'src/modules/tracking_assessment/entities/tracking-assessment-score-details-entity';
import { Repository } from 'typeorm';
import { CreateAssessmentTrackingDto } from './dto/tracking-assessment-create-dto';
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { SearchAssessmentTrackingDto } from './dto/tracking-assessment-search-dto';
import { IsUUID, isUUID } from 'class-validator';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { LoggerService } from 'src/common/logger/logger.service';
import { KafkaService } from 'src/kafka/kafka.service';
import { AiAssessment } from '../ai_assessment/entities/ai-assessment-entity';
import { AnswerSheetSubmissions } from 'src/modules/answer_sheet_submissions/entities/answer-sheet-submissions-entity';
import { In, Not } from 'typeorm';

@Injectable()
export class TrackingAssessmentService {
  private ttl;
  constructor(
    @InjectRepository(AssessmentTracking)
    private assessmentTrackingRepository: Repository<AssessmentTracking>,
    @InjectRepository(AssessmentTrackingScoreDetail)
    private assessmentTrackingScoreDetailRepository: Repository<AssessmentTrackingScoreDetail>,
    @InjectRepository(AiAssessment)
    private aiAssessmentRepository: Repository<AiAssessment>,
    @InjectRepository(AnswerSheetSubmissions)
    private answersheetSubmissionRepository: Repository<AnswerSheetSubmissions>,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
    private dataSource: DataSource,
    private loggerService: LoggerService,
    private readonly kafkaService: KafkaService,
  ) {
    this.ttl = this.configService.get('TTL');
  }

  public async getAssessmentTrackingDetails(
    request: any,
    assessmentTrackingId: string,
    response: Response,
  ) {
    const apiId = 'api.get.assessmentTrackingId';
    if (!isUUID(assessmentTrackingId)) {
      this.loggerService.error(
        'Please Enter Valid UUID',
        'BAD_REQUEST',
        apiId,
        assessmentTrackingId,
      );
      return APIResponse.error(
        response,
        apiId,
        'Please Enter Valid UUID',
        'BAD_REQUEST',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const ttl = this.ttl;
      const cachedData: any = await this.cacheService.get(assessmentTrackingId);
      if (cachedData) {
        this.loggerService.log(
          'Assessment data fetch successfully.',
          apiId,
          assessmentTrackingId,
        );
        return APIResponse.success(
          response,
          apiId,
          cachedData,
          HttpStatus.OK,
          'Assessment data fetch successfully.',
        );
      }
      const result = await this.findAssessment(assessmentTrackingId);
      if (!result) {
        this.loggerService.error(
          'No data found.',
          'NOT_FOUND',
          apiId,
          assessmentTrackingId,
        );
        return APIResponse.error(
          response,
          apiId,
          'No data found.',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }
      await this.cacheService.set(assessmentTrackingId, result, ttl);
      this.loggerService.log(
        'Assessment data fetch successfully.',
        apiId,
        assessmentTrackingId,
      );
      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        'Assessment data fetch successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        'Something went wrong in assessment creation',
        errorMessage,
        apiId,
        assessmentTrackingId,
      );
      return APIResponse.error(
        response,
        apiId,
        'Something went wrong in assessment creation',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async findAssessment(assessmentTrackingId) {
    const result = await this.assessmentTrackingRepository.findOne({
      where: {
        assessmentTrackingId: assessmentTrackingId,
      },
    });
    if (result) {
      return result;
    }
    return false;
  }
  public async createAssessmentTracking(
    request: any,
    createAssessmentTrackingDto: CreateAssessmentTrackingDto,
    response: Response,
  ) {
    const apiId = 'api.create.assessment';
    try {
      const allowedKeys = [
        'assessmentTrackingId',
        'userId',
        'courseId',
        'contentId',
        'attemptId',
        'createdOn',
        'lastAttemptedOn',
        'assessmentSummary',
        'totalMaxScore',
        'totalScore',
        'timeSpent',
        'unitId',
        'submitedBy',
      ];
      const errors = await this.validateCreateDTO(
        allowedKeys,
        createAssessmentTrackingDto,
      );

      if (errors.length > 0) {
        this.loggerService.error(
          `Invalid Key ${errors.join(', ')}`,
          JSON.stringify('Invalid Key.'),
          apiId,
          createAssessmentTrackingDto.userId,
        );
        return APIResponse.error(
          response,
          apiId,
          `Invalid Key ${errors.join(', ')}`,
          JSON.stringify('Invalid Key.'),
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!isUUID(createAssessmentTrackingDto.userId)) {
        this.loggerService.error(
          'Please entire valid UUID.',
          'BAD_REQUEST',
          apiId,
          createAssessmentTrackingDto.userId,
        );
        return APIResponse.error(
          response,
          apiId,
          'Please entire valid UUID.',
          JSON.stringify('Please entire valid UUID.'),
          HttpStatus.BAD_REQUEST,
        );
      }
      // for offline support
      //----------------------------------------------------------------------
      //check submitedBy
      if (
        !createAssessmentTrackingDto.submitedBy ||
        createAssessmentTrackingDto.submitedBy === ''
      ) {
        createAssessmentTrackingDto.submitedBy = 'Online';
      } else {
        const allowedValues = ['AI Evaluator', 'Online', 'Manual'];
        if (!allowedValues.includes(createAssessmentTrackingDto.submitedBy)) {
          createAssessmentTrackingDto.submitedBy = 'Online';
        }
      }
      //Check in the table answersheet_submissions fetch record
      //if exists then put show flag as false
      const existingAIAssessment = await this.aiAssessmentRepository.findOne({
        where: {
          question_set_id: createAssessmentTrackingDto.contentId,
        },
      });
      //showFlag is for AI assessment show to the learner
      if (existingAIAssessment) {
        if (createAssessmentTrackingDto.submitedBy == 'Manual')
          createAssessmentTrackingDto.showFlag = true;
        else createAssessmentTrackingDto.showFlag = false;
      } else {
        createAssessmentTrackingDto.showFlag = true;
      }
      //--------------------------------------------------------------------------//
      const result = await this.assessmentTrackingRepository.save(
        createAssessmentTrackingDto,
      );
      //save score details
      try {
        let testId = result.assessmentTrackingId;
        let score_detail = createAssessmentTrackingDto.assessmentSummary;
        let scoreObj = [];
        for (let i = 0; i < score_detail.length; i++) {
          let section: any = score_detail[i];
          let itemData = section?.data;
          if (itemData) {
            for (let j = 0; j < itemData.length; j++) {
              let dataItem = itemData[j];
              scoreObj.push({
                userId: createAssessmentTrackingDto.userId,
                assessmentTrackingId: testId,
                questionId: dataItem?.item?.id,
                pass: dataItem?.pass,
                sectionId: dataItem?.item?.sectionId,
                resValue: dataItem?.resvalues
                  ? JSON.stringify(dataItem.resvalues)
                  : '',
                duration: dataItem?.duration,
                score: dataItem?.score,
                maxScore: dataItem?.item?.maxscore,
                queTitle: dataItem?.item?.title,
                feedback: dataItem?.resvalues[0]?.AI_suggestion,
              });
            }
          }
        }
        //insert multiple items
        const result_score =
          await this.assessmentTrackingScoreDetailRepository.save(scoreObj);
      } catch (e) {
        //Error in CreateScoreDetail!
        console.log(e);
      }
      this.loggerService.log(
        'Assessment submitted successfully.',
        apiId,
        createAssessmentTrackingDto.userId,
      );

      this.publishTrackingEvent('created', result.assessmentTrackingId, apiId);

      return APIResponse.success(
        response,
        apiId,
        { assessmentTrackingId: result.assessmentTrackingId },
        HttpStatus.CREATED,
        'Assessment submitted successfully.',
      );
    } catch (e) {
      this.loggerService.error(
        'Failed to fetch assessment data.',
        'INTERNAL_SERVER_ERROR',
        apiId,
        createAssessmentTrackingDto.userId,
      );
      const errorMessage = e.message || 'Internal Server Error';
      return APIResponse.error(
        response,
        apiId,
        'Failed to fetch assessment data.',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async searchAssessmentTrackingold(
    request: any,
    searchFilter: any,
    response: Response,
  ) {
    try {
      let output_result = [];
      const result = await this.dataSource.query(
        `SELECT "assessmentTrackingId","userId","courseId","contentId","attemptId","createdOn","lastAttemptedOn","totalMaxScore","totalScore","updatedOn","timeSpent","unitId" FROM assessment_tracking WHERE "userId"=$1 and "contentId"=$2 and "courseId"=$3 and "unitId"=$4`,
        [
          searchFilter?.userId,
          searchFilter?.contentId,
          searchFilter?.courseId,
          searchFilter?.unitId,
        ],
      );
      for (let i = 0; i < result.length; i++) {
        const result_score = await this.dataSource.query(
          `SELECT "questionId","pass","sectionId","resValue","duration","score","maxScore","queTitle" FROM assessment_tracking_score_detail WHERE "assessmentTrackingId"=$1 `,
          [result[i].assessmentTrackingId],
        );
        let temp_result = result[i];
        temp_result.score_details = result_score;
        output_result.push(temp_result);
      }
      this.loggerService.log('success', 'searchAssessmentTracking');
      return response.status(200).send({
        success: true,
        message: 'success',
        data: output_result,
      });
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        errorMessage,
        errorMessage,
        'searchAssessmentTracking',
      );
      return response.status(500).send({
        success: false,
        message: errorMessage,
        data: {},
      });
    }
  }
  public async searchAssessmentTracking(
    request: any,
    searchFilter: any,
    response: Response,
  ) {
    try {
      let output_result = [];

      // Dynamically build WHERE clause and params
      const conditions = [];
      const params = [];

      if (searchFilter?.userId) {
        conditions.push(`"userId" = $${params.length + 1}`);
        params.push(searchFilter.userId);
      }

      if (searchFilter?.contentId) {
        conditions.push(`"contentId" = $${params.length + 1}`);
        params.push(searchFilter.contentId);
      }

      if (searchFilter?.courseId) {
        conditions.push(`"courseId" = $${params.length + 1}`);
        params.push(searchFilter.courseId);
      }

      if (searchFilter?.unitId) {
        conditions.push(`"unitId" = $${params.length + 1}`);
        params.push(searchFilter.unitId);
      }
      // Always add condition to exclude showFlag = false
      conditions.push(`"showFlag" IS DISTINCT FROM false`);

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await this.dataSource.query(
        `SELECT "assessmentTrackingId", "userId", "courseId", "contentId", "attemptId", "createdOn", "lastAttemptedOn", "totalMaxScore", "totalScore", "updatedOn", "timeSpent", "unitId"
         FROM assessment_tracking ${whereClause}`,
        params,
      );

      for (const tracking of result) {
        const result_score = await this.dataSource.query(
          `SELECT "questionId", "pass", "sectionId", "resValue", "duration", "score", "maxScore", "queTitle"
           FROM assessment_tracking_score_detail WHERE "assessmentTrackingId" = $1`,
          [tracking.assessmentTrackingId],
        );

        tracking.score_details = result_score;
        output_result.push(tracking);
      }

      this.loggerService.log('success', 'searchAssessmentTracking');
      return response.status(200).send({
        success: true,
        message: 'success',
        data: output_result,
      });
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        errorMessage,
        errorMessage,
        'searchAssessmentTracking',
      );
      return response.status(500).send({
        success: false,
        message: errorMessage,
        data: {},
      });
    }
  }

  public async searchStatusAssessmentTracking(
    request: any,
    searchFilter: any,
    response: Response,
  ) {
    try {
      let output_result = [];
      let contentIdArray = searchFilter?.contentId;
      let contentId_text = '';
      for (let i = 0; i < contentIdArray.length; i++) {
        let contentId = contentIdArray[i];
        if (i == 0) {
          contentId_text = `${contentId_text}'${contentId}'`;
        } else {
          contentId_text = `${contentId_text},'${contentId}'`;
        }
      }
      //courseId
      let courseIdArray = searchFilter?.courseId;
      let courseId_text = '';
      for (let i = 0; i < courseIdArray.length; i++) {
        let courseId = courseIdArray[i];
        if (i == 0) {
          courseId_text = `${courseId_text}'${courseId}'`;
        } else {
          courseId_text = `${courseId_text},'${courseId}'`;
        }
      }
      //unitId
      let unitIdArray = searchFilter?.unitId;
      let unitId_text = '';
      for (let i = 0; i < unitIdArray.length; i++) {
        let unitId = unitIdArray[i];
        if (i == 0) {
          unitId_text = `${unitId_text}'${unitId}'`;
        } else {
          unitId_text = `${unitId_text},'${unitId}'`;
        }
      }
      let userIdArray = searchFilter?.userId;
      for (let i = 0; i < userIdArray.length; i++) {
        let userId = userIdArray[i];
        const result = await this.dataSource.query(
          `WITH latest_assessment AS (
              SELECT 
                  "assessmentTrackingId",
                  "userId",
                  "courseId",
                  "contentId",
                  "attemptId",
                  "createdOn",
                  "lastAttemptedOn",
                  "totalMaxScore",
                  "totalScore",
                  "updatedOn",
                  "timeSpent",
                  "unitId",
                  ROW_NUMBER() OVER (PARTITION BY "userId", "courseId", "unitId", "contentId" ORDER BY "createdOn" DESC) as row_num
              FROM 
                  assessment_tracking
              WHERE 
                  "userId" = $1 
                  AND "courseId" IN (${courseId_text}) 
                  AND "unitId" IN (${unitId_text}) 
                  AND "contentId" IN (${contentId_text}) 
          )
          SELECT 
              "assessmentTrackingId",
              "userId",
              "courseId",
              "contentId",
              "attemptId",
              "createdOn",
              "lastAttemptedOn",
              "totalMaxScore",
              "totalScore",
              "updatedOn",
              "timeSpent",
              "unitId"
          FROM 
              latest_assessment
          WHERE 
              row_num = 1;`,
          [userId],
        );
        for (let j = 0; j < result.length; j++) {
          let temp_result = result[j];
          let maxMark = temp_result?.totalMaxScore;
          let scoreMark = temp_result?.totalScore;
          let percentage = (scoreMark / maxMark) * 100;
          const roundedPercentage = parseFloat(percentage.toFixed(2)); // Rounds to 2 decimal places
          temp_result.percentage = roundedPercentage;
          result[j] = temp_result;
        }
        let percentage = 0;
        let status = '';
        if (result.length == contentIdArray.length) {
          let total_percentage = 0;
          for (let j = 0; j < result.length; j++) {
            let temp_result = result[j];
            total_percentage = total_percentage + temp_result?.percentage;
          }
          let temp_percentage = total_percentage / result.length;
          percentage = parseFloat(temp_percentage.toFixed(2));
          status = 'Completed';
        } else if (result.length == 0) {
          percentage = 0;
          status = 'Not_Started';
        } else {
          percentage = 0;
          status = 'In_Progress';
        }
        let temp_obj = {
          userId: userId,
          percentageString: `${percentage}%`,
          percentage: `${percentage}`,
          status: status,
          assessments: result,
        };
        output_result.push(temp_obj);
      }

      this.loggerService.log('success', 'searchStatusAssessmentTracking');
      return response.status(200).send({
        success: true,
        message: 'success',
        data: output_result,
      });
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        errorMessage,
        errorMessage,
        'searchStatusAssessmentTracking',
      );

      return response.status(500).send({
        success: false,
        message: errorMessage,
        data: {},
      });
    }
  }

  public async searchAssessmentRecords(
    request: any,
    searchAssessmentTrackingDto: SearchAssessmentTrackingDto,
    response: Response,
  ) {
    const apiId = 'api.list.assessment';

    try {
      const filterKeys = [
        'assessmentTrackingId',
        'userId',
        'courseId',
        'unitId',
        'contentId',
      ];
      const paginationKeys = ['pageSize', 'page'];
      const sortKeys = ['field', 'order'];
      const orderValue = ['asc', 'desc'];
      const orderField = [
        'assessmentTrackingId',
        'userId',
        'courseId',
        'contentId',
        'attemptId',
        'createdOn',
        'lastAttemptedOn',
        'totalMaxScore',
        'totalScore',
        'updatedOn',
        'unitId',
      ];

      const { pagination, sort, filters } = searchAssessmentTrackingDto;
      let limit = pagination?.pageSize;
      let page = pagination?.page;
      const orderBy = sort?.field;
      const order = sort?.order;
      let offset = 0;
      let orderOption = {};
      const whereClause = {};
      const emptyValueKeys = {};
      let emptyKeysString = '';

      if (filters && Object.keys(filters).length > 0) {
        const invalidKey = await this.invalidKeyCheck(filters, filterKeys);
        if (invalidKey.length > 0) {
          this.loggerService.error(
            `Invalid key: ${invalidKey}`,
            'BAD_REQUEST',
            apiId,
          );
          return APIResponse.error(
            response,
            apiId,
            `Invalid key: ${invalidKey}`,
            'Invalid Key.',
            HttpStatus.BAD_REQUEST,
          );
        }

        Object.entries(filters).forEach(([key, value]) => {
          if (value === '') {
            this.loggerService.error(
              `Blank value for key '${key}'. Please provide a valid value.`,
              'BAD_REQUEST',
              apiId,
            );
            return APIResponse.error(
              response,
              apiId,
              `Blank value for key '${key}'. Please provide a valid value.`,
              'Blank value.',
              HttpStatus.BAD_REQUEST,
            );
          }
          whereClause[key] = value;
        });
      }

      if (pagination && Object.keys(pagination).length > 0) {
        const invalidKey = await this.invalidKeyCheck(
          pagination,
          paginationKeys,
        );
        if (invalidKey.length > 0) {
          this.loggerService.error(
            `Invalid key: ${invalidKey}`,
            'BAD_REQUEST',
            apiId,
          );
          return APIResponse.error(
            response,
            apiId,
            `Invalid key: ${invalidKey}`,
            'Invalid Key',
            HttpStatus.BAD_REQUEST,
          );
        }
        if (limit > 0 && page > 0) {
          offset = limit * (page - 1);
        } else {
          limit = 200;
        }
      }

      if (sort && Object.keys(sort).length > 0) {
        const invalidKey = await this.invalidKeyCheck(sort, sortKeys);
        if (invalidKey.length > 0) {
          this.loggerService.error(
            `Invalid key: ${invalidKey}`,
            'BAD_REQUEST',
            apiId,
          );
          return APIResponse.error(
            response,
            apiId,
            `Invalid key: ${invalidKey}`,
            'Invalid Key',
            HttpStatus.BAD_REQUEST,
          );
        } else {
          if (orderBy === '' || order === '') {
            this.loggerService.error(
              `Blank value for order or field. Please provide a valid value.`,
              'BAD_REQUEST',
              apiId,
            );
            return APIResponse.error(
              response,
              apiId,
              `Blank value for order or field. Please provide a valid value.`,
              'Blank value.',
              HttpStatus.BAD_REQUEST,
            );
          }

          if (orderBy && order) {
            if (!orderValue.includes(order)) {
              this.loggerService.error(
                `Invalid sort order ${order}. Please use either 'asc' or 'desc'.`,
                'BAD_REQUEST',
                apiId,
              );
              return APIResponse.error(
                response,
                apiId,
                `Invalid sort order ${order}. Please use either 'asc' or 'desc'.`,
                'Invalid Sort Order.',
                HttpStatus.BAD_REQUEST,
              );
            }

            if (!orderField.includes(orderBy)) {
              this.loggerService.error(
                `Invalid sort field "${orderBy}". Please use a valid sorting field.`,
                'BAD_REQUEST',
                apiId,
              );
              return APIResponse.error(
                response,
                apiId,
                `Invalid sort field "${orderBy}". Please use a valid sorting field.`,
                'Invalid Sort field.',
                HttpStatus.BAD_REQUEST,
              );
            }
            orderOption[orderBy] = order.toUpperCase();
          }
        }
      }

      if (whereClause['userId'] && !isUUID(whereClause['userId'])) {
        this.loggerService.error(
          'Invalid User ID format. It must be a valid UUID.',
          'BAD_REQUEST',
          apiId,
        );
        return APIResponse.error(
          response,
          apiId,
          'Invalid User ID format. It must be a valid UUID.',
          'Please enter a valid UUID.',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (
        whereClause['assessmentTrackingId'] &&
        !isUUID(whereClause['assessmentTrackingId'])
      ) {
        this.loggerService.error(
          'Invalid Assessment Tracking ID format. It must be a valid UUID.',
          'BAD_REQUEST',
          apiId,
        );
        return APIResponse.error(
          response,
          apiId,
          'Invalid Assessment Tracking ID format. It must be a valid UUID.',
          'Please enter a valid UUID.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const [result, total] =
        await this.assessmentTrackingRepository.findAndCount({
          where: {
            ...whereClause,
            showFlag: Not(false),
          },
          order: orderOption,
          skip: offset,
          take: limit,
        });
      if (result.length == 0) {
        this.loggerService.error('No data found.', 'NOT_FOUND', apiId);
        return APIResponse.error(
          response,
          apiId,
          'No data found.',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }
      this.loggerService.log('Assessment data fetched successfully.', apiId);
      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        'Assessment data fetched successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(errorMessage, 'INTERNAL_SERVER_ERROR', apiId);
      return APIResponse.error(
        response,
        apiId,
        'Failed to fetch assessment data.',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async validateCreateDTO(
    allowedKeys: string[],
    dto: Record<string, any>,
  ) {
    const inputKeys = Object.keys(dto);
    const invalidKeys = inputKeys.filter((key) => !allowedKeys.includes(key));
    return invalidKeys;
  }

  public async invalidKeyCheck(givenKeys: any, acceptedKeys: string[]) {
    const invalidKeys = [];
    Object.entries(givenKeys).forEach(([key, value]) => {
      if (!acceptedKeys.includes(key)) {
        invalidKeys.push(key);
      }
    });
    return invalidKeys;
  }

  public async deleteAssessmentTracking(
    request: any,
    assessmentTrackingId: string,
    response: Response,
  ) {
    const apiId = 'api.delete.assessment';

    try {
      if (!isUUID(assessmentTrackingId)) {
        this.loggerService.error(
          'Please entire valid UUID.',
          'BAD_REQUEST',
          apiId,
          assessmentTrackingId,
        );
        return APIResponse.error(
          response,
          apiId,
          'Please entire valid UUID.',
          'Please entire valid UUID.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const getAssessmentData = await this.assessmentTrackingRepository.findOne(
        {
          where: {
            assessmentTrackingId: assessmentTrackingId,
          },
        },
      );

      if (!getAssessmentData) {
        this.loggerService.error(
          'Tracking Id not found.',
          'NOT_FOUND',
          apiId,
          assessmentTrackingId,
        );
        return APIResponse.error(
          response,
          apiId,
          'Tracking Id not found.',
          'Tracking Id not found.',
          HttpStatus.NOT_FOUND,
        );
      }

      const deleteAssessment = await this.assessmentTrackingRepository.delete({
        assessmentTrackingId: assessmentTrackingId,
      });
      //delete all releated score details also
      const deleteAssessmentDetail =
        await this.assessmentTrackingScoreDetailRepository.delete({
          assessmentTrackingId: assessmentTrackingId,
        });
      if (deleteAssessment['affected'] > 0) {
        this.loggerService.log(
          'Assessment data deleted successfully.',
          apiId,
          assessmentTrackingId,
        );
        return APIResponse.success(
          response,
          apiId,
          { data: `${assessmentTrackingId} is Deleted` },
          HttpStatus.OK,
          'Assessment data deleted successfully.',
        );
      }
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        errorMessage,
        'INTERNAL_SERVER_ERROR',
        apiId,
        assessmentTrackingId,
      );
      return APIResponse.error(
        response,
        apiId,
        'Failed to fetch assessment data.',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async publishTrackingEvent(
    eventType: 'created' | 'updated' | 'deleted',
    assessmentTrackingId: string,
    apiId: string,
  ): Promise<void> {
    try {
      let trackingData: any = {};

      if (eventType === 'deleted') {
        trackingData = {
          assessmentTrackingId,
          deletedAt: new Date().toISOString(),
        };
      } else {
        try {
          const assessmentData =
            await this.assessmentTrackingRepository.findOne({
              where: { assessmentTrackingId },
            });

          const assessmentScoreData =
            await this.assessmentTrackingScoreDetailRepository.find({
              where: { assessmentTrackingId },
            });

          trackingData = {
            ...assessmentData,
            scores: assessmentScoreData,
          };
        } catch (error) {
          trackingData = { assessmentTrackingId };
        }
      }

      console.log(trackingData);

      await this.kafkaService.publishTrackingEvent(
        eventType,
        trackingData,
        assessmentTrackingId,
      );
    } catch (error) {
      // Handle/log error silently
    }
  }
  public async offlineAssessmentCheck(
    request: any,
    object: any,
    response: Response,
  ) {
    const apiId = 'api.offline.assessment.check';
    try {
      const result = await this.assessmentTrackingRepository.find({
        where: {
          userId: In(object.userIds),
          contentId: object.questionSetId,
        },
      });
      const answersheetSubmissionResponse =
        await this.answersheetSubmissionRepository.find({
          where: {
            userId: In(object.userIds),
            questionSetId: object.questionSetId,
          },
        });
      console.log('result: ', result);
      const questionsetPendingFromAI =
        !result || result.length === 0
          ? answersheetSubmissionResponse
          : answersheetSubmissionResponse.filter(
              (item) => !result.some((r) => r.userId === item.userId),
            );
      console.log('questionsetPendingFromAI: ', questionsetPendingFromAI);
      if (result.length === 0 && questionsetPendingFromAI.length === 0) {
        this.loggerService.log(
          'No offline assessment records found.',
          apiId,
          object,
        );
        return APIResponse.success(
          response,
          apiId,
          [],
          HttpStatus.OK,
          'No offline assessment records found.',
        );
      }
      let finalResult = [];
      const bucketUrl = 'https://' + this.configService.get('AWS_BUCKET_NAME');
      if (result.length > 0) {
        const groupedByUser = new Map<string, typeof result>();

        for (const item of result) {
          if (!groupedByUser.has(item.userId)) {
            groupedByUser.set(item.userId, []);
          }
          groupedByUser.get(item.userId).push(item);
        }

        for (const [userId, records] of groupedByUser.entries()) {
          let uploadedFlag = false;
          let submitedFlag = false;
          let status;

          if (
            records.length === 1 &&
            records[0].evaluatedBy === 'AI Evaluator'
          ) {
            uploadedFlag = true;
            status = 'AI Processed';
          } else {
            submitedFlag = records.some(
              (item) => item.evaluatedBy === 'Manual',
            );
            if (submitedFlag) status = 'Approved';
          }

          const finalFileUrls = answersheetSubmissionResponse.flatMap((item) =>
            item.fileUrls.map((filePath: string) => `${bucketUrl}/${filePath}`),
          );

          finalResult.push({
            userId,
            uploadedFlag,
            submitedFlag,
            status,
            records,
            fileUrls: finalFileUrls,
          });
        }
      }
      if (questionsetPendingFromAI.length > 0) {
        questionsetPendingFromAI.forEach((item) => {
          let fileUrls = item.fileUrls.map((filePath: string) => {
            return `${bucketUrl}/${filePath}`;
          });
          item.fileUrls = fileUrls;
          finalResult.push({
            userId: item.userId,
            uploadedFlag: false,
            submitedFlag: false,
            status: 'AI Pending',
            records: [item],
            fileUrls: fileUrls,
          });
        });
      }

      this.loggerService.log(
        'Status of assessment fetched successfully.',
        apiId,
        finalResult.toString(),
      );
      return APIResponse.success(
        response,
        apiId,
        finalResult,
        HttpStatus.OK,
        'Status of assessment fetched successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(errorMessage, 'INTERNAL_SERVER_ERROR', apiId);
      return APIResponse.error(
        response,
        apiId,
        'Failed to check offline assessment status.',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
