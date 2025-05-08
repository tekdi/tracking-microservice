import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database/database.module';
import { CacheModule } from '@nestjs/cache-manager';
import { MemoryStore } from 'cache-manager-memory-store';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { TrackingAssessmentModule } from 'src/modules/tracking_assessment/tracking_assessment.module';
import { TrackingContentModule } from 'src/modules/tracking_content/tracking_content.module';
import { CertificateModule } from './modules/certificate/certificate.module';
import { UserCertificateModule } from './modules/user_certificate/user_certificate.module';
import { TelemetryModule } from './modules/telemtry/telemetry.module';
import { JwtStrategy } from 'src/common/guards/jwt.strategy';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    TrackingAssessmentModule,
    TrackingContentModule,
    DatabaseModule,
    CacheModule.register({ isGlobal: true, store: MemoryStore }),
    CertificateModule,
    UserCertificateModule,
    TelemetryModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtStrategy,     
    JwtAuthGuard,   
  ],
})
export class AppModule {}