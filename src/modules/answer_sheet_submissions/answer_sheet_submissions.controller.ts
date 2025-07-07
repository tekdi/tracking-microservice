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
import { AnswerSheetSubmissionsCreateDto } from './dto/answer-sheet-submissions-create-dto';
import { AnswerSheetSubmissionsService } from './answer_sheet_submissions.service';

@Controller('answer-sheet-submissions')
@ApiTags('answer-sheet-submissions')
export class AnswerSheetSubmissionsController {
  constructor(
    private readonly answerSheetSubmissionsService: AnswerSheetSubmissionsService,
  ) {}

  @Get('read/:answerSheetSubmissionId')
  @ApiOkResponse({
    description: 'Answer Sheet Submission details fetched successfully',
  })
  @ApiNotFoundResponse({ description: 'Answer Sheet Submission Not Found' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  public async getAnswerSheetSubmissionDetails(
    @Param('answerSheetSubmissionId') answerSheetSubmissionId: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.answerSheetSubmissionsService.getAnswerSheetSubmissionDetails(
      request,
      answerSheetSubmissionId,
      response,
    );
  }

  @Post('create')
  @ApiCreatedResponse({
    description: 'Answer Sheet Submission has been created successfully.',
  })
  @ApiBody({ type: AnswerSheetSubmissionsCreateDto })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
  @ApiConflictResponse({ description: 'Duplicate data.' })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  async createAnswerSheetSubmission(
    @Req() request: Request,
    @Body() createAnswerSheetSubmissionDto: AnswerSheetSubmissionsCreateDto,
    @Res() response: Response,
  ) {
    return this.answerSheetSubmissionsService.createAnswerSheetSubmission(
      request,
      createAnswerSheetSubmissionDto,
      response,
    );
  }

  // @Post('search')
  // async searchAnswerSheetSubmission(
  //   @Req() request: Request,
  //   @Body() searchFilter: any,
  //   @Res() response: Response,
  // ) {
  //   return this.answerSheetSubmissionsService.searchAnswerSheetSubmission(
  //     request,
  //     searchFilter,
  //     response,
  //   );
  // }

  // @Post('search/status')
  // async searchStatusAnswerSheetSubmission(
  //   @Req() request: Request,
  //   @Body() searchFilter: any,
  //   @Res() response: Response,
  // ) {
  //   return this.answerSheetSubmissionsService.searchStatusAnswerSheetSubmission(
  //     request,
  //     searchFilter,
  //     response,
  //   );
  // }

  // @Post('/list')
  // @ApiOkResponse({ description: 'Answer Sheet Submission data fetch successfully.' })
  // @ApiBody({ type: SearchAnswerSheetSubmissionDto })
  // @ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
  // @ApiBadRequestResponse({ description: 'Bad Request' })
  // async searchAnswerSheetSubmissionRecords(
  //   @Req() request: Request,
  //   @Body() searchAnswerSheetSubmissionDto: SearchAnswerSheetSubmissionDto,
  //   @Res() response: Response,
  // ) {
  //   return this.answerSheetSubmissionsService.searchAnswerSheetSubmissionRecords(
  //     request,
  //     searchAnswerSheetSubmissionDto,
  //     response,
  //   );
  // }

  // @Delete('delete/:answerSheetSubmissionId')
  // @ApiOkResponse({ description: 'Answer Sheet Submission deleted successfully.' })
  // @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  // @ApiBadRequestResponse({ description: 'Bad Request.' })
  // @ApiNotFoundResponse({ description: 'Answer Sheet Submission Not Found.' })
  // async deleteAnswerSheetSubmission(
  //   @Param('answerSheetSubmissionId') answerSheetSubmissionId: string,
  //   @Req() request: Request,
  //   @Res() response: Response,
  // ) {
  //   return this.answerSheetSubmissionsService.deleteAnswerSheetSubmission(
  //     request,
  //     answerSheetSubmissionId,
  //     response,
  //   );
  // }

  @Patch('update-status/:Id')
  @ApiOkResponse({
    description: 'Answer Sheet Submission status updated successfully.',
  })
  @ApiNotFoundResponse({ description: 'Answer Sheet Submission Not Found.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  async updateStatus(
    @Param('Id') Id: string,
    @Body('status') status: 'PROCESSING' | 'COMPLETED' | 'FAILED',
    @Body('message') responseMessage: string,
    @Res() response: Response,
  ) {
    return this.answerSheetSubmissionsService.updateStatusByQuestionSetId(
      Id,
      status,
      responseMessage,
      response,
    );
  }
}
