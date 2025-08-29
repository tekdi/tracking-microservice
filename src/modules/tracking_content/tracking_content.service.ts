import {
  BadRequestException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ContentTracking } from 'src/modules/tracking_content/entities/tracking-content-entity';
import { ContentTrackingDetail } from 'src/modules/tracking_content/entities/tracking-content-details-entity';
import { Repository, MoreThan } from 'typeorm';
import { CreateContentTrackingDto } from './dto/tracking-content-create-dto';
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { SearchContentTrackingDto } from './dto/tracking-content-search-dto';
import { IsUUID, isUUID } from 'class-validator';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { LoggerService } from 'src/common/logger/logger.service';
import { KafkaService } from 'src/kafka/kafka.service';

@Injectable()
export class TrackingContentService {
  private ttl;
  constructor(
    @InjectRepository(ContentTracking)
    private contentTrackingRepository: Repository<ContentTracking>,
    @InjectRepository(ContentTrackingDetail)
    private contentTrackingDetailRepository: Repository<ContentTrackingDetail>,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
    private dataSource: DataSource,
    private loggerService: LoggerService,
    private readonly kafkaService: KafkaService,
  ) {
    this.ttl = this.configService.get('TTL');
  }

  public async getContentTrackingDetails(
    request: any,
    contentTrackingId: string,
    response: Response,
  ) {
    const apiId = 'api.get.contentTrackingId';
    
    // Extract tenantId from request headers
    const tenantId = request.headers.tenantId || request.headers.tenantid || null;
    if (!tenantId) {
      this.loggerService.error(
        'tenantId is required in the header',
        'BAD_REQUEST',
        apiId,
        contentTrackingId,
      );
      return APIResponse.error(
        response,
        apiId,
        'tenantId is required in the header',
        'BAD_REQUEST',
        HttpStatus.BAD_REQUEST,
      );
    }
    
    if (!isUUID(contentTrackingId)) {
      this.loggerService.error(
        'Please Enter Valid UUID',
        'BAD_REQUEST',
        apiId,
        contentTrackingId,
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
      const cacheKey = `${contentTrackingId}_${tenantId}`;
      const cachedData: any = await this.cacheService.get(cacheKey);
      if (cachedData) {
        this.loggerService.log(
          'Content data fetch successfully.',
          apiId,
          contentTrackingId,
        );
        return APIResponse.success(
          response,
          apiId,
          cachedData,
          HttpStatus.OK,
          'Content data fetch successfully.',
        );
      }
      const result = await this.findContent(contentTrackingId, tenantId);
      if (!result) {
        this.loggerService.error(
          'No data found.',
          'NOT_FOUND',
          apiId,
          contentTrackingId,
        );
        return APIResponse.error(
          response,
          apiId,
          'No data found.',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }
      await this.cacheService.set(cacheKey, result, ttl);
      this.loggerService.log(
        'Content data fetch successfully.',
        apiId,
        contentTrackingId,
      );
      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        'Content data fetch successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        errorMessage,
        errorMessage,
        apiId,
        contentTrackingId,
      );
      return APIResponse.error(
        response,
        apiId,
        'Something went wrong in content creation',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async findContent(contentTrackingId, tenantId = null) {
    const whereCondition: any = {
      contentTrackingId: contentTrackingId,
    };
    
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }
    
    const result = await this.contentTrackingRepository.findOne({
      where: whereCondition,
    });
    if (result) {
      return result;
    }
    return false;
  }
  public async createContentTracking(
    request: any,
    createContentTrackingDto: CreateContentTrackingDto,
    response: Response,
  ) {
    const apiId = 'api.create.content';
    try {
      // Extract tenantId from request headers
      const tenantId = request.headers.tenantId || request.headers.tenantid || request.headers['x-tenant-id'] || null;
      
      // Validate tenantId is required
      if (!tenantId) {
        this.loggerService.error(
          'tenantId is required in the header',
          'BAD_REQUEST',
          apiId,
        );
        return APIResponse.error(
          response,
          apiId,
          'tenantId is required in the header',
          'BAD_REQUEST',
          HttpStatus.BAD_REQUEST,
        );
      }
      
      const allowedKeys = [
        'contentTrackingId',
        'userId',
        'courseId',
        'contentId',
        'contentType',
        'contentMime',
        'createdOn',
        'lastAccessOn',
        'detailsObject',
        'unitId',
      ];
      const errors = await this.validateCreateDTO(
        allowedKeys,
        createContentTrackingDto,
      );

      if (errors.length > 0) {
        this.loggerService.error(
          `Invalid Key ${errors.join(', ')}`,
          'BAD_REQUEST',
          apiId,
        );
        return APIResponse.error(
          response,
          apiId,
          `Invalid Key ${errors.join(', ')}`,
          JSON.stringify('Invalid Key.'),
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!isUUID(createContentTrackingDto.userId)) {
        this.loggerService.error(
          'Please entire valid UUID.',
          'BAD_REQUEST',
          apiId,
        );
        return APIResponse.error(
          response,
          apiId,
          'Please entire valid UUID.',
          JSON.stringify('Please entire valid UUID.'),
          HttpStatus.BAD_REQUEST,
        );
      }

      //get detailsObject for extract details
      const detailsObject = createContentTrackingDto.detailsObject;
      delete createContentTrackingDto.detailsObject;

      // Add tenantId to the DTO if present
      if (tenantId) {
        createContentTrackingDto['tenantId'] = tenantId;
      }

      //find contentTracking
      const result_content = await this.dataSource.query(
        `SELECT "contentTrackingId" FROM content_tracking WHERE "userId"=$1 and "contentId"=$2 and "courseId"=$3 and "unitId"=$4`,
        [
          createContentTrackingDto?.userId,
          createContentTrackingDto?.contentId,
          createContentTrackingDto?.courseId,
          createContentTrackingDto?.unitId,
        ],
      );
      let contentTrackingId = '';
      if (result_content.length > 0) {
        contentTrackingId = result_content[0]?.contentTrackingId;
      } else {
        const result = await this.contentTrackingRepository.save(
          createContentTrackingDto,
        );
        contentTrackingId = result.contentTrackingId;
      }

      //save content details
      let savedDetails = [];
      try {
        let testId = contentTrackingId;
        let details = detailsObject;
        let detailsObj = [];
        for (let i = 0; i < details.length; i++) {
          let detail: any = details[i];
          let eid = detail?.eid;
          let edata = detail?.edata;
          if (eid && edata) {
            detailsObj.push({
              contentTrackingId: testId,
              userId: createContentTrackingDto.userId,
              eid: eid,
              edata: edata,
              duration: edata?.duration || null,
              mode: edata?.mode || '',
              pageid: edata?.pageid || '',
              type: edata?.type || '',
              subtype: edata?.subtype || '',
              summary: edata?.summary || [],
              progress: edata?.summary
                ? edata.summary[0]?.progress || null
                : null,
            });
          }
        }
        //console.log(detailsObj);
        //insert multiple items
        const result_score =
          await this.contentTrackingDetailRepository.save(detailsObj);
        //console.log('result_score', result_score);
        savedDetails = result_score; // Store the newly saved details
      } catch (e) {
        //Error in CreateDetail!
        console.log(e);
      }
      this.loggerService.log('Content submitted successfully.', apiId);

      // Publish content tracking event to Kafka with only new details
      this.publishContentTrackingEvent('created', contentTrackingId, apiId, savedDetails, tenantId);

      return APIResponse.success(
        response,
        apiId,
        { contentTrackingId: contentTrackingId },
        HttpStatus.CREATED,
        'Content submitted successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        'Failed to fetch content data.',
        'INTERNAL_SERVER_ERROR',
        apiId,
      );
      return APIResponse.error(
        response,
        apiId,
        'Failed to fetch content data.',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async searchContentTracking(
    request: any,
    searchFilter: any,
    response: Response,
  ) {
    try {
      // Extract tenantId from request headers
      const tenantId = request.headers.tenantId || request.headers.tenantid || null;
      if (!tenantId) {
        this.loggerService.error(
          'tenantId is required in the header',
          'BAD_REQUEST',
          'searchContentTracking',
        );
        return response.status(400).send({
          success: false,
          message: 'tenantId is required in the header',
          data: {},
        });
      }

      let output_result = [];
      const result = await this.dataSource.query(
        `SELECT "contentTrackingId","userId","courseId","contentId","contentType","contentMime","createdOn","lastAccessOn","updatedOn","unitId","tenantId" FROM content_tracking WHERE "userId"=$1 and "contentId"=$2 and "courseId"=$3 and "unitId"=$4 and "tenantId"=$5`,
        [
          searchFilter?.userId,
          searchFilter?.contentId,
          searchFilter?.courseId,
          searchFilter?.unitId,
          tenantId,
        ],
      );
      for (let i = 0; i < result.length; i++) {
        const result_details = await this.dataSource.query(
          `SELECT "eid","edata","duration","mode","pageid","type","subtype","summary","progress","createdOn","updatedOn" FROM content_tracking_details WHERE "contentTrackingId"=$1 `,
          [result[i].contentTrackingId],
        );
        let temp_result = result[i];
        temp_result.details = result_details;
        output_result.push(temp_result);
      }
      this.loggerService.log('success', 'searchContentTracking');
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
        'searchContentTracking',
      );
      return response.status(500).send({
        success: false,
        message: errorMessage,
        data: {},
      });
    }
  }

  public async searchStatusContentTracking(
    request: any,
    searchFilter: any,
    response: Response,
  ) {
    try {
      // Extract tenantId from request headers
      const tenantId = request.headers.tenantId || request.headers.tenantid || null;
      if (!tenantId) {
        this.loggerService.error(
          'tenantId is required in the header',
          'BAD_REQUEST',
          'searchStatusContentTracking',
        );
        return response.status(400).send({
          success: false,
          message: 'tenantId is required in the header',
          data: {},
        });
      }

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
      for (let ii = 0; ii < userIdArray.length; ii++) {
        let userId = userIdArray[ii];
        const result = await this.dataSource.query(
          `WITH latest_content AS (
              SELECT 
                  "contentTrackingId",
                  "userId",
                  "courseId",
                  "contentId",
                  "contentType",
                  "contentMime",
                  "createdOn",
                  "lastAccessOn",
                  "updatedOn",
                  "unitId",
                  "tenantId",
                  ROW_NUMBER() OVER (PARTITION BY "userId", "courseId", "unitId", "contentId" ORDER BY "createdOn" DESC) as row_num
              FROM 
                  content_tracking
              WHERE 
                  "userId" = $1 
                  AND "courseId" IN (${courseId_text}) 
                  AND "unitId" IN (${unitId_text}) 
                  AND "contentId" IN (${contentId_text})
                  AND "tenantId" = $2
          )
          SELECT 
              "contentTrackingId",
              "userId",
              "courseId",
              "contentId",
              "contentType",
              "contentMime",
              "createdOn",
              "lastAccessOn",
              "updatedOn",
              "unitId",
              "tenantId"
          FROM 
              latest_content
          WHERE 
              row_num = 1;`,
          [userId, tenantId],
        );
        //find out details
        let output_result_details = [];
        for (let i = 0; i < result.length; i++) {
          const result_details = await this.dataSource.query(
            `SELECT "eid","edata","duration","mode","pageid","type","subtype","summary","progress","createdOn","updatedOn" FROM content_tracking_details WHERE "contentTrackingId"=$1 `,
            [result[i].contentTrackingId],
          );
          //find status
          let percentage = 0;
          let status = 'Not_Started';
          for (let j = 0; j < result_details.length; j++) {
            let temp_result_details = result_details[j];
            if (temp_result_details?.eid == 'START') {
              status = 'In_Progress';
              percentage = temp_result_details?.progress;
            }
            if (temp_result_details?.eid == 'END') {
              status = 'Completed';
              percentage = temp_result_details?.progress;
              break;
            }
          }
          let temp_result = result[i];
          temp_result.percentage = percentage;
          temp_result.status = status;
          temp_result.details = result_details;
          output_result_details.push(temp_result);
        }
        let temp_obj = {
          userId: userId,
          contents: output_result_details,
        };
        output_result.push(temp_obj);
      }

      this.loggerService.log('success', 'searchStatusContentTracking');
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
        'searchStatusContentTracking',
      );
      return response.status(500).send({
        success: false,
        message: errorMessage,
        data: {},
      });
    }
  }

  public async searchStatusCourseTracking(
    request: any,
    searchFilter: any,
    response: Response,
  ) {
    try {
      // Extract tenantId from request headers
      const tenantId = request.headers.tenantId || request.headers.tenantid || null;
      if (!tenantId) {
        this.loggerService.error(
          'tenantId is required in the header',
          'BAD_REQUEST',
          'searchStatusCourseTracking',
        );
        return response.status(400).send({
          success: false,
          message: 'tenantId is required in the header',
          data: {},
        });
      }

      //courseId
      let courseIdArray = searchFilter?.courseId;
      let userIdArray = searchFilter?.userId;
      let userList = [];
      for (let ii = 0; ii < userIdArray.length; ii++) {
        let userId = userIdArray[ii];
        let courseList = [];
        for (let jj = 0; jj < courseIdArray.length; jj++) {
          let courseId = courseIdArray[jj];
          const result = await this.dataSource.query(
            `SELECT "contentTrackingId","userId","courseId","lastAccessOn","createdOn","updatedOn","contentId","tenantId" FROM content_tracking WHERE "userId"=$1 and "courseId"=$2 and "tenantId"=$3 order by "createdOn" asc;`,
            [userId, courseId, tenantId],
          );
          let in_progress = 0;
          let completed = 0;
          let in_progress_list = [];
          let completed_list = [];
          for (let i = 0; i < result.length; i++) {
            const result_details = await this.dataSource.query(
              `SELECT "eid","edata","duration","mode","pageid","type","subtype","summary","progress","createdOn","updatedOn" FROM content_tracking_details WHERE "contentTrackingId"=$1 `,
              [result[i].contentTrackingId],
            );
            //find status
            let percentage = 0;
            let status = 'Not_Started';
            for (let j = 0; j < result_details.length; j++) {
              let temp_result_details = result_details[j];
              if (temp_result_details?.eid == 'START') {
                status = 'In_Progress';
                percentage = temp_result_details?.progress;
              }
              if (temp_result_details?.eid == 'END') {
                status = 'Completed';
                percentage = temp_result_details?.progress;
                break;
              }
            }
            if (status == 'In_Progress') {
              in_progress++;
              in_progress_list.push(result[i].contentId);
            } else if (status == 'Completed') {
              completed++;
              completed_list.push(result[i].contentId);
            }
          }
          courseList.push({
            courseId: courseId,
            in_progress: in_progress,
            completed: completed,
            started_on: result[0]?.createdOn ? result[0].createdOn : null,
            in_progress_list: in_progress_list,
            completed_list: completed_list,
          });
        }
        userList.push({ userId: userId, course: courseList });
      }
      this.loggerService.log('success', 'searchStatusCourseTracking');
      return response.status(200).send({
        success: true,
        message: 'success',
        data: userList,
      });
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        errorMessage,
        errorMessage,
        'searchStatusCourseTracking',
      );
      return response.status(500).send({
        success: false,
        message: errorMessage,
        data: {},
      });
    }
  }

  public async searchStatusUnitTracking(
    request: any,
    searchFilter: any,
    response: Response,
  ) {
    try {
      // Extract tenantId from request headers
      const tenantId = request.headers.tenantId || request.headers.tenantid || null;
      if (!tenantId) {
        this.loggerService.error(
          'tenantId is required in the header',
          'BAD_REQUEST',
          'searchStatusUnitTracking',
        );
        return response.status(400).send({
          success: false,
          message: 'tenantId is required in the header',
          data: {},
        });
      }

      //courseId
      let courseId = searchFilter?.courseId;
      let unitIdArray = searchFilter?.unitId;
      let userIdArray = searchFilter?.userId;
      let userList = [];
      for (let ii = 0; ii < userIdArray.length; ii++) {
        let userId = userIdArray[ii];
        let unitList = [];
        for (let jj = 0; jj < unitIdArray.length; jj++) {
          let unitId = unitIdArray[jj];
          const result = await this.dataSource.query(
            `SELECT "contentTrackingId","userId","courseId","lastAccessOn","createdOn","updatedOn","contentId","tenantId" FROM content_tracking WHERE "userId"=$1 and "courseId"=$2 and "unitId"=$3 and "tenantId"=$4 order by "createdOn" asc;`,
            [userId, courseId, unitId, tenantId],
          );
          let in_progress = 0;
          let completed = 0;
          let in_progress_list = [];
          let completed_list = [];
          for (let i = 0; i < result.length; i++) {
            const result_details = await this.dataSource.query(
              `SELECT "eid","edata","duration","mode","pageid","type","subtype","summary","progress","createdOn","updatedOn" FROM content_tracking_details WHERE "contentTrackingId"=$1 `,
              [result[i].contentTrackingId],
            );
            //find status
            let percentage = 0;
            let status = 'Not_Started';
            for (let j = 0; j < result_details.length; j++) {
              let temp_result_details = result_details[j];
              if (temp_result_details?.eid == 'START') {
                status = 'In_Progress';
                percentage = temp_result_details?.progress;
              }
              if (temp_result_details?.eid == 'END') {
                status = 'Completed';
                percentage = temp_result_details?.progress;
                break;
              }
            }
            if (status == 'In_Progress') {
              in_progress++;
              in_progress_list.push(result[i].contentId);
            } else if (status == 'Completed') {
              completed++;
              completed_list.push(result[i].contentId);
            }
          }
          unitList.push({
            unitId: unitId,
            courseId: courseId,
            in_progress: in_progress,
            completed: completed,
            started_on: result[0]?.createdOn ? result[0].createdOn : null,
            in_progress_list: in_progress_list,
            completed_list: completed_list,
          });
        }
        userList.push({ userId: userId, unit: unitList });
      }
      this.loggerService.log('success', 'searchStatusUnitTracking');
      return response.status(200).send({
        success: true,
        message: 'success',
        data: userList,
      });
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.log(
        errorMessage,
        errorMessage,
        'searchStatusUnitTracking',
      );
      return response.status(500).send({
        success: false,
        message: errorMessage,
        data: {},
      });
    }
  }

  public async searchContentRecords(
    request: any,
    searchContentTrackingDto: SearchContentTrackingDto,
    response: Response,
  ) {
    const apiId = 'api.list.content';

    try {
      // Extract tenantId from request headers
      const tenantId = request.headers.tenantId || request.headers.tenantid || null;
      if (!tenantId) {
        this.loggerService.error(
          'tenantId is required in the header',
          'BAD_REQUEST',
          apiId,
        );
        return APIResponse.error(
          response,
          apiId,
          'tenantId is required in the header',
          'BAD_REQUEST',
          HttpStatus.BAD_REQUEST,
        );
      }

      const filterKeys = [
        'contentTrackingId',
        'userId',
        'courseId',
        'unitId',
        'contentId',
        'tenantId',
      ];
      const paginationKeys = ['pageSize', 'page'];
      const sortKeys = ['field', 'order'];
      const orderValue = ['asc', 'desc'];
      const orderField = [
        'contentTrackingId',
        'userId',
        'courseId',
        'unitId',
        'contentId',
        'contentType',
        'contentMime',
        'createdOn',
        'lastAccessOn',
        'updatedOn',
      ];

      const { pagination, sort, filters } = searchContentTrackingDto;
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

      // Always add tenantId to whereClause for tenant isolation
      whereClause['tenantId'] = tenantId;

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
        whereClause['contentTrackingId'] &&
        !isUUID(whereClause['contentTrackingId'])
      ) {
        this.loggerService.error(
          'Invalid Content Tracking ID format. It must be a valid UUID.',
          'BAD_REQUEST',
          apiId,
        );
        return APIResponse.error(
          response,
          apiId,
          'Invalid Content Tracking ID format. It must be a valid UUID.',
          'Please enter a valid UUID.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const [result, total] = await this.contentTrackingRepository.findAndCount(
        {
          where: whereClause,
          order: orderOption,
          skip: offset,
          take: limit,
        },
      );
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
      this.loggerService.log('Content data fetched successfully.', apiId);
      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        'Content data fetched successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(errorMessage, 'INTERNAL_SERVER_ERROR', apiId);
      return APIResponse.error(
        response,
        apiId,
        'Failed to fetch content data.',
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

  public async deleteContentTracking(
    request: any,
    contentTrackingId: string,
    response: Response,
  ) {
    const apiId = 'api.delete.content';
    try {
      // Extract tenantId from request headers
      const tenantId = request.headers.tenantId || request.headers.tenantid || request.headers['x-tenant-id'] || null;
      
      // Validate tenantId is required
      if (!tenantId) {
        this.loggerService.error(
          'tenantId is required in the header',
          'BAD_REQUEST',
          apiId,
        );
        return APIResponse.error(
          response,
          apiId,
          'tenantId is required in the header',
          'BAD_REQUEST',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!isUUID(contentTrackingId)) {
        return APIResponse.error(
          response,
          apiId,
          'Please entire valid UUID.',
          'Please entire valid UUID.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const getContentData = await this.contentTrackingRepository.findOne({
        where: {
          contentTrackingId: contentTrackingId,
        },
      });

      if (!getContentData) {
        this.loggerService.error(
          'Tracking Id not found.',
          'NOT_FOUND',
          apiId,
          contentTrackingId,
        );
        return APIResponse.error(
          response,
          apiId,
          'Tracking Id not found.',
          'Tracking Id not found.',
          HttpStatus.NOT_FOUND,
        );
      }

      const deleteContent = await this.contentTrackingRepository.delete({
        contentTrackingId: contentTrackingId,
      });
      const deleteContentDetail =
        await this.contentTrackingDetailRepository.delete({
          contentTrackingId: contentTrackingId,
        });
      if (deleteContent['affected'] > 0) {
        this.loggerService.log(
          'Content data deleted successfully.',
          apiId,
          contentTrackingId,
        );

        // Publish content tracking delete event to Kafka
        this.publishContentTrackingEvent('deleted', contentTrackingId, apiId, undefined, tenantId);

        return APIResponse.success(
          response,
          apiId,
          { data: `${contentTrackingId} is Deleted` },
          HttpStatus.OK,
          'Content data fetch successfully.',
        );
      }
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        errorMessage,
        'INTERNAL_SERVER_ERROR',
        apiId,
        contentTrackingId,
      );
      return APIResponse.error(
        response,
        apiId,
        'Failed to fetch content data.',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async courseInProgress(
    request: any,
    searchFilter: any,
    response: Response,
  ) {
    try {
      //userId
      let userIdArray = searchFilter?.userId;
      let userList = [];
      for (let i = 0; i < userIdArray.length; i++) {
        let userId = userIdArray[i];
        //get course id
        const result = await this.dataSource.query(
          `SELECT ct."courseId"
          FROM public.content_tracking ct
          JOIN public.content_tracking_details ctd
            ON ct."contentTrackingId" = ctd."contentTrackingId"
          WHERE ct."userId"=$1
            AND NOT EXISTS (
              SELECT 1
              FROM public.content_tracking_details ctd2
              WHERE ctd2."contentTrackingId" = ct."contentTrackingId"
                AND ctd2."eid" = 'END'
            )
          ORDER BY ctd."updatedOn" DESC
          LIMIT 10;`,
          [userId],
        );
        let seen = new Set();
        let uniqueCourseIds = [];
        if (result && result.length > 0) {
          result.forEach((item) => {
            if (!seen.has(item.courseId)) {
              seen.add(item.courseId);
              uniqueCourseIds.push(item);
            }
          });
        }
        userList.push({ userId: userId, courseIdList: uniqueCourseIds });
      }
      this.loggerService.log('success', 'courseinprogress');
      return response.status(200).send({
        success: true,
        message: 'success',
        data: userList,
      });
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.log(errorMessage, errorMessage, 'courseinprogress');
      return response.status(500).send({
        success: false,
        message: errorMessage,
        data: {},
      });
    }
  }

  private async publishContentTrackingEvent(
    eventType: 'created' | 'updated' | 'deleted',
    contentTrackingId: string,
    apiId: string,
    newDetailsOnly?: any[], // Add parameter for new details
    tenantId?: string // Add parameter for tenantId
  ): Promise<void> {
    try {
      let trackingData: any = {};
      
      if (eventType === 'deleted') {
        trackingData = {
          contentTrackingId,
          deletedAt: new Date().toISOString(),
          tenantId: tenantId
        };
      } else {
        try {
          const contentData = await this.contentTrackingRepository.findOne({
            where: { contentTrackingId }
          });

          // Use only new details if provided, otherwise get recent details from last 5 minutes
          let contentDetailsData;
          if (newDetailsOnly && newDetailsOnly.length > 0) {
            contentDetailsData = newDetailsOnly;
          } else {
            // Fallback: Get only details from the last 5 minutes to avoid historical accumulation
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            contentDetailsData = await this.contentTrackingDetailRepository.find({
              where: { 
                contentTrackingId,
                createdOn: MoreThan(fiveMinutesAgo)
              },
              order: { createdOn: 'DESC' }
            });
          }

          trackingData = {
            ...contentData,
            details: contentDetailsData,
            tenantId: tenantId || contentData?.tenantId || null
          };
        } catch (error) {
          trackingData = { contentTrackingId };
        }
      }
            
      await this.kafkaService.publishContentTrackingEvent(eventType, trackingData, contentTrackingId);
    } catch (error) {
      // Handle/log error silently to not break the main flow
      this.loggerService.error(`Failed to publish content tracking event: ${error.message}`, error.stack, apiId);
    }
  }
}
