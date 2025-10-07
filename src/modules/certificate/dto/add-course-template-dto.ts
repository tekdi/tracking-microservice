import { IsNotEmpty, IsString } from 'class-validator';

export class AddCourseTemplateDto {
  @IsNotEmpty()
  @IsString()
  templateId: string;

  @IsNotEmpty()
  @IsString()
  contextId: string;

  @IsNotEmpty()
  @IsString()
  userId: string;
}
