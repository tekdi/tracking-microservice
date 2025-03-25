import { IsString, IsUUID, IsOptional, IsInt, IsDate } from 'class-validator';

export class CreateUserCourseCertificateDto {
  @IsUUID()
  userId: string;

  @IsString()
  courseId: string;

  @IsUUID()
  tenantId: string;

  @IsString()
  certificateId: string;

  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  completedOn: string;

  @IsOptional()
  @IsInt()
  completionPercentage: number;

  @IsOptional()
  @IsString()
  lastReadContentId: string;

  @IsOptional()
  @IsInt()
  lastReadContentStatus: number;

  @IsOptional()
  @IsInt()
  progress: number;

  @IsOptional()
  @IsString()
  createdBy: string;
}
