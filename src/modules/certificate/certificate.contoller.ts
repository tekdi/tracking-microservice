import {
  Controller,
  Post,
  Body,
  Res,
  Headers,
  Req,
  StreamableFile,
  BadRequestException,
  Put,
} from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CertificateService } from './certificate.service';
import { IssueCredentialDto } from './dto/issue-certificate-dto';
import { RenderCertificateDTO } from './dto/render-certificate-dto';
import { AddCourseTemplateDto } from './dto/add-course-template-dto';
import { CourseTemplateListDto } from './dto/course-template-list-dto';
import { EditTemplateDto } from './dto/edit-template-dto';
import { GetTemplateDto } from './dto/get-template-dto';
import { GetTemplatesDto } from './dto/get-templates-dto';
import { CreateTemplateDto } from './dto/create-template-dto';
import { isUUID } from 'class-validator';
@Controller('certificate')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}
  // API to generate DID
  @ApiOkResponse({ description: 'DID generated successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('generateDid')
  async generateDid(
    @Body() createCertificateDto: any,
    @Res() response: Response,
  ) {
    return this.certificateService.generateDid(
      createCertificateDto.userId,
      response,
    );
  }
  // API to create schema
  @ApiOkResponse({ description: 'Credential schema created successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('schema')
  async createCredentialSchema(
    @Body() createCertificateDto: any,
    @Res() response: Response,
  ) {
    return this.certificateService.createCredentialSchema(
      createCertificateDto.schema,
      response,
    );
  }
  // // API to issue certificate
  @ApiOkResponse({ description: 'Certificate issued successfully.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('issue')
  async issueCertificate(
    @Body() issueCertificateDto: IssueCredentialDto,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return await this.certificateService.issueCertificateAfterCourseCompletion(
      issueCertificateDto,
      request,
      response,
    );
  }
  // API to render certificate
  @ApiOkResponse({ description: 'Certificate rendered successfully.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('render')
  async renderCertificate(
    @Body() renderCertificateDto: any,
    @Res() response: Response,
  ) {
    return await this.certificateService.renderCredentials(
      renderCertificateDto.credentialId,
      renderCertificateDto.templateId,
      response,
    );
  }
  // API to render certificate
  @ApiOkResponse({ description: 'Certificate rendered successfully.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('render-PDF')
  async renderCertificatePDFFromHTML(
    @Body() renderCertificateDto: RenderCertificateDTO,
    @Res({ passthrough: true }) response,
  ): Promise<string | StreamableFile> {
    return await this.certificateService.renderPDFFromHTML(
      renderCertificateDto.credentialId,
      renderCertificateDto.templateId,
      response,
    );
  }

  // API to create template
  @ApiOkResponse({ description: 'Template created successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @ApiNotFoundResponse({ description: 'Certificate Not Found.' })
  @Post('template')
  async createTemplate(
    @Body() createTemplateDto: CreateTemplateDto,
    @Res() response: Response,
    @Req() request: Request,
    @Headers() headers,
  ) {
    const tenantId = headers['tenantid'];
    if (!tenantId || !isUUID(tenantId)) {
      throw new BadRequestException('Please add valid Tenant ID');
    }
    return this.certificateService.createTemplate(
      createTemplateDto.template,
      createTemplateDto.userId,
      createTemplateDto.title,
      response,
      request,
    );
  }

  // API to add course template mapping
  @ApiOkResponse({ description: 'Course template added successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('course-template')
  async addCourseTemplate(
    @Body() addCourseTemplateDto: AddCourseTemplateDto,
    @Res() response: Response,
    @Req() request: Request,
    @Headers() headers,
  ) {
    const tenantId = headers['tenantid'];
    if (!tenantId || !isUUID(tenantId)) {
      throw new BadRequestException('Please add valid Tenant ID');
    }
    return this.certificateService.addCourseTemplate(
      addCourseTemplateDto.templateId,
      addCourseTemplateDto.contextId,
      addCourseTemplateDto.userId,
      response,
      request,
    );
  }

  // API to get template HTML by templateId
  @ApiOkResponse({ description: 'Template retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Template not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('get-template')
  async getTemplate(
    @Body() getTemplateDto: GetTemplateDto,
    @Res() response: Response,
    @Headers() headers,
  ) {
    const tenantId = headers['tenantid'];
    if (!tenantId || !isUUID(tenantId)) {
      throw new BadRequestException('Please add valid Tenant ID');
    }
    return this.certificateService.getTemplate(
      getTemplateDto.templateId,
      response,
    );
  }

  // API to get all templates with course template data, pagination and filtering
  @ApiOkResponse({ description: 'Templates retrieved successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('templates-list')
  async getTemplates(
    @Body() getTemplatesDto: GetTemplatesDto,
    @Res() response: Response,
    @Headers() headers,
  ) {
    const tenantId = headers['tenantid'];
    if (!tenantId || !isUUID(tenantId)) {
      throw new BadRequestException('Please add valid Tenant ID');
    }
    return this.certificateService.getTemplates(getTemplatesDto, response);
  }

  // API to get all course templates with pagination and filtering
  @ApiOkResponse({ description: 'Course templates retrieved successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('course-template/list')
  async getCourseTemplateList(
    @Body() courseTemplateListDto: CourseTemplateListDto,
    @Res() response: Response,
    @Headers() headers,
  ) {
    const tenantId = headers['tenantid'];
    if (!tenantId || !isUUID(tenantId)) {
      throw new BadRequestException('Please add valid Tenant ID');
    }
    return this.certificateService.getCourseTemplateList(
      courseTemplateListDto,
      response,
    );
  }

  // API to edit/update template via external credential service
  @ApiOkResponse({ description: 'Template updated successfully' })
  @ApiNotFoundResponse({ description: 'Template not found' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @Put('edit-template')
  async editTemplate(
    @Body() editTemplateDto: EditTemplateDto,
    @Res() response: Response,
    @Headers() headers,
  ) {
    const tenantId = headers['tenantid'];
    if (!tenantId || !isUUID(tenantId)) {
      throw new BadRequestException('Please add valid Tenant ID');
    }
    return this.certificateService.editTemplate(
      editTemplateDto.templateId,
      editTemplateDto.template,
      editTemplateDto.type,
      editTemplateDto.title,
      editTemplateDto.template_type,
      response,
    );
  }
}
