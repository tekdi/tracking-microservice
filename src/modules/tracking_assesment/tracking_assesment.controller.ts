import { 
  Controller, 
  Get, 
  Param, 
  Req, 
  Res, 
  SerializeOptions, 
  Headers, 
  Post, 
  Body } from '@nestjs/common';
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
  ApiTags } from '@nestjs/swagger';
import { CreateAssessmentTrackingDto } from "./dto/traking-assessment-create-dto";
import { SearchAssessmentTrackingDto } from "./dto/traking-assessment-search-dto";
import { TrackingAssesmentService } from "./tracking_assesment.service";

@Controller('tracking-assesment')
@ApiTags("tracking")
export class TrackingAssesmentController {
  constructor(private readonly trackingAssesmentService: TrackingAssesmentService) { }

  //Get Assessment by Id
  @Get("/:assessmentId")
  @ApiOkResponse({ description: "Assessment detais Fetched Succcessfully" })
  @ApiNotFoundResponse({ description: "Assessment Not Found" })
  @ApiInternalServerErrorResponse({ description: "Internal Server Error." })
  @ApiBadRequestResponse({ description: "Bad Request" })
  @SerializeOptions({ strategy: "excludeAll", })
  public async getAssessmentTrackingDetails(
    @Param("assessmentId") assessmentId: string,
    @Req() request: Request,
    @Res() response: Response
  ) {
    return this.trackingAssesmentService.getAssessmentTrackingDetails(request, assessmentId, response);
  }

  //Create Assessment 
  @Post()
  @ApiCreatedResponse({ description: "Assessment has been created successfully." })
  @ApiBody({ type: CreateAssessmentTrackingDto })
  @ApiInternalServerErrorResponse({ description: "Internal Server Error" })
  @ApiConflictResponse({ description: "Duplicate data." })
  async createAssessmentTracking(
    @Req() request: Request,
    @Body() createAssessmentTrackingDto: CreateAssessmentTrackingDto,
    @Res() response: Response
  ) {
    return this.trackingAssesmentService.createAssessmentTracking(request, createAssessmentTrackingDto, response);
  }


  //Search Assessment 
  @Post("/list")
  @ApiOkResponse({ description: "Assessment data fetch successfully." })
  @ApiBody({ type: SearchAssessmentTrackingDto })
  @ApiInternalServerErrorResponse({ description: "Internal Server Error" })
  @ApiConflictResponse({ description: "Duplicate data." })
  async searchAssessmentRecords(
    @Req() request: Request,
    @Body() searchAssessmentTrackingDto: SearchAssessmentTrackingDto,
    @Res() response: Response
  ) {
    return this.trackingAssesmentService.searchAssessmentRecords(request, searchAssessmentTrackingDto, response);
  }
}
