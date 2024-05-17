import { Expose } from "class-transformer";
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsUUID,
  IsObject,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class setFilters {
  
  @ApiProperty({
    type: () => String,
    description: "Assessment Tracking Id",
  })
  @Expose()
  @IsUUID(undefined, { message: 'Assessment Tracking Id must be a valid UUID' })
  @IsNotEmpty()
  assessmentTrackingId: string;


  @ApiProperty({
    type: () => String,
    description: "User Id",
  })
  @Expose()
  @IsUUID(undefined, { message: 'User Id must be a valid UUID' })
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    type: () => String,
    description: "Course Id",
  })
  @Expose()
  @IsString()
  courseId: string;

  @ApiPropertyOptional({
    type: () => String,
    description: "Batch Id",
  })
  @Expose()
  @IsString()
  batchId: string;

  @ApiPropertyOptional({
    type: () => String,
    description: "Content values",
  })
  @Expose()
  @IsString()
  contentId: string;
}

export class paginationDto {
  @ApiProperty({
    type: Number,
    description: "Page Size",
  })
  @IsNumber()
  pageSize: number;

  @ApiProperty({
    type: Number,
    description: "Page",
  })
  @IsNumber()
  page: number;
}

export class sortDto {
  @ApiProperty({
    type: String,
    description: "Field",
  })
  @IsString()
  @IsNotEmpty()
  field: string;


  @ApiProperty({
    type: String,
    description: "Order",
  })
  @IsString()
  @IsNotEmpty()
  order: string;
}

export class SearchAssessmentTrackingDto {

  @ApiProperty({
    type: setFilters,
    description: "Filters",
  })
  @IsObject()
  filters: setFilters;

  @ApiProperty({
    type: paginationDto,
    description: "Pagination",
  })
  @IsObject()
  pagination: paginationDto;

  @ApiProperty({
    type: sortDto,
    description: "Pagination",
  })
  @IsObject()
  sort: sortDto;

  constructor(partial: Partial<SearchAssessmentTrackingDto>) {
    Object.assign(this, partial);
  }
}