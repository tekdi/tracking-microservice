import { IsString, IsNotEmpty, IsOptional, isString } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  template: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  template_type?: string;

  @IsString()
  userId: string;
}
