import { IsDateString, IsOptional, IsString, IsUUID, IsNotEmpty } from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  courseId: string;

  @IsString()
  courseName: string;
}
