import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  SerializeOptions,
  Post,
  Body,
  Delete
} from '@nestjs/common';
import { Response } from "express";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags
} from '@nestjs/swagger';
import { CreateAssessmentTrackingDto } from "./dto/tracking-assessment-create-dto";
import { SearchAssessmentTrackingDto } from "./dto/tracking-assessment-search-dto";
import { TrackingAssessmentService } from "./tracking_assessment.service";

@Controller('tracking-assessment')
@ApiTags("tracking")
export class TrackingAssessmentController {
  constructor(private readonly trackingAssessmentService: TrackingAssessmentService) { }

  //Get Assessment by Id
  @Get("/:assessmentTrackingId")
  @ApiOkResponse({ description: "Assessment details fetched successfully" })
  @ApiNotFoundResponse({ description: "Assessment Not Found" })
  @ApiInternalServerErrorResponse({ description: "Internal Server Error." })
  @ApiBadRequestResponse({ description: "Bad Request" })
  public async getAssessmentTrackingDetails(
    @Param("assessmentTrackingId") assessmentTrackingId: string,
    @Req() request: Request,
    @Res() response: Response
  ) {
    return this.trackingAssessmentService.getAssessmentTrackingDetails(request, assessmentTrackingId, response);
  }

  //Create Assessment 
  @Post()
  @ApiCreatedResponse({ description: "Assessment has been created successfully." })
  @ApiBody({ type: CreateAssessmentTrackingDto })
  @ApiInternalServerErrorResponse({ description: "Internal Server Error" })
  @ApiConflictResponse({ description: "Duplicate data." })
  @ApiBadRequestResponse({ description: "Bad Request" })
  async createAssessmentTracking(
    @Req() request: Request,
    @Body() createAssessmentTrackingDto: CreateAssessmentTrackingDto,
    @Res() response: Response
  ) {
    return this.trackingAssessmentService.createAssessmentTracking(request, createAssessmentTrackingDto, response);
  }


  //Search Assessment 
  @Post("/list")
  @ApiOkResponse({ description: "Assessment data fetch successfully." })
  @ApiBody({ type: SearchAssessmentTrackingDto })
  @ApiInternalServerErrorResponse({ description: "Internal Server Error" })
  @ApiBadRequestResponse({ description: "Bad Request" })
  async searchAssessmentRecords(
    @Req() request: Request,
    @Body() searchAssessmentTrackingDto: SearchAssessmentTrackingDto,
    @Res() response: Response
  ) {
    return this.trackingAssessmentService.searchAssessmentRecords(request, searchAssessmentTrackingDto, response);
  }


  //Delete Assessment 
  @Delete("/:assessmentTrackingId")
  @ApiOkResponse({ description: "Assessment tracking deleted successfully." })
  @ApiInternalServerErrorResponse({ description: "Internal Server Error." })
  @ApiBadRequestResponse({ description: "Bad Request." })
  @ApiNotFoundResponse({ description: "Assessment Not Found." })
  async deleteAssessmentTracking(
    @Param("assessmentTrackingId") assessmentTrackingId: string,
    @Req() request: Request,
    @Res() response: Response
  ) {
    return this.trackingAssessmentService.deleteAssessmentTracking(request, assessmentTrackingId, response);
  }
}
