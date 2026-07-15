import { Controller, Post, Body, Req, Res } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import {
  ApiOkResponse,
  ApiInternalServerErrorResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { Telemetry } from './entities/telemetry';
import { Request, Response } from 'express';

@Controller('telemetry')
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
    // Telemetry ingestion is deprecated; endpoint kept for frontend compatibility.
    // Always acknowledge success without touching the service/DB.
    return response
      .status(200)
      .json({ message: 'Telemetry log created successfully' });
  }
}
