import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsUUID,
  IsObject,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

class QuestionDetailDto {
  @IsString()
  type: string;

  @IsNumber()
  no: number;
}

class ContentDto {
  @IsString()
  id: string;

  @IsString()
  url: string;
}

class MetadataDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  board?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  medium?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gradeLevel?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subject?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  courseType?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  program?: string[];

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  framework?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetAgeGroup?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  primaryUser?: string[];

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subDomain?: string[];

  @IsOptional()
  @IsString()
  contentLanguage?: string;

  @IsOptional()
  @IsString()
  assessmentType?: string;
}

export class AiAssessmentCreateDto {
  @IsString()
  @IsNotEmpty()
  questionSetId: string;

  @IsOptional()
  @IsString()
  framework?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  difficulty_level?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  question_types?: string[];

  @ValidateNested()
  @Type(() => MetadataDto)
  metadata: MetadataDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDetailDto)
  questionsDetails: QuestionDetailDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentDto)
  content: ContentDto[];

  @IsString()
  @IsNotEmpty()
  createdBy: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  token?: string;
}
