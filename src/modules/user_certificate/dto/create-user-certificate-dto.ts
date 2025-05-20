import {
  IsUUID,
  IsString,
  IsOptional,
  IsDate,
  IsNotEmpty,
} from 'class-validator';

export class CreateCertificateDto {
  @IsOptional()
  @IsUUID()
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsOptional()
  certificateId: string | null;

  @IsOptional()
  @IsDate()
  issuedOn?: Date;
}
