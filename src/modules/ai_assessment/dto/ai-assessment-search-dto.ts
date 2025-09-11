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

export class setAiAssessmentFilters {
  @ApiPropertyOptional({
    type: () => String,
    description: "AI Assessment Id",
  })
  @Expose()
  @IsUUID(undefined, { message: 'AI Assessment Id must be a valid UUID' })
  @IsOptional()
  @IsNotEmpty()
  aiAssessmentId: string;

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

export class aiAssessmentPaginationDto {
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

export class aiAssessmentSortDto {
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

export class SearchAiAssessmentDto {
  @ApiProperty({
    type: setAiAssessmentFilters,
    description: "Filters",
  })
  @IsOptional()
  @IsObject()
  filters: setAiAssessmentFilters;

  @ApiProperty({
    type: aiAssessmentPaginationDto,
    description: "Pagination",
  })
  @IsOptional()
  @IsObject()
  pagination: aiAssessmentPaginationDto;

  @ApiProperty({
    type: aiAssessmentSortDto,
    description: "Ordering",
  })
  @IsOptional()
  @IsObject()
  sort: aiAssessmentSortDto;

  constructor(partial: Partial<SearchAiAssessmentDto>) {
    Object.assign(this, partial);
  }
} 