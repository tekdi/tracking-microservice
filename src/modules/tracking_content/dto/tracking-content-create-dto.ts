import { Expose } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsUUID,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContentTrackingDto {
  @Expose()
  contentTrackingId: string;

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
    description: 'Content values',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  contentType: string;

  @ApiPropertyOptional({
    type: () => String,
    description: 'Content values',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  contentMime: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Content Summary',
    default: [],
  })
  @Expose()
  @IsArray()
  @IsNotEmpty()
  detailsObject: string[];

  @ApiPropertyOptional({
    type: () => String,
    description: 'Unit Id',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  unitId: string;

  @ApiPropertyOptional({
    type: () => String,
    description: 'Tenant Id',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  constructor(obj?: Partial<CreateContentTrackingDto>) {
    if (obj) {
      Object.assign(this, obj);
    }
  }
}
