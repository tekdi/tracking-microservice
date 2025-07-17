import { Expose } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsUUID,
  IsArray,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssessmentTrackingDto {
  @Expose()
  assessmentTrackingId: string;

  @Expose()
  createdOn: Date;

  @ApiProperty({
    type: () => String,
    description: 'User Id',
  })
  @Expose()
  @IsUUID(undefined, { message: 'User Id must be a valid UUID' })
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    type: () => String,
    description: 'Course Id',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @ApiPropertyOptional({
    type: () => String,
    description: 'Content values',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  contentId: string;

  @ApiPropertyOptional({
    type: () => String,
    description: 'Attempt Id',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  attemptId: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Assessment Summary',
    default: [],
  })
  @Expose()
  @IsArray()
  @IsNotEmpty()
  assessmentSummary: string[];

  @ApiPropertyOptional({
    type: () => Number,
    description: 'Total max score values',
  })
  @Expose()
  @IsNumber()
  @IsNotEmpty()
  totalMaxScore: number;

  @ApiPropertyOptional({
    type: () => Number,
    description: 'Total score values',
  })
  @Expose()
  @IsNumber()
  @IsNotEmpty()
  totalScore: number;

  @ApiPropertyOptional({
    type: () => Date,
    description: 'Last Attempted On',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  lastAttemptedOn: Date;

  @ApiPropertyOptional({
    type: () => Number,
    description: 'Time Spent',
  })
  @Expose()
  @IsNumber()
  @IsNotEmpty()
  timeSpent: number;

  @ApiPropertyOptional({
    type: () => String,
    description: 'Unit Id',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  unitId: string;

  @IsOptional()
  showFlag?: boolean;

  @IsString()
  @IsOptional()
  submitedBy: string;

  @IsString()
  @IsOptional()
  evaluatedBy?: EvaluationType;

  constructor(obj?: Partial<CreateAssessmentTrackingDto>) {
    if (obj) {
      Object.assign(this, obj);
    }
  }
}
export enum EvaluationType {
  AI = 'AI',
  ONLINE = 'Online',
  MANUAL = 'Manual',
}
