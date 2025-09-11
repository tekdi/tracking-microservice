import { IsString, IsNotEmpty, IsArray } from 'class-validator';

export class SubmitAssessmentToAiDto {
  @IsString()
  @IsNotEmpty()
  questionSetId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsArray()
  @IsString({ each: true })
  fileUrls: string[];

  @IsString()
  @IsNotEmpty()
  identifier: string;
}
