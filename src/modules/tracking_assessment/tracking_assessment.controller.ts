import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  SerializeOptions,
  Post,
  Body,
  Delete,
  UseInterceptors,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
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
  ApiTags,
} from '@nestjs/swagger';
import { CreateAssessmentTrackingDto } from './dto/tracking-assessment-create-dto';
import { SearchAssessmentTrackingDto } from './dto/tracking-assessment-search-dto';
import { TrackingAssessmentService } from './tracking_assessment.service';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { CheckSubmissionStatusDto } from '../ai_assessment/dto/check-submission-status-dto';
import { TenantGuard } from 'src/common/guards/tenant.guard';
//import { AllExceptionsFilter } from 'src/common/utils/exception.filter';

@Controller('assessment')
@ApiTags('tracking')
@UseGuards(TenantGuard)
export class TrackingAssessmentController {
  constructor(
    private readonly trackingAssessmentService: TrackingAssessmentService,
  ) {}

  //Get Assessment by Id
  //@UseFilters(new AllExceptionsFilter())
  @Get('read/:assessmentTrackingId')
  @ApiOkResponse({ description: 'Assessment details fetched successfully' })
  @ApiNotFoundResponse({ description: 'Assessment Not Found' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  @UseInterceptors(CacheInterceptor)
  public async getAssessmentTrackingDetails(
    @Param('assessmentTrackingId') assessmentTrackingId: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.trackingAssessmentService.getAssessmentTrackingDetails(
      request,
      assessmentTrackingId,
      response,
    );
  }

  //Create Assessment
  //@UseFilters(new AllExceptionsFilter())
  @Post('create')
  @ApiCreatedResponse({
    description: 'Assessment has been created successfully.',
  })
  @ApiBody({ type: CreateAssessmentTrackingDto })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
  @ApiConflictResponse({ description: 'Duplicate data.' })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  async createAssessmentTracking(
    @Req() request: Request,
    @Body() createAssessmentTrackingDto: CreateAssessmentTrackingDto,
    @Res() response: Response,
  ) {
    return this.trackingAssessmentService.createAssessmentTracking(
      request,
      createAssessmentTrackingDto,
      response,
    );
  }

  // Assessment
  //@UseFilters(new AllExceptionsFilter())
  @Post('search')
  async searchAssessmentTracking(
    @Req() request: Request,
    @Body() searchFilter: any,
    @Res() response: Response,
  ) {
    return this.trackingAssessmentService.searchAssessmentTracking(
      request,
      searchFilter,
      response,
    );
  }

  // Assessment
  //@UseFilters(new AllExceptionsFilter())
  @Post('search/status')
  async searchStatusAssessmentTracking(
    @Req() request: Request,
    @Body() searchFilter: any,
    @Res() response: Response,
  ) {
    return this.trackingAssessmentService.searchStatusAssessmentTracking(
      request,
      searchFilter,
      response,
    );
  }

  //Search Assessment
  //@UseFilters(new AllExceptionsFilter())
  @Post('/list')
  @ApiOkResponse({ description: 'Assessment data fetch successfully.' })
  @ApiBody({ type: SearchAssessmentTrackingDto })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  async searchAssessmentRecords(
    @Req() request: Request,
    @Body() searchAssessmentTrackingDto: SearchAssessmentTrackingDto,
    @Res() response: Response,
  ) {
    console.log(
      'searchAssessmentRecords: ' + JSON.stringify(searchAssessmentTrackingDto),
    );
    return this.trackingAssessmentService.searchAssessmentRecords(
      request,
      searchAssessmentTrackingDto,
      response,
    );
  }
  //Delete Assessment
  // @UseFilters(new AllExceptionsFilter())
  @Delete('delete/:assessmentTrackingId')
  @ApiOkResponse({ description: 'Assessment tracking deleted successfully.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @ApiNotFoundResponse({ description: 'Assessment Not Found.' })
  async deleteAssessmentTracking(
    @Param('assessmentTrackingId') assessmentTrackingId: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.trackingAssessmentService.deleteAssessmentTracking(
      request,
      assessmentTrackingId,
      response,
    );
  }
  //check offline assessment uploaded
  //Search Assessment
  //@UseFilters(new AllExceptionsFilter())
  @Post('/offline-assessment-status')
  @ApiOkResponse({ description: ' ' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  async offlineAssessmentCheck(
    @Req() request: Request,
    @Body() object: CheckSubmissionStatusDto,
    @Res() response: Response,
  ) {
    return this.trackingAssessmentService.offlineAssessmentCheck(
      request,
      object,
      response,
    );
  }

  //Update assessment
  @Post('update/:assessmentTrackingId')
  @ApiOkResponse({ description: 'Assessment updated successfully.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  async updateAssessmentTracking(
    @Param('assessmentTrackingId') assessmentTrackingId: string,
    @Req() request: Request,
    @Body() updateData: any,
    @Res() response: Response,
  ) {
    return this.trackingAssessmentService.updateAssessmentTracking(
      request,
      assessmentTrackingId,
      updateData,
      response,
    );
  }
}
