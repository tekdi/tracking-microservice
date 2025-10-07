import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class EditTemplateDto {
  @IsNotEmpty()
  @IsString()
  templateId: string;

  @IsNotEmpty()
  @IsString()
  template: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['certificate', 'badge'])
  type: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn(['certificate', 'badge'])
  template_type?: string;
}