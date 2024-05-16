import { Controller } from '@nestjs/common';
import { TrackingAssesmentService } from './tracking_assesment.service';

@Controller('tracking-assesment')
export class TrackingAssesmentController {
  constructor(private readonly trackingAssesmentService: TrackingAssesmentService) {}
}
