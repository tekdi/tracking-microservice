import { PartialType } from '@nestjs/mapped-types';
import { AnswerSheetSubmissionsCreateDto } from './answer-sheet-submissions-create-dto';

export class UpdateAnswerSheetSubmissionsDto extends PartialType(AnswerSheetSubmissionsCreateDto) {} 