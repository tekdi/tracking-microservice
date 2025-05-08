import { Controller, Post, Body, Req, Res, UseGuards } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import {
  ApiOkResponse,
  ApiInternalServerErrorResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { Telemetry } from './entities/telemetry';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('telemetry')
@UseGuards(JwtAuthGuard)
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @ApiOkResponse({ description: 'Telemetry log created successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post()
  async addEventLog(
    @Body() createTelemetryDto: Partial<Telemetry>,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return this.telemetryService.addTelemetryLog(
      createTelemetryDto,
      response,
      request,
    );
  }
}
