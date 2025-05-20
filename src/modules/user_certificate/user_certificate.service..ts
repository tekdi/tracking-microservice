import { HttpStatus, Injectable } from '@nestjs/common';
import { Response } from 'express';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCourseCertificate } from '../certificate/entities/user_course_certificate';
import { CreateCertificateDto } from './dto/create-user-certificate-dto';
import APIResponse from 'src/common/utils/response';
import { LoggerService } from 'src/common/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { CreateUserCourseCertificateDto } from './dto/create-user-course-certificate.dto';
const axios = require('axios');

@Injectable()
export class UserCertificateService {
  constructor(
    @InjectRepository(UserCourseCertificate)
    private userCourseCertificateRepository: Repository<UserCourseCertificate>,
    private loggerService: LoggerService,
    private configService: ConfigService,
  ) {}

  async enrollUserForCourse(
    createUserCertificateDto: CreateCertificateDto,
    response: Response,
    request: Request,
  ) {
    let apiId = 'api.create.userEnrollment';
    const tenantId = request.headers['tenantid'];
    if (!tenantId) {
      return APIResponse.error(
        response,
        apiId,
        'tenantId is required in the header',
        'BAD_REQUEST',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      // Save the user certificate object to the database
      let data = new UserCourseCertificate();
      data.userId = createUserCertificateDto.userId;
      data.courseId = createUserCertificateDto.courseId;
      data.tenantId = tenantId;
      data.status = 'enrolled';
      data.createdOn = new Date();
      data.updatedOn = new Date();

      //check if record with tenantId, userId and courseId exist
      const userCertificate =
        await this.userCourseCertificateRepository.findOne({
          where: {
            userId: data.userId,
            courseId: data.courseId,
            tenantId: data.tenantId,
          },
        });
      if (userCertificate) {
        return APIResponse.error(
          response,
          apiId,
          'User already enrolled for course',
          'User already enrolled for course',
          HttpStatus.OK,
        );
      }
      const result = await this.userCourseCertificateRepository.save(data);

      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        'User enrolled for course successfully',
      );
    } catch (error) {
      this.loggerService.error(
        'Error while enrolling user to the course',
        error,
      );
      return APIResponse.error(
        response,
        apiId,
        'Error creating user certificate',
        'BAD_REQUEST',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  async updateUserStatusForCourse(data, response, request: Request) {
    let apiId = 'api.update.courseStatus';
    const tenantId = request.headers['tenantid'];
    if (!data.status) {
      data.status = 'completed';
    }
    if (!tenantId) {
      return APIResponse.error(
        response,
        apiId,
        'tenantId is required in the header',
        'BAD_REQUEST',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const userCertificate =
        await this.userCourseCertificateRepository.findOne({
          where: {
            userId: data.userId,
            courseId: data.courseId,
            tenantId: tenantId,
          },
        });
      if (userCertificate) {
        userCertificate.certificateId = data.certificateId;
        userCertificate.issuedOn = data.issuedOn;
        userCertificate.status = data.status;
        userCertificate.updatedOn = new Date();
        let updateResult =
          await this.userCourseCertificateRepository.save(userCertificate);
        if (updateResult) {
          this.loggerService.log(
            'User status for course successfully updated to ' + data.status,
          );
          return APIResponse.success(
            response,
            apiId,
            updateResult,
            HttpStatus.OK,
            'User status for course successfully updated to ' + data.status,
          );
        }
      } else {
        this.loggerService.error(
          'User enrollment for course not exists',
          'User enrollment for course not exists',
        );
        return APIResponse.error(
          response,
          apiId,
          'User enrollment for course not exists',
          'BAD_REQUEST',
          HttpStatus.OK,
        );
      }
    } catch (error) {
      this.loggerService.error(
        'Error while updating user status for course',
        error,
      );
      return APIResponse.error(
        response,
        apiId,
        'Error while updating user status for course',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async fetchUserStatusForCourse(data, response, request: Request) {
    let apiId = 'api.get.courseStatus';
    const tenantId = request.headers['tenantid'];
    if (!tenantId) {
      return APIResponse.error(
        response,
        apiId,
        'tenantId is required in the header',
        'BAD_REQUEST',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const userCertificate =
        await this.userCourseCertificateRepository.findOne({
          where: {
            userId: data.userId,
            courseId: data.courseId,
            tenantId: data.tenantId,
          },
        });
      if (userCertificate) {
        this.loggerService.log('User status for course fetched successfully');
        return APIResponse.success(
          response,
          apiId,
          userCertificate,
          HttpStatus.OK,
          'User status for course fetched successfully',
        );
      } else {
        return APIResponse.error(
          response,
          apiId,
          'User enrollment for course not exists',
          'BAD_REQUEST',
          HttpStatus.OK,
        );
      }
    } catch (error) {
      this.loggerService.error(
        'Error while fetching user status for course',
        error,
      );
      return APIResponse.error(
        response,
        apiId,
        'Error while fetching user status for course',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async searchUsersCourses(searchObj, response, request) {
    const filters = searchObj.filters;
    let apiId = 'api.get.searchList';
    try {
      const queryBuilder =
        this.userCourseCertificateRepository.createQueryBuilder(
          'UserCourseCertificate',
        );

      // Dynamically build query based on filters object
      Object.keys(filters).forEach((key) => {
        const value = filters[key];

        if (Array.isArray(value) && value.length > 0) {
          // Array filter - use IN clause
          queryBuilder.andWhere(
            `UserCourseCertificate.${key} IN (:...${key})`,
            {
              [key]: value,
            },
          );
        } else if (value) {
          // Single value filter - use equality
          queryBuilder.andWhere(`UserCourseCertificate.${key} = :${key}`, {
            [key]: value,
          });
        }
      });
      const count = await queryBuilder.getCount();
      //queryBuilder.limit(searchObj.limit).offset(searchObj.offset);
      const result = await queryBuilder.getMany();
      this.loggerService.log('Users status for courses fetched successfully');
      return APIResponse.success(
        response,
        apiId,
        {
          data: result,
          count: count,
        },
        HttpStatus.OK,
        'Users status for courses fetched successfully',
      );
    } catch (error) {
      this.loggerService.error(
        'Error while fetching user status for courses',
        error,
      );
      return APIResponse.error(
        response,
        apiId,
        'Error while fetching user status for courses',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  //import user
  async importUserDataForCertificate(
    createUserCertificateDto: CreateUserCourseCertificateDto,
    response: Response,
    request: Request,
  ) {
    let apiId = 'api.import.userCertificate';
    const tenantId = request.headers['tenantid'];
    if (!tenantId) {
      return APIResponse.error(
        response,
        apiId,
        'tenantId is required in the header',
        'BAD_REQUEST',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      //check if record with tenantId, userId and courseId exist
      const userCertificate =
        await this.userCourseCertificateRepository.findOne({
          where: {
            userId: createUserCertificateDto.userId,
            courseId: createUserCertificateDto.courseId,
            tenantId: createUserCertificateDto.tenantId,
          },
        });
      if (userCertificate) {
        return APIResponse.error(
          response,
          apiId,
          'User already exists for course',
          'User already exists for course',
          HttpStatus.OK,
        );
      }
      const result = await this.userCourseCertificateRepository.save(
        createUserCertificateDto,
      );

      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        'User added for course successfully',
      );
    } catch (error) {
      this.loggerService.error('Error while adding user for the course', error);
      return APIResponse.error(
        response,
        apiId,
        'Error creating user certificate',
        'BAD_REQUEST',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
