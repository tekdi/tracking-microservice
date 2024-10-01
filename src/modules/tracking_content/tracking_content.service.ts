import {
  BadRequestException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ContentTracking } from 'src/modules/tracking_content/entities/tracking-content-entity';
import { ContentTrackingDetail } from 'src/modules/tracking_content/entities/tracking-content-details-entity';
import { Repository } from 'typeorm';
import { CreateContentTrackingDto } from './dto/tracking-content-create-dto';
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { SearchContentTrackingDto } from './dto/tracking-content-search-dto';
import { IsUUID, isUUID } from 'class-validator';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

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
  ) {
    this.ttl = this.configService.get('TTL');
  }

  public async getContentTrackingDetails(
    request: any,
    contentTrackingId: string,
    response: Response,
  ) {
    const apiId = 'api.get.contentTrackingId';
    if (!isUUID(contentTrackingId)) {
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
      const cachedData: any = await this.cacheService.get(contentTrackingId);
      if (cachedData) {
        return APIResponse.success(
          response,
          apiId,
          cachedData,
          HttpStatus.OK,
          'Content data fetch successfully.',
        );
      }
      const result = await this.findContent(contentTrackingId);
      if (!result) {
        return APIResponse.error(
          response,
          apiId,
          'No data found.',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }
      await this.cacheService.set(contentTrackingId, result, ttl);
      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        'Content data fetch successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      return APIResponse.error(
        response,
        apiId,
        'Something went wrong in content creation',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async findContent(contentTrackingId) {
    const result = await this.contentTrackingRepository.findOne({
      where: {
        contentTrackingId: contentTrackingId,
      },
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
      const allowedKeys = [
        'contentTrackingId',
        'userId',
        'courseId',
        'batchId',
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
        return APIResponse.error(
          response,
          apiId,
          `Invalid Key ${errors.join(', ')}`,
          JSON.stringify('Invalid Key.'),
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!isUUID(createContentTrackingDto.userId)) {
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

      //find contentTracking
      const result_content = await this.dataSource.query(
        `SELECT "contentTrackingId" FROM content_tracking WHERE "userId"=$1 and "contentId"=$2 and "batchId"=$3 and "courseId"=$4 and "unitId"=$5`,
        [
          createContentTrackingDto?.userId,
          createContentTrackingDto?.contentId,
          createContentTrackingDto?.batchId,
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
      } catch (e) {
        //Error in CreateDetail!
        console.log(e);
      }
      return APIResponse.success(
        response,
        apiId,
        { contentTrackingId: contentTrackingId },
        HttpStatus.CREATED,
        'Content submitted successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
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
      let output_result = [];
      const result = await this.dataSource.query(
        `SELECT "contentTrackingId","userId","courseId","batchId","contentId","contentType","contentMime","createdOn","lastAccessOn","updatedOn","unitId" FROM content_tracking WHERE "userId"=$1 and "contentId"=$2 and "batchId"=$3 and "courseId"=$4 and "unitId"=$5`,
        [
          searchFilter?.userId,
          searchFilter?.contentId,
          searchFilter?.batchId,
          searchFilter?.courseId,
          searchFilter?.unitId,
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
      return response.status(200).send({
        success: true,
        message: 'success',
        data: output_result,
      });
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
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
                  "batchId",
                  "contentId",
                  "contentType",
                  "contentMime",
                  "createdOn",
                  "lastAccessOn",
                  "updatedOn",
                  "unitId",
                  ROW_NUMBER() OVER (PARTITION BY "userId", "batchId", "courseId", "unitId", "contentId" ORDER BY "createdOn" DESC) as row_num
              FROM 
                  content_tracking
              WHERE 
                  "userId" = $1 
                  AND "courseId" IN (${courseId_text}) 
                  AND "unitId" IN (${unitId_text}) 
                  AND "contentId" IN (${contentId_text}) 
                  AND "batchId" = $2
          )
          SELECT 
              "contentTrackingId",
              "userId",
              "courseId",
              "batchId",
              "contentId",
              "contentType",
              "contentMime",
              "createdOn",
              "lastAccessOn",
              "updatedOn",
              "unitId"
          FROM 
              latest_content
          WHERE 
              row_num = 1;`,
          [userId, searchFilter?.batchId],
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

      return response.status(200).send({
        success: true,
        message: 'success',
        data: output_result,
      });
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
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
            `SELECT "contentTrackingId","userId","courseId","lastAccessOn","createdOn","updatedOn","contentId" FROM content_tracking WHERE "userId"=$1 and "courseId"=$2 order by "createdOn" asc;`,
            [userId, courseId],
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

      return response.status(200).send({
        success: true,
        message: 'success',
        data: userList,
      });
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
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
            `SELECT "contentTrackingId","userId","courseId","lastAccessOn","createdOn","updatedOn","contentId" FROM content_tracking WHERE "userId"=$1 and "courseId"=$2 and "unitId"=$3 order by "createdOn" asc;`,
            [userId, courseId, unitId],
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

      return response.status(200).send({
        success: true,
        message: 'success',
        data: userList,
      });
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
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
      const filterKeys = [
        'contentTrackingId',
        'userId',
        'courseId',
        'unitId',
        'batchId',
        'contentId',
      ];
      const paginationKeys = ['pageSize', 'page'];
      const sortKeys = ['field', 'order'];
      const orderValue = ['asc', 'desc'];
      const orderField = [
        'contentTrackingId',
        'userId',
        'courseId',
        'unitId',
        'batchId',
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
          return APIResponse.error(
            response,
            apiId,
            `Invalid key: ${invalidKey}`,
            'Invalid Key',
            HttpStatus.BAD_REQUEST,
          );
        } else {
          if (orderBy === '' || order === '') {
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
              return APIResponse.error(
                response,
                apiId,
                `Invalid sort order ${order}. Please use either 'asc' or 'desc'.`,
                'Invalid Sort Order.',
                HttpStatus.BAD_REQUEST,
              );
            }

            if (!orderField.includes(orderBy)) {
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
        return APIResponse.error(
          response,
          apiId,
          'No data found.',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }
      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        'Content data fetched successfully.',
      );
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
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
      return APIResponse.error(
        response,
        apiId,
        'Failed to fetch content data.',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
