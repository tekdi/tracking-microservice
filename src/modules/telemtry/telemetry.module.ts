import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Telemetry } from './entities/telemetry';
import { LoggerService } from 'src/common/logger/logger.service';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetry], 'telemetryDB')],
  controllers: [TelemetryController],
  providers: [TelemetryService, LoggerService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
