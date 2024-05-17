import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AssessmentTracking } from "src/modules/tracking_assesment/entities/tracking-assessment-entity";
import { Repository } from "typeorm";
import { CreateAssessmentTrackingDto } from "./dto/traking-assessment-create-dto";
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { SearchAssessmentTrackingDto } from "./dto/traking-assessment-search-dto";
import { isUUID } from 'class-validator';

@Injectable()
export class TrackingAssesmentService {

  constructor(
    @InjectRepository(AssessmentTracking)
    private assessmentTrackingRepository: Repository<AssessmentTracking>,
  ) { }

  public async getAssessmentTrackingDetails(
    request:any, assessmentId:string,response: Response
  ) {
    const apiId = 'api.get.assessment';
    if(!isUUID(assessmentId)){
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
    try{
      const result = await this.assessmentTrackingRepository.findOne({
        where: {
          assessmentTrackingId:assessmentId
        }
      })

      if(!result){
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
    }catch(e){
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
      if(!isUUID(createAssessmentTrackingDto.userId)){
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
      const { pagination, sort, filters } = searchAssessmentTrackingDto;
      const limit = pagination?.pageSize;
      const page = pagination?.page;
      const orderBy = sort?.field;
      const order = sort?.order;


      let offset = 0;
      if (page > 1) {
        offset = (limit) * (page - 1);
      }

      const whereClause = {};
      if (filters && Object.keys(filters).length > 0) {
        Object.entries(filters).forEach(([key, value]) => {
          whereClause[key] = value;
        });
      }

      if(whereClause['user_id']){
        if(!isUUID(whereClause['user_id'])){
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
      }


      if(whereClause['assessment_tracking_id']){
        if(!isUUID(whereClause['assessment_tracking_id'])){
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
      }

      
      let orderOption = {};
      if(orderBy && order){
        orderOption[orderBy] = order.toUpperCase();;
      }
      const result = await this.assessmentTrackingRepository.find({
        where: whereClause,
        order: orderOption,
        skip: offset,
        take: limit,
      })

      if(result.length == 0){
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

}

