import { Controller, Post, Body, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiBadRequestResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { UserCertificateService } from './user_certificate.service..js';
import { CreateCertificateDto } from './dto/create-user-certificate-dto.js';
import { CreateUserCourseCertificateDto } from './dto/create-user-course-certificate.dto.js';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard.ts';

@Controller('user_certificate')
@UseGuards(JwtAuthGuard)
export class UserCertificateController {
  constructor(
    private readonly userCertificateService: UserCertificateService,
  ) {}

  @ApiOkResponse({ description: 'User enrolled for course successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('status/create')
  async enrollUserForCourse(
    @Body() createUserCertificateDto: CreateCertificateDto,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return this.userCertificateService.enrollUserForCourse(
      createUserCertificateDto,
      response,
      request,
    );
  }
  @ApiOkResponse({
    description: 'User status for course successfully updated to completed.',
  })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('status/update')
  async updateUserStatusForCourse(
    @Body() createUserCertificateDto: CreateCertificateDto,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return this.userCertificateService.updateUserStatusForCourse(
      createUserCertificateDto,
      response,
      request,
    );
  }
  @ApiOkResponse({
    description: 'User status for course fetched successfully',
  })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('status/get')
  async fetchUserStatusForCourse(
    @Body() createUserCertificateDto: CreateCertificateDto,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return this.userCertificateService.fetchUserStatusForCourse(
      createUserCertificateDto,
      response,
      request,
    );
  }
  @ApiOkResponse({
    description: 'Users status for courses fetched successfully',
  })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('status/search')
  async searchUsersCourses(
    @Body() searchObj: Record<string, any>,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return this.userCertificateService.searchUsersCourses(
      searchObj,
      response,
      request,
    );
  }
  //import user importUserDataForCertificate
  @ApiOkResponse({ description: 'User added for course successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('import/user')
  async importUserDataForCertificate(
    @Body() createUserCertificateDto: CreateUserCourseCertificateDto,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return this.userCertificateService.importUserDataForCertificate(
      createUserCertificateDto,
      response,
      request,
    );
  }
}
