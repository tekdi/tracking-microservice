import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  Post,
  Body,
  Patch,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AiAssessmentCreateDto } from './dto/ai-assessment-create-dto';
import { AiAssessmentService } from './ai_assessment.service';

@Controller('ai-assessment')
@ApiTags('ai-assessment')
export class AiAssessmentController {
  constructor(private readonly aiAssessmentService: AiAssessmentService) {}

  @Get('read/:aiAssessmentId')
  @ApiOkResponse({ description: 'AI Assessment details fetched successfully' })
  @ApiNotFoundResponse({ description: 'AI Assessment Not Found' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  public async getAiAssessmentDetails(
    @Param('aiAssessmentId') aiAssessmentId: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.aiAssessmentService.getAiAssessmentDetails(
      request,
      aiAssessmentId,
      response,
    );
  }

  @Post('create')
  @ApiCreatedResponse({
    description: 'AI Assessment has been created successfully.',
  })
  @ApiBody({ type: AiAssessmentCreateDto })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
  @ApiConflictResponse({ description: 'Duplicate data.' })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  async createAiAssessment(
    @Req() request: Request,
    @Body() createAiAssessmentDto: AiAssessmentCreateDto,
    @Res() response: Response,
  ) {
    return this.aiAssessmentService.createAiAssessment(
      request,
      createAiAssessmentDto,
      response,
    );
  }

  @Post('search')
  async searchAiAssessment(
    @Req() request: Request,
    @Body() searchFilter: any,
    @Res() response: Response,
  ) {
    return this.aiAssessmentService.searchAiAssessment(
      request,
      searchFilter,
      response,
    );
  }

  // @Post('search/status')
  // async searchStatusAiAssessment(
  //   @Req() request: Request,
  //   @Body() searchFilter: any,
  //   @Res() response: Response,
  // ) {
  //   return this.aiAssessmentService.searchStatusAiAssessment(
  //     request,
  //     searchFilter,
  //     response,
  //   );
  // }

  // @Post('/list')
  // @ApiOkResponse({ description: 'AI Assessment data fetch successfully.' })
  // @ApiBody({ type: SearchAiAssessmentDto })
  // @ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
  // @ApiBadRequestResponse({ description: 'Bad Request' })
  // async searchAiAssessmentRecords(
  //   @Req() request: Request,
  //   @Body() searchAiAssessmentDto: SearchAiAssessmentDto,
  //   @Res() response: Response,
  // ) {
  //   return this.aiAssessmentService.searchAiAssessmentRecords(
  //     request,
  //     searchAiAssessmentDto,
  //     response,
  //   );
  // }

  // @Delete('delete/:aiAssessmentId')
  // @ApiOkResponse({ description: 'AI Assessment deleted successfully.' })
  // @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  // @ApiBadRequestResponse({ description: 'Bad Request.' })
  // @ApiNotFoundResponse({ description: 'AI Assessment Not Found.' })
  // async deleteAiAssessment(
  //   @Param('aiAssessmentId') aiAssessmentId: string,
  //   @Req() request: Request,
  //   @Res() response: Response,
  // ) {
  //   return this.aiAssessmentService.deleteAiAssessment(
  //     request,
  //     aiAssessmentId,
  //     response,
  //   );
  // }

  @Patch('update-status/:questionSetId')
  @ApiOkResponse({ description: 'AI Assessment status updated successfully.' })
  @ApiNotFoundResponse({ description: 'AI Assessment Not Found.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  async updateStatus(
    @Param('questionSetId') questionSetId: string,
    @Body('status') status: 'PROCESSING' | 'COMPLETED' | 'FAILED',
    @Body('message') responseMessage: string | null,
    @Res() response: Response,
  ) {
    return this.aiAssessmentService.updateStatusByQuestionSetId(
      questionSetId,
      status,
      responseMessage,
      response,
    );
  }
  //webhook to update questionset
  @Post('update_question_set')
  @ApiOkResponse({ description: 'AI Assessment status updated successfully.' })
  @ApiNotFoundResponse({ description: 'AI Assessment Not Found.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  async updateQuestionSet(
    @Body('questionSetId') questionSetId: string,
    @Res() response: Response,
  ) {
    return this.aiAssessmentService.updateQuestionSet(questionSetId, response);
  }
}
