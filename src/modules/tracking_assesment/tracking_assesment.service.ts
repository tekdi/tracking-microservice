import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AssessmentTracking } from "src/modules/tracking_assesment/entities/tracking-assessment-entity";
import { Repository } from "typeorm";
import { CreateAssessmentTrackingDto } from "./dto/traking-assessment-create-dto";
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { SearchAssessmentTrackingDto } from "./dto/traking-assessment-search-dto";

@Injectable()
export class TrackingAssesmentService {

  constructor(
    @InjectRepository(AssessmentTracking)
    private assessmentTrackingRepository: Repository<AssessmentTracking>,
  ) { }

  public async getAssessmentDetails(
    request:any, assessmentId:string,response: Response
  ) {
    const apiId = 'api.get.assessment';
    try{
      const result = await this.assessmentTrackingRepository.findOne({
        where: {
          assessment_tracking_id:assessmentId
        }
      })
      
      return response
      .status(HttpStatus.OK)
      .send(APIResponse.success(apiId, result, "Assessment data fetch successfully."));
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

  public async createAssessment(
    request: any, createAssessmentTrackingDto: CreateAssessmentTrackingDto, response: Response
  ): Promise<Response> {
    const apiId = 'api.create.assessment';
    try {
      const result = await this.assessmentTrackingRepository.save(createAssessmentTrackingDto)
      return response
        .status(HttpStatus.CREATED)
        .send(APIResponse.success(apiId, { assessment_ID: result.assessment_tracking_id }, 'Assessment submitted successfully.'));
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

  public async searchAssessment(
    request: any,
    searchAssessmentTrackingDto: SearchAssessmentTrackingDto,
    response: Response
  ) {
    const apiId = 'api.list.assessment';

    try {
      let limit = searchAssessmentTrackingDto['pagination']['pageSize'];
      let page = searchAssessmentTrackingDto['pagination']['page'];
      let orderBy = searchAssessmentTrackingDto['sort']['field'];
      let order = searchAssessmentTrackingDto['sort']['order'];
      let filters = searchAssessmentTrackingDto['filters'];

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

      return response
      .status(HttpStatus.OK)
      .send(APIResponse.success(apiId, result, "Assessment data fetch successfully."));

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

}

