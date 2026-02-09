import { HttpStatus, Injectable, StreamableFile } from '@nestjs/common';
import axios from 'axios';
import APIResponse from 'src/common/utils/response';
import { LoggerService } from 'src/common/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCourseCertificate } from './entities/user_course_certificate';
import { Repository } from 'typeorm';
import { Response } from 'express';
import puppeteer from 'puppeteer';
import { KafkaService } from 'src/kafka/kafka.service';

@Injectable()
export class CertificateService {
  constructor(
    @InjectRepository(UserCourseCertificate)
    private userCourseCertificateRepository: Repository<UserCourseCertificate>,
    private configService: ConfigService,
    private loggerService: LoggerService,
    private readonly kafkaService: KafkaService,
  ) {}
  async generateDid(userId: string, res: Response) {
    let apiId = 'api.generate.did';
    try {
      this.loggerService.log(
        'base: ',
        this.configService.get<string>('RC_IDENTITY_API_BASE_URL'),
      );
      const url =
        this.configService.get<string>('RC_IDENTITY_API_BASE_URL') +
        '/did/generate';
      const response = await axios.post(
        url,
        {
          content: [
            {
              alsoKnownAs: [userId],
              services: [
                {
                  id: 'IdentityHub',
                  type: 'IdentityHub',
                  serviceEndpoint: {
                    '@context': 'schema.identity.foundation/hub',
                    '@type': 'UserServiceEndpoint',
                    instance: ['did:test:hub.id'],
                  },
                },
              ],
              method: 'upai',
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      return APIResponse.success(
        res,
        apiId,
        response.data,
        HttpStatus.OK,
        'DID generated successfully',
      );
    } catch (error) {
      this.loggerService.error('Error generating DID:', error);
      return APIResponse.error(
        res,
        apiId,
        error.message,
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async generateDidByUserId(userId: string) {
    try {
      this.loggerService.log(
        'base: ',
        this.configService.get<string>('RC_IDENTITY_API_BASE_URL'),
      );
      const url =
        this.configService.get<string>('RC_IDENTITY_API_BASE_URL') +
        '/did/generate';
      const response = await axios.post(
        url,
        {
          content: [
            {
              alsoKnownAs: [userId],
              services: [
                {
                  id: 'IdentityHub',
                  type: 'IdentityHub',
                  serviceEndpoint: {
                    '@context': 'schema.identity.foundation/hub',
                    '@type': 'UserServiceEndpoint',
                    instance: ['did:test:hub.id'],
                  },
                },
              ],
              method: 'upai',
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data[0].id;
    } catch (error) {
      this.loggerService.error('Error generating DID:', error);
      return error;
    }
  }
  async createCredentialSchema(schema, res: Response) {
    const apiId = 'api.create.credentialSchema';
    try {
      const url =
        this.configService.get('RC_CREDENTIAL_SCHEMA_API_BASE_URL') +
        '/schemas';
      const response = await axios.post(url, ...schema, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return APIResponse.success(
        res,
        apiId,
        response.data,
        HttpStatus.CREATED,
        'Credential schema created successfully',
      );
    } catch (error) {
      this.loggerService.error('Error creating credential schema:', error);
      return APIResponse.error(
        res,
        apiId,
        'Error creating credential schema',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async createTemplate(schemaId: string, template: string, res: Response) {
    const apiId = 'api.create.template';
    try {
      const url =
        this.configService.get('RC_CREDENTIAL_SCHEMA_API_BASE_URL') +
        '/schemas/template';
      const response = await axios.post(
        url,
        {
          schemaId: schemaId,
          schemaVersion: '1.0.0',
          template: template,
          type: 'Handlebar',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      return APIResponse.success(
        res,
        apiId,
        response.data,
        HttpStatus.CREATED,
        'Template created successfully',
      );
    } catch (error) {
      return APIResponse.error(
        res,
        apiId,
        'Error creating template',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async issueCertificateAfterCourseCompletion(
    issueCredential,
    request,
    response,
  ) {
    let apiId = 'api.issueCertificate';
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      month: 'long',
      year: 'numeric',
    };
    const formattedIssuanceDate = today.toLocaleDateString('en-US', options);

    this.loggerService.log('Formatted issuance date:', formattedIssuanceDate); // e.g., "July 2025"

    try {
      //get credentialId
      let learnerDid = await this.generateDidByUserId(issueCredential.userId);
      this.loggerService.log('learnerDid: ', learnerDid);

      const url =
        this.configService.get('RC_CREDENTIALS_API_BASE_URL') +
        '/credentials/issue';
      this.loggerService.log('url: ', url);
      const credetialObj = {
        credential: {
          '@context': [
            'https://www.w3.org/2018/credentials/v1',
            this.configService.get('VERIFICATION_SCHEMA_URL'),
          ],
          type: [
            'VerifiableCredential',
            this.configService.get('VERIFICATION_SCHEMA_NAME'),
          ],
          issuer: this.configService.get('CERTIFICATE_ISSUER_DID'),
          issuanceDate: issueCredential.issuanceDate,
          expirationDate: issueCredential.expirationDate,
          credentialSubject: {
            id: learnerDid,
            type: this.configService.get('VERIFICATION_SCHEMA_NAME'),
            firstName: issueCredential.firstName,
            middleName: '',
            lastName: issueCredential.lastName,
            userId: issueCredential.userId,
            courseId: issueCredential.courseId,
            courseName: issueCredential.courseName,
            issuedOn: issueCredential.issuedOn || formattedIssuanceDate,
            certificateId: '**Id**',
          },
        },
        credentialSchemaId: this.configService.get('SCHEMA_ID'),
        credentialSchemaVersion: '1.0.0',
        tags: [],
      };
      const issueResponse = await axios.post(url, credetialObj, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      //update status to view certificate
      const updateResponse = await this.updateUserCertificate({
        userId: issueCredential.userId,
        courseId: issueCredential.courseId,
        issuedOn: issueCredential.issuanceDate,
        status: 'viewCertificate',
        certificateId: issueResponse.data.credential.id,
      });

      return APIResponse.success(
        response,
        apiId,
        issueResponse.data,
        HttpStatus.OK,
        'Credential issued successfully',
      );
    } catch (error) {
      this.loggerService.log(error);
      this.loggerService.error('Error while issuing credentials:', error);
      return APIResponse.error(
        response,
        apiId,
        'Error while issuing credentials',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async updateUserCertificate(data) {
    try {
      const userCertificate =
        await this.userCourseCertificateRepository.findOne({
          where: { userId: data.userId, courseId: data.courseId },
        });
      if (userCertificate) {
        userCertificate.certificateId = data.certificateId;
        userCertificate.issuedOn = data.issuedOn;
        userCertificate.status = data.status;
        const savedCertificate = await this.userCourseCertificateRepository.save(userCertificate);
        
        this.loggerService.log('Successfully updated user certificate');
        
        // Publish Kafka event after successful update
        await this.publishCertificateIssuedEvent(
          savedCertificate.usercertificateId,
          'api.updateUserCertificate',
        );
      }
    } catch (error) {
      this.loggerService.error('Error while updating usercertificate', error);
    }
  }

  /**
   * Publish certificate issued event to Kafka with event name 'course_updated'
   * Fetches complete data from user_course_certificate table and publishes it
   * @param usercertificateId - The user certificate ID from database
   * @param apiId - API identifier for logging
   */
  private async publishCertificateIssuedEvent(
    usercertificateId: string,
    apiId: string,
  ): Promise<void> {
    try {
      // Fetch complete user certificate data from database
      const userCertificate = await this.userCourseCertificateRepository.findOne({
        where: { usercertificateId: usercertificateId },
      });

      if (!userCertificate) {
        this.loggerService.error(
          `User certificate not found for ID: ${usercertificateId}`,
          apiId,
        );
        return;
      }

      // Prepare event data with complete certificate information
      const eventData = {
        usercertificateId: userCertificate.usercertificateId,
        userId: userCertificate.userId,
        courseId: userCertificate.courseId,
        certificateId: userCertificate.certificateId,
        tenantId: userCertificate.tenantId,
        status: userCertificate.status,
        issuedOn: userCertificate.issuedOn,
        completedOn: userCertificate.completedOn,
        completionPercentage: userCertificate.completionPercentage,
        lastReadContentId: userCertificate.lastReadContentId,
        lastReadContentStatus: userCertificate.lastReadContentStatus,
        progress: userCertificate.progress,
        createdOn: userCertificate.createdOn,
        updatedOn: userCertificate.updatedOn,
        createdBy: userCertificate.createdBy,
        eventType: 'CERTIFICATE_ISSUED',
      };

      // Publish event with event name 'course_updated'
      await this.kafkaService.publishUserCourseEvent(
        'course_updated',
        eventData,
        userCertificate.courseId,
      );

      this.loggerService.log(
        `Certificate issued event published for user ${userCertificate.userId} and course ${userCertificate.courseId}`,
        apiId,
      );
    } catch (error) {
      // Log error but don't fail the certificate update
      this.loggerService.error(
        `Failed to publish certificate issued event: ${error.message}`,
        apiId,
      );
    }
  }
  async renderCredentials(
    credentialId: string,
    templateId: string,
    res: Response,
  ) {
    const apiId = 'api.get.Certificate';
    try {
      let url =
        this.configService.get('RC_CREDENTIALS_API_BASE_URL') +
        '/credentials/' +
        credentialId;
      const response = await axios.get(url, {
        headers: {
          templateid: templateId,
          Accept: 'text/html',
        },
      });
      response.data = response?.data?.replace('**Id**', credentialId);
      return APIResponse.success(
        res,
        apiId,
        response.data,
        HttpStatus.OK,
        'Credential rendered successfully',
      );
    } catch (error) {
      this.loggerService.error('Error fetching credentials:', error);
      return APIResponse.error(
        res,
        apiId,
        'Error fetching credentials',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async renderPDFFromHTML(
    credentialId: string,
    templateId: string,
    res: Response,
  ): Promise<StreamableFile> {
    const apiId = 'api.get.Certificate';

    try {
      let url =
        this.configService.get('RC_CREDENTIALS_API_BASE_URL') +
        '/credentials/' +
        credentialId;
      const response = await axios.get(url, {
        headers: {
          templateid: templateId,
          Accept: 'text/html',
        },
      });
      let htmlContent = response?.data?.replace('**Id**', credentialId);

      // Inject font support for Devanagari script (Marathi/Hindi) if not already present
      if (!htmlContent.includes('fonts.googleapis.com') && !htmlContent.includes('@font-face')) {
        const fontInjection = `
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Serif+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            * {
              font-family: 'Noto Sans Devanagari', 'Noto Serif Devanagari', 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif !important;
            }
          </style>
        `;
        
        // Ensure charset is set first
        if (!htmlContent.includes('charset')) {
          if (htmlContent.includes('</head>')) {
            htmlContent = htmlContent.replace('</head>', '<meta charset="UTF-8"></head>');
          } else if (htmlContent.includes('<head>')) {
            htmlContent = htmlContent.replace('<head>', '<head><meta charset="UTF-8">');
          }
        }
        
        // Inject fonts into head if head exists, otherwise wrap content
        if (htmlContent.includes('</head>')) {
          htmlContent = htmlContent.replace('</head>', `${fontInjection}</head>`);
        } else if (htmlContent.includes('<head>')) {
          htmlContent = htmlContent.replace('<head>', `<head>${fontInjection}`);
        } else {
          // If no head tag, wrap content and add head
          if (!htmlContent.includes('<html>')) {
            htmlContent = `<html><head><meta charset="UTF-8">${fontInjection}</head><body>${htmlContent}</body></html>`;
          } else {
            htmlContent = htmlContent.replace('<html>', `<html><head><meta charset="UTF-8">${fontInjection}</head>`);
          }
        }
      } else {
        // Ensure charset is set even if fonts are already present
        if (!htmlContent.includes('charset')) {
          if (htmlContent.includes('</head>')) {
            htmlContent = htmlContent.replace('</head>', '<meta charset="UTF-8"></head>');
          } else if (htmlContent.includes('<head>')) {
            htmlContent = htmlContent.replace('<head>', '<head><meta charset="UTF-8">');
          }
        }
      }

      // Launch Puppeteer
      const browser = await puppeteer.launch({
        headless: true, // Use headless mode
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--font-render-hinting=none',
        ],
      });

      const page = await browser.newPage();

      // Set viewport for better rendering
      await page.setViewport({ width: 1200, height: 1600 });

      // Set HTML content and wait for fonts to load
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0', // Wait for all network requests to finish (including fonts)
      });

      // Additional wait to ensure fonts are fully loaded
      await page.evaluateHandle(() => document.fonts.ready);

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        margin: {
          top: '10mm',
          bottom: '10mm',
          left: '0mm',
          right: '0mm',
        },
      });

      await browser.close();

      // Return StreamableFile instead of calling res.end()
      return new StreamableFile(pdfBuffer);
    } catch (error) {
      console.log('error: ', error);
      this.loggerService.error('Error generating PDF:', error);
      throw error;
    }
  }
}
