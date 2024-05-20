import { BadRequestException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AssessmentTracking } from "src/modules/tracking_assesment/entities/tracking-assessment-entity";
import { Repository } from "typeorm";
import { CreateAssessmentTrackingDto } from "./dto/traking-assessment-create-dto";
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { SearchAssessmentTrackingDto } from "./dto/traking-assessment-search-dto";
import { IsUUID, isUUID } from 'class-validator';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TrackingAssesmentService {
  private ttl;
  constructor(
    @InjectRepository(AssessmentTracking)
    private assessmentTrackingRepository: Repository<AssessmentTracking>,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {
    this.ttl = this.configService.get('TTL');
  }

  public async getAssessmentTrackingDetails(
    request: any, assessmentTrackingId: string, response: Response
  ) {
    const apiId = 'api.get.assessmentTrackingId';
    if (!isUUID(assessmentTrackingId)) {
      return response
        .status(HttpStatus.BAD_REQUEST)
        .send(
          APIResponse.error(
            apiId,
            'Please entire valid UUID.',
            JSON.stringify('Please entire valid UUID.'),
            '400',
          ),
        );
    }
    try {
      const ttl = this.ttl;
      const cachedData: any = await this.cacheService.get(assessmentTrackingId);
      if (cachedData) {
        return response
          .status(HttpStatus.OK)
          .send(APIResponse.success(apiId, cachedData, "200", "Assessment data fetch successfully."));
      }
      const result = await this.assessmentTrackingRepository.findOne({
        where: {
          assessmentTrackingId: assessmentTrackingId
        }
      })
      if (!result) {
        return response
          .status(HttpStatus.BAD_REQUEST)
          .send(
            APIResponse.error(
              apiId,
              'No data found.',
              JSON.stringify('No data found.'),
              'BAD_REQUEST',
            ),
          );
      }
      await this.cacheService.set(assessmentTrackingId, result, ttl);
      return response
        .status(HttpStatus.OK)
        .send(APIResponse.success(apiId, result, '200', "Assessment data fetch successfully."));
    } catch (e) {
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(APIResponse.error(
          apiId,
          'Something went wrong in assessment creation',
          JSON.stringify(e),
          'INTERNAL_SERVER_ERROR',
        ))
    }
  }

  public async createAssessmentTracking(
    request: any, createAssessmentTrackingDto: CreateAssessmentTrackingDto, response: Response
  ): Promise<Response> {
    const apiId = 'api.create.assessment';
    try {
      const allowedKeys = [
        'assessmentTrackingId', 'userId', 'courseId', 'batchId', 'contentId',
        'attemptId', 'createdOn', 'lastAttemptedOn', 'assessmentSummary',
        'totalMaxScore', 'totalScore', 'timeSpent'
      ];
      const errors = await this.validateCreateDTO(allowedKeys, createAssessmentTrackingDto);

      if (errors.length > 0) {

        return response
          .status(HttpStatus.BAD_REQUEST)
          .send(
            APIResponse.error(
              apiId,
              `Invalid Key ${errors.join(", ")}`,
              JSON.stringify('Invalid Key.'),
              '400',
            ),
          );
      }

      if (!isUUID(createAssessmentTrackingDto.userId)) {
        return response
          .status(HttpStatus.BAD_REQUEST)
          .send(
            APIResponse.error(
              apiId,
              'Please entire valid UUID.',
              JSON.stringify('Please entire valid UUID.'),
              '400',
            ),
          );
      }

      const result = await this.assessmentTrackingRepository.save(createAssessmentTrackingDto)
      return response
        .status(HttpStatus.CREATED)
        .send(APIResponse.success(apiId, { assessmentTrackingId: result.assessmentTrackingId }, '201', 'Assessment submitted successfully.'));
    } catch (e) {
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(APIResponse.error(
          apiId,
          'Failed to fetch assessment data.',
          JSON.stringify(e),
          'INTERNAL_SERVER_ERROR',
        ))
    }
  }

  public async searchAssessmentRecords(
    request: any,
    searchAssessmentTrackingDto: SearchAssessmentTrackingDto,
    response: Response
  ) {
    const apiId = 'api.list.assessment';

    try {
      const filterKeys = ["assessmentTrackingId", "userId", "courseId", "batchId", "contentId"];
      const paginationKeys = ["pageSize", "page"];
      const sortKeys = ["field", "order"];
      const orderValue = ["asc", "desc"];
      const orderField = [
        'assessmentTrackingId', 'userId', 'courseId', 'batchId', 'contentId',
        'attemptId', 'createdOn', 'lastAttemptedOn', 'assessmentSummary',
        'totalMaxScore', 'totalScore', 'timeSpent', 'updatedOn'
      ];

      const { pagination, sort, filters } = searchAssessmentTrackingDto;
      let limit = pagination?.pageSize;
      let page = pagination?.page;
      const orderBy = sort?.field;
      const order = sort?.order;
      let offset = 0;
      let orderOption = {};
      const whereClause = {};

      if (filters && Object.keys(filters).length > 0) {
        const invalidKey = await this.invalidKeyCheck(filters, filterKeys)
        if (invalidKey.length > 0) {
          return response
            .status(HttpStatus.BAD_REQUEST)
            .send(
              APIResponse.error(
                apiId,
                `Invalid key: ${invalidKey}`,
                JSON.stringify('Invalid Key.'),
                '400',
              ),
            );
        }

        Object.entries(filters).forEach(([key, value]) => {
          if (value === '') {
            return response
              .status(HttpStatus.BAD_REQUEST)
              .send(
                APIResponse.error(
                  apiId,
                  `Blank value for key '${key}'. Please provide a valid value.`,
                  JSON.stringify('Blank value.'),
                  '400',
                ),
              );
          }
          whereClause[key] = value;
        });

      }

      if (pagination && Object.keys(pagination).length > 0) {
        const invalidKey = await this.invalidKeyCheck(pagination, paginationKeys)
        if (invalidKey.length > 0) {
          return response
            .status(HttpStatus.BAD_REQUEST)
            .send(
              APIResponse.error(
                apiId,
                `Invalid key: ${invalidKey}`,
                JSON.stringify('Invalid Key.'),
                '400',
              ),
            );
        }

        if (limit == 0 || page == 0) {
          limit = 20;
          offset = 1;
        } else {
          offset = (limit) * (page - 1);
        }
      }

      if (sort && Object.keys(sort).length > 0) {
        const invalidKey = await this.invalidKeyCheck(sort, sortKeys)
        if (invalidKey.length > 0) {
          return response
            .status(HttpStatus.BAD_REQUEST)
            .send(
              APIResponse.error(
                apiId,
                `Invalid key: ${invalidKey}`,
                JSON.stringify('Invalid Key.'),
                '400',
              ),
            );
        } else {
          if(orderBy==='' || order===''){
            return response
            .status(HttpStatus.BAD_REQUEST)
            .send(
              APIResponse.error(
                apiId,
                `Blank value for order or field. Please provide a valid value.`,
                JSON.stringify('Blank value.'),
                '400',
              ),
            );
          }
          if (orderBy && order) {
            if (!orderValue.includes(order)) {
              return response
                .status(HttpStatus.BAD_REQUEST)
                .send(
                  APIResponse.error(
                    apiId,
                    `Invalid sort order ${order}. Please use either 'asc' or 'desc'.`,
                    JSON.stringify('Invalid Sort Order.'),
                    '400',
                  ),
                );
            }

            if (!orderField.includes(orderBy)) {
              return response
                .status(HttpStatus.BAD_REQUEST)
                .send(
                  APIResponse.error(
                    apiId,
                    `Invalid sort field "${orderBy}". Please use a valid sorting field.`,
                    JSON.stringify('Invalid Sort Field.'),
                    '400',
                  ),
                );
            }
            orderOption[orderBy] = order.toUpperCase();
          }
        }
      }

      if (whereClause['userId']) {

        if (!isUUID(whereClause['userId'])) {
          return response
            .status(HttpStatus.BAD_REQUEST)
            .send(
              APIResponse.error(
                apiId,
                'Invalid User ID format. It must be a valid UUID.',
                JSON.stringify('Please enter a valid UUID.'),
                '400',
              ),
            );
        }
      }

      if (whereClause['assessmentTrackingId']) {
        if (!isUUID(whereClause['assessmentTrackingId'])) {
          return response
            .status(HttpStatus.BAD_REQUEST)
            .send(
              APIResponse.error(
                apiId,
                'Invalid Assessment Tracking ID format. It must be a valid UUID.',
                JSON.stringify('Please enter a valid UUID.'),
                '400',
              ),
            );
        }
      }

      const result = await this.assessmentTrackingRepository.find({
        where: whereClause,
        order: orderOption,
        skip: offset,
        take: limit,
      })

      if (result.length == 0) {
        return response
          .status(HttpStatus.BAD_REQUEST)
          .send(
            APIResponse.error(
              apiId,
              'No data found.',
              JSON.stringify('No data found.'),
              'BAD_REQUEST',
            ),
          );
      }

      return response
        .status(HttpStatus.OK)
        .send(APIResponse.success(apiId, result, '200', "Assessment data fetch successfully."));

    } catch (e) {
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(APIResponse.error(
          apiId,
          'Failed to fetch assessment data.',
          JSON.stringify(e),
          'INTERNAL_SERVER_ERROR',
        ))
    }
  }

  public async validateCreateDTO(allowedKeys: string[], dto: Record<string, any>) {
    const inputKeys = Object.keys(dto);
    const invalidKeys = inputKeys.filter(key => !allowedKeys.includes(key));
    return invalidKeys;
  }

  public async invalidKeyCheck(givenKeys: any, acceptedKeys: string[]) {
    const invalidKeys = [];
    Object.entries(givenKeys).forEach(([key, value]) => {
      if (!acceptedKeys.includes(key)) {
        invalidKeys.push(key)
      }
    });
    return invalidKeys;
  }

  public async deleteAssessmentTracking(request: any, assessmentTrackingId: string, response: Response){
    const apiId = 'api.delete.assessment';
    try {
      
      if (!isUUID(assessmentTrackingId)) {
        return response
          .status(HttpStatus.BAD_REQUEST)
          .send(APIResponse.error(apiId,'Please entire valid UUID.',JSON.stringify('Please entire valid UUID.'),'400'),
          );
      }
      const getAssessmentData = await this.assessmentTrackingRepository.findOne({
        where: {
          assessmentTrackingId: assessmentTrackingId
        }
      })

      if(!getAssessmentData){
        return response
        .status(HttpStatus.NOT_FOUND)
        .send(
          APIResponse.error(apiId,'Tracking Id not found.',JSON.stringify('Tracking Id not found.'),'404'),
        );
      }

      const deleteAssessment = await this.assessmentTrackingRepository.delete({
        assessmentTrackingId:assessmentTrackingId
      })
      if(deleteAssessment['affected']>0){
        return response
        .status(HttpStatus.OK)
        .send(APIResponse.success(apiId, assessmentTrackingId,'200', "Assessment tracking deleted successfully."));
      }
      // console.log("hii",deleteAssessment['affected']);

    } catch (e) {
      return response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .send(APIResponse.error(
        apiId,
        'Failed to fetch assessment data.',
        JSON.stringify(e),
        'INTERNAL_SERVER_ERROR',
      ))
    }
  }

}

