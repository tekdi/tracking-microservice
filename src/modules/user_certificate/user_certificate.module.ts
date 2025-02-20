import { Module } from '@nestjs/common';
import { UserCertificateController } from './user_certificate.contoller';
import { UserCertificateService } from './user_certificate.service.';

import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCourseCertificate } from '../certificate/entities/user_course_certificate';
import { LoggerService } from 'src/common/logger/logger.service';
@Module({
  imports: [TypeOrmModule.forFeature([UserCourseCertificate])],
  controllers: [UserCertificateController],
  providers: [UserCertificateService, LoggerService],
})
export class UserCertificateModule {}
