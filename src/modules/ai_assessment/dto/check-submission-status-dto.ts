import { IsArray, IsString, IsUUID, ArrayNotEmpty } from 'class-validator';

export class CheckSubmissionStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  userIds: string[];

  @IsString()
  questionSetId: string;
}
