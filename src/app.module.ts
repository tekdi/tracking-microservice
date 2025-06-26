import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database/database.module';
import { CacheModule } from '@nestjs/cache-manager';
import { MemoryStore } from 'cache-manager-memory-store';
import { ConfigModule } from '@nestjs/config';
import { TrackingAssessmentModule } from 'src/modules/tracking_assessment/tracking_assessment.module';
import { TrackingContentModule } from 'src/modules/tracking_content/tracking_content.module';
import { CertificateModule } from './modules/certificate/certificate.module';
import { UserCertificateModule } from './modules/user_certificate/user_certificate.module';
import { TelemetryModule } from './modules/telemtry/telemetry.module';
import { KafkaModule } from './kafka/kafka.module';
import kafkaConfig from './kafka/kafka.config';
import { AiAssessmentModule } from './modules/ai_assessment/ai_assessment.module';

@Module({
  imports: [
    TrackingAssessmentModule,
    TrackingContentModule,
    ConfigModule.forRoot({
      load: [kafkaConfig], // Load the Kafka config
      isGlobal: true,
    }),
    DatabaseModule,
    CacheModule.register({ isGlobal: true, store: MemoryStore }),
    CertificateModule,
    UserCertificateModule,
    TelemetryModule,
    KafkaModule,
    AiAssessmentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
