import { BadRequestException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AssessmentTracking } from "src/modules/tracking_assessment/entities/tracking-assessment-entity";
import { Repository } from "typeorm";
import { CreateAssessmentTrackingDto } from "./dto/tracking-assessment-create-dto";
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { SearchAssessmentTrackingDto } from "./dto/tracking-assessment-search-dto";
import { IsUUID, isUUID } from 'class-validator';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TrackingAssessmentService {
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
      return APIResponse.error(response,apiId,"Please Enter Valid UUID","BAD_REQUEST",HttpStatus.BAD_REQUEST);
    }
    try {
      const ttl = this.ttl;
      const cachedData: any = await this.cacheService.get(assessmentTrackingId);
      if (cachedData) {
          return APIResponse.success(response,apiId,cachedData,HttpStatus.OK,"Assessment data fetch successfully.");
      }
      const result = await this.findAssessment(assessmentTrackingId)
      if (!result) {
        return APIResponse.error(response,apiId,"No data found.","BAD_REQUEST",HttpStatus.BAD_REQUEST);
      }
      await this.cacheService.set(assessmentTrackingId, result, ttl);
      return APIResponse.success(response,apiId,result,HttpStatus.OK,"Assessment data fetch successfully.");
    } catch (e) {
      const errorMessage = e.message || "Internal Server Error";
      return APIResponse.error(response,apiId,"Something went wrong in assessment creation",errorMessage,HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }


  public async findAssessment(assessmentTrackingId){
    const result = await this.assessmentTrackingRepository.findOne({
      where: {
        assessmentTrackingId: assessmentTrackingId
      }
    })
    if(result){
      return result
    }
    return false;
  }
  public async createAssessmentTracking(
    request: any, createAssessmentTrackingDto: CreateAssessmentTrackingDto, response: Response
  ){
    const apiId = 'api.create.assessment';
    try {
      const allowedKeys = [
        'assessmentTrackingId', 'userId', 'courseId', 'batchId', 'contentId',
        'attemptId', 'createdOn', 'lastAttemptedOn', 'assessmentSummary',
        'totalMaxScore', 'totalScore', 'timeSpent'
      ];
      const errors = await this.validateCreateDTO(allowedKeys, createAssessmentTrackingDto);

      if (errors.length > 0) {
        return APIResponse.error(response,apiId,`Invalid Key ${errors.join(", ")}`, JSON.stringify('Invalid Key.'),HttpStatus.BAD_REQUEST);
      }

      if (!isUUID(createAssessmentTrackingDto.userId)) {
        return APIResponse.error(response,apiId,'Please entire valid UUID.', JSON.stringify('Please entire valid UUID.'),HttpStatus.BAD_REQUEST);
      }

      const result = await this.assessmentTrackingRepository.save(createAssessmentTrackingDto)
      return APIResponse.success(response,apiId,{ assessmentTrackingId: result.assessmentTrackingId },HttpStatus.CREATED,"Assessment submitted successfully.");
    } catch (e) {
      const errorMessage = e.message || "Internal Server Error";
      return APIResponse.error(response,apiId, 'Failed to fetch assessment data.',errorMessage,HttpStatus.BAD_REQUEST);
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
        'totalMaxScore', 'totalScore', 'updatedOn'
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
        const invalidKey = await this.invalidKeyCheck(filters, filterKeys)
        if (invalidKey.length > 0) {
          return APIResponse.error(response,apiId,`Invalid key: ${invalidKey}`,'Invalid Key.',HttpStatus.BAD_REQUEST);
        }

        Object.entries(filters).forEach(([key, value]) => {
          if (value === '') {
            return APIResponse.error(response,apiId, `Blank value for key '${key}'. Please provide a valid value.`,'Blank value.',HttpStatus.BAD_REQUEST);
          }
        });
      }
    
      if (pagination && Object.keys(pagination).length > 0) {
        const invalidKey = await this.invalidKeyCheck(pagination, paginationKeys)
        if (invalidKey.length > 0) {
          return APIResponse.error(response,apiId,  `Invalid key: ${invalidKey}`,'Invalid Key',HttpStatus.BAD_REQUEST);
        }
        if (limit > 0 && page > 0) {
          offset = (limit) * (page - 1);
        } else{
          limit = 200;
        }

      }
      

      if (sort && Object.keys(sort).length > 0) {
        const invalidKey = await this.invalidKeyCheck(sort, sortKeys)
        if (invalidKey.length > 0) {
          return APIResponse.error(response,apiId,  `Invalid key: ${invalidKey}`,'Invalid Key',HttpStatus.BAD_REQUEST);
        } else {
          if(orderBy==='' || order===''){
            return APIResponse.error(response,apiId,  `Blank value for order or field. Please provide a valid value.`,'Blank value.',HttpStatus.BAD_REQUEST);
          }

          if (orderBy && order) {
            if (!orderValue.includes(order)) {
              return APIResponse.error(response,apiId, `Invalid sort order ${order}. Please use either 'asc' or 'desc'.`,'Invalid Sort Order.',HttpStatus.BAD_REQUEST); 
            }

            if (!orderField.includes(orderBy)) {
              return APIResponse.error(response,apiId,  `Invalid sort field "${orderBy}". Please use a valid sorting field.`,'Invalid Sort field.',HttpStatus.BAD_REQUEST); 
            }
            orderOption[orderBy] = order.toUpperCase();
          }
        }
      }

      if (whereClause['userId']) {

        if (!isUUID(whereClause['userId'])) {
          return APIResponse.error(response,apiId, 'Invalid User ID format. It must be a valid UUID.','Please enter a valid UUID.',HttpStatus.BAD_REQUEST);
        }
      }

      if (whereClause['assessmentTrackingId']) {
        if (!isUUID(whereClause['assessmentTrackingId'])) {
          return APIResponse.error(response,apiId,  'Invalid Assessment Tracking ID format. It must be a valid UUID.','Please enter a valid UUID.',HttpStatus.BAD_REQUEST);
        }
      }
      let errObj={}
      const [result, total] = await this.assessmentTrackingRepository.findAndCount({
        where: whereClause,
        order: orderOption,
        skip: offset,
        take: limit,
      })
      if (result.length == 0) {
        return APIResponse.error(response,apiId,   'No data found.', 'BAD_REQUEST',HttpStatus.BAD_REQUEST);
      }
      return APIResponse.success(response,apiId,result,HttpStatus.OK,"Assessment data fetch successfully.")

    } catch (e) {
      const errorMessage = e.message || "Internal Server Error";
      return APIResponse.error(response,apiId, 'Failed to fetch assessment data.',errorMessage,HttpStatus.INTERNAL_SERVER_ERROR);
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
        return APIResponse.error(response,apiId,'Please entire valid UUID.','Please entire valid UUID.',HttpStatus.BAD_REQUEST);
      }
      const getAssessmentData = await this.assessmentTrackingRepository.findOne({
        where: {
          assessmentTrackingId: assessmentTrackingId
        }
      })

      if(!getAssessmentData){
        return APIResponse.error(response,apiId,'Tracking Id not found.','Tracking Id not found.',HttpStatus.NOT_FOUND);
      }

      const deleteAssessment = await this.assessmentTrackingRepository.delete({
        assessmentTrackingId:assessmentTrackingId
      })
      if(deleteAssessment['affected']>0){
        return APIResponse.success(response,apiId,{data:`${assessmentTrackingId} is Deleted`},HttpStatus.OK,"Assessment data fetch successfully.")
      }

    } catch (e) {
      const errorMessage = e.message || "Internal Server Error";
      return APIResponse.error(response,apiId,'Failed to fetch assessment data.','INTERNAL_SERVER_ERROR',HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

}

