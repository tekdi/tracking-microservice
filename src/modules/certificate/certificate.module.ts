import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { CertificateController } from './certificate.contoller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCourseCertificate } from './entities/user_course_certificate';
import { LoggerService } from 'src/common/logger/logger.service';
import { AxiosRequest } from 'src/common/middleware/axios.middleware';
import { KafkaModule } from 'src/kafka/kafka.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserCourseCertificate]),
    KafkaModule,
  ],
  controllers: [CertificateController],
  providers: [CertificateService, LoggerService, AxiosRequest],
})
export class CertificateModule {}
