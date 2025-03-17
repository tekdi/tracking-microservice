import { HttpStatus, Injectable, StreamableFile } from '@nestjs/common';
import axios from 'axios';
import APIResponse from 'src/common/utils/response';
import { LoggerService } from 'src/common/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCourseCertificate } from './entities/user_course_certificate';
import { Repository } from 'typeorm';
import { Response } from 'express';
const puppeteer = require('puppeteer');

@Injectable()
export class CertificateService {
  constructor(
    @InjectRepository(UserCourseCertificate)
    private userCourseCertificateRepository: Repository<UserCourseCertificate>,
    private configService: ConfigService,
    private loggerService: LoggerService,
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
    try {
      //get credentialId
      let learnerDid = await this.generateDidByUserId(issueCredential.userId);
      this.loggerService.log('learnerDid: ', learnerDid);

      const url =
        this.configService.get('RC_CREDENTIALS_API_BASE_URL') +
        'credentials/issue';
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
        await this.userCourseCertificateRepository.save(userCertificate);
      }
      this.loggerService.log('Successfully updated user certificate');
    } catch (error) {
      this.loggerService.error('Error while updating usercertificate', error);
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

      // Launch Puppeteer
      const browser = await puppeteer.launch();
      const page = await browser.newPage();

      // Set HTML content
      await page.setContent(response.data, { waitUntil: 'load' });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });

      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="generated.pdf"',
      );
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
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
}
