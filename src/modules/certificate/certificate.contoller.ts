import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  Req,
  StreamableFile,
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
  // API to create template
  @ApiOkResponse({ description: 'Template created successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @ApiNotFoundResponse({ description: 'Certificate Not Found.' })
  @Post('template')
  async createTemplate(
    @Body() createCertificateDto: any,
    @Res() response: Response,
  ) {
    return this.certificateService.createTemplate(
      createCertificateDto.schemaId,
      createCertificateDto.template,
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
  //write API  to render certificate from htl in jpg renderCertificatePDFFromHTML
  @Post('render-image')
  async renderCertificateImageFromHTML(
    @Body() renderCertificateDto: RenderCertificateDTO,
    @Res() response: Response,
  ) {
    return await this.certificateService.renderImageFromHTML(renderCertificateDto.credentialId, renderCertificateDto.templateId, response);
  }
}
