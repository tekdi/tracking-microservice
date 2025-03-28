import { HttpStatus, Injectable } from '@nestjs/common';
import { Telemetry } from './entities/telemetry';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import APIResponse from 'src/common/utils/response';
import { LoggerService } from 'src/common/logger/logger.service';

@Injectable()
export class TelemetryService {
  constructor(
    @InjectRepository(Telemetry, 'telemetryDB')
    private telemetryRepository: Repository<Telemetry>,
    private loggerService: LoggerService,
  ) {}
  async addTelemetryLog(createTelemetryDto: any, response: any, request: any) {
    let apiId = 'api.create.telemtry';
    //read header value and assign to channel
    let channel = request.headers['x-channel-id'];
    try {
      let dataForInsert = createTelemetryDto.events.map((event: any) => {
        let telemetryData = new Telemetry();
        telemetryData.api_id = createTelemetryDto.id;
        telemetryData.ver = createTelemetryDto.ver;
        telemetryData.ets = createTelemetryDto.ets;
        telemetryData.params = createTelemetryDto.params;
        telemetryData.events = event;
        telemetryData.channel = channel;
        telemetryData.pid = event.context.channel;
        telemetryData.mid = event.mid;
        telemetryData.syncts = event.ets;

        return telemetryData;
      });

      const telemetryData = this.telemetryRepository.create(dataForInsert);
      const result = await this.telemetryRepository.save(telemetryData);

      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        'Telemetry log created successfully',
      );
    } catch (error) {
      this.loggerService.error('Error while adding telemetry log', error);
      return APIResponse.error(
        response,
        apiId,
        'Error while adding telemetry log',
        'BAD_REQUEST',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
