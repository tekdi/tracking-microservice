import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, IsJSON } from 'class-validator';
import { Type } from 'class-transformer';

enum SubmissionStatus {
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

class ResultHistoryItem {
  @IsString()
  date: string; // ISO date string

  @IsString()
  result: string;

  @IsString()
  userId: string;
}

export class AnswerSheetSubmissionsCreateDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  questionSetId: string;

  @IsArray()
  @IsString({ each: true })
  fileUrls: string[];

  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @Type(() => ResultHistoryItem)
  resultsHistory?: ResultHistoryItem[];
}
