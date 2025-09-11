import { Expose } from "class-transformer";
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsUUID,
  IsObject,
  IsOptional,
  ValidationOptions,
  registerDecorator,
  ValidationArguments,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class setAnswerSheetSubmissionsFilters {
  @ApiPropertyOptional({
    type: () => String,
    description: "Answer Sheet Submission Id",
  })
  @Expose()
  @IsUUID(undefined, { message: 'Answer Sheet Submission Id must be a valid UUID' })
  @IsOptional()
  @IsNotEmpty()
  answerSheetSubmissionId: string;

  @ApiPropertyOptional({
    type: () => String,
    description: "User Id",
  })
  @Expose()
  @IsUUID(undefined, { message: 'User Id must be a valid UUID' })
  @IsOptional()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    type: () => String,
    description: "Course Id",
  })
  @Expose()
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  courseId: string;

  @ApiPropertyOptional({
    type: () => String,
    description: "Unit Id",
  })
  @Expose()
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  unitId: string;

  @ApiPropertyOptional({
    type: () => String,
    description: "Content values",
  })
  @Expose()
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  contentId: string;
}

export class answerSheetSubmissionsPaginationDto {
  @ApiProperty({
    type: Number,
    description: "Page Size",
  })
  @Expose()
  @IsNumber()
  @IsOptional()
  @IsNotEmpty()
  pageSize: number;

  @ApiProperty({
    type: Number,
    description: "Page",
  })
  @Expose()
  @IsNumber()
  @IsOptional()
  @IsNotEmpty()
  page: number;
}

export class answerSheetSubmissionsSortDto {
  @ApiProperty({
    type: String,
    description: "Field",
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  field: string;

  @ApiProperty({
    type: String,
    description: "Order",
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  order: string;
}

export class SearchAnswerSheetSubmissionsDto {
  @ApiProperty({
    type: setAnswerSheetSubmissionsFilters,
    description: "Filters",
  })
  @IsOptional()
  @IsObject()
  filters: setAnswerSheetSubmissionsFilters;

  @ApiProperty({
    type: answerSheetSubmissionsPaginationDto,
    description: "Pagination",
  })
  @IsOptional()
  @IsObject()
  pagination: answerSheetSubmissionsPaginationDto;

  @ApiProperty({
    type: answerSheetSubmissionsSortDto,
    description: "Ordering",
  })
  @IsOptional()
  @IsObject()
  sort: answerSheetSubmissionsSortDto;

  constructor(partial: Partial<SearchAnswerSheetSubmissionsDto>) {
    Object.assign(this, partial);
  }
} 