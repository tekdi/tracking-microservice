import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class IssueCredentialDto {
  @IsDateString()
  issuanceDate: string;

  @IsDateString()
  expirationDate: string;

  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  lastName: string;

  @IsUUID()
  @IsString()
  userId: string;

  @IsString()
  courseId: string;

  @IsString()
  courseName: string;
}
