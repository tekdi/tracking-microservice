import { PartialType } from '@nestjs/mapped-types';
import { AiAssessmentCreateDto } from './ai-assessment-create-dto';

export class UpdateAssessmentGenerateTrackerDto extends PartialType(AiAssessmentCreateDto) {}
