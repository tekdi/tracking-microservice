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
import { randomUUID } from 'crypto';
import { GetUserCertificatesDto } from './dto/get-user-certificates-dto';
import { CourseTemplate } from './entities/course_templates';
import { Templates } from './entities/templates';

@Injectable()
export class CertificateService {
  constructor(
    @InjectRepository(UserCourseCertificate)
    private userCourseCertificateRepository: Repository<UserCourseCertificate>,
    @InjectRepository(Templates)
    private templatesRepository: Repository<Templates>,
    @InjectRepository(CourseTemplate)
    private courseTemplateRepository: Repository<CourseTemplate>,

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
  // async createTemplate(schemaId: string, template: string, res: Response) {
  //   const apiId = 'api.create.template';
  //   try {
  //     const url =
  //       this.configService.get('RC_CREDENTIAL_SCHEMA_API_BASE_URL') +
  //       '/schemas/template';
  //     const response = await axios.post(
  //       url,
  //       {
  //         schemaId: schemaId,
  //         schemaVersion: '1.0.0',
  //         template: template,
  //         type: 'Handlebar',
  //       },
  //       {
  //         headers: {
  //           'Content-Type': 'application/json',
  //         },
  //       },
  //     );
  //     return APIResponse.success(
  //       res,
  //       apiId,
  //       response.data,
  //       HttpStatus.CREATED,
  //       'Template created successfully',
  //     );
  //   } catch (error) {
  //     return APIResponse.error(
  //       res,
  //       apiId,
  //       'Error creating template',
  //       'INTERNAL_SERVER_ERROR',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

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
      response.data = response?.data?.replace('**Id**', credentialId);

      // Launch Puppeteer
      const browser = await puppeteer.launch({
        headless: true, // Use headless mode
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
        ],
      });

      const page = await browser.newPage();

      // Set HTML content
      await page.setContent(response.data, { waitUntil: 'load' });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '10mm',
          bottom: '10mm',
          left: '0mm',
          right: '0mm',
        },
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
  //////// changes for dynamic template
  async createTemplate(
    template: string,
    userId: string,
    title: string,
    res: Response,
    request: any,
  ) {
    //async createTemplate(schemaId: string, template: string, res: Response) {
    const apiId = 'api.create.template';
    try {
      const url =
        this.configService.get('RC_CREDENTIAL_SCHEMA_API_BASE_URL') +
        '/template';
      const schemaId = this.configService.get<string>('SCHEMA_ID');
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
      if (response.data?.template?.templateId) {
        await this.saveTemplate({
          templateId: response.data.template.templateId,
          templateType: 'certificate',
          title: title,
          request: request,
          userId: userId,
        });
      } else {
        this.loggerService.warn(
          'External service response does not contain expected template structure',
        );
      }
      return APIResponse.success(
        res,
        apiId,
        response.data,
        HttpStatus.CREATED,
        'Template created successfully',
      );
    } catch (error) {
      this.loggerService.error('Error creating template:', error.message);
      return APIResponse.error(
        res,
        apiId,
        'Error creating template',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  /**
   * Save template record to database after successful template creation
   * @param templateData - Data from template creation
   */
  async saveTemplate(templateData: {
    templateId: string;
    templateType: string;
    title: string;
    request: any;
    userId: string;
  }): Promise<void> {
    try {
      // Extract user ID from JWT token
      const userId = templateData.userId;

      // Check if template already exists for this templateId
      const existingTemplate = await this.templatesRepository.findOne({
        where: { templateId: templateData.templateId },
      });

      if (existingTemplate) {
        // Update existing record
        existingTemplate.template_type = templateData.templateType;
        existingTemplate.title = templateData.title;
        existingTemplate.updatedOn = new Date();
        existingTemplate.updatedBy = userId;

        await this.templatesRepository.save(existingTemplate);
        this.loggerService.log(`Template updated: ${templateData.templateId}`);
      } else {
        // Create new record
        const template = new Templates();
        template.templatesId = randomUUID();
        template.templateId = templateData.templateId;
        template.template_type = templateData.templateType;
        template.title = templateData.title;
        template.createdOn = new Date();
        template.updatedOn = new Date();
        template.createdBy = userId;
        template.updatedBy = userId;

        await this.templatesRepository.save(template);
        this.loggerService.log(`Template created: ${templateData.templateId}`);
      }
    } catch (error) {
      this.loggerService.error('Error saving template:', error.message);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Get user certificates with template data
   * @param filters - Filter criteria
   * @param res - Response object
   */
  async getUserCertificates(filters: GetUserCertificatesDto, res: Response) {
    const apiId = 'api.get.UserCertificates';

    try {
      const {
        page,
        limit,
        userIds,
        certificateIds,
        courseIds,
        templateIds,
        certificateTypes,
      } = filters;

      // Build query for user certificates
      let userCertQuery = this.userCourseCertificateRepository
        .createQueryBuilder('uc')
        .select([
          'uc.usercertificateId',
          'uc.userId',
          'uc.contextId',
          'uc.contextType',
          'uc.tenantId',
          'uc.certificateId',
          'uc.status',
          'uc.issuedOn',
          'uc.createdOn',
          'uc.updatedOn',
          'uc.createdBy',
          'uc.updatedBy',
          'uc.certificate_type',
        ]);

      // Apply filters only if they are provided
      if (userIds && userIds.length > 0) {
        userCertQuery = userCertQuery.andWhere('uc.userId IN (:...userIds)', {
          userIds,
        });
      }

      if (certificateIds && certificateIds.length > 0) {
        userCertQuery = userCertQuery.andWhere(
          'uc.certificateId IN (:...certificateIds)',
          { certificateIds },
        );
      }

      if (courseIds && courseIds.length > 0) {
        userCertQuery = userCertQuery.andWhere(
          'uc.contextId IN (:...courseIds)',
          { courseIds },
        );
      }

      if (templateIds && templateIds.length > 0) {
        userCertQuery = userCertQuery.andWhere(
          'ct.templateId IN (:...templateIds)',
          { templateIds },
        );
      }

      if (certificateTypes && certificateTypes.length > 0) {
        userCertQuery = userCertQuery.andWhere(
          'uc.certificate_type IN (:...certificateTypes)',
          { certificateTypes },
        );
      }

      // Get total count for pagination
      const totalCount = await userCertQuery.getCount();

      // Apply pagination only if limit is provided
      if (limit && limit > 0) {
        const currentPage = page || 1;
        const currentLimit = limit;
        const offset = (currentPage - 1) * currentLimit;

        userCertQuery = userCertQuery
          .orderBy('uc.createdOn', 'DESC')
          .offset(offset)
          .limit(currentLimit);
      } else {
        // If no limit provided, get all records but still order them
        userCertQuery = userCertQuery.orderBy('uc.createdOn', 'DESC');
      }

      const userCertificates = await userCertQuery.getRawMany();

      // Transform the data and fetch related template information
      const transformedData = await Promise.all(
        userCertificates.map(async (record) => {
          // Fetch course template data
          let courseTemplate = null;
          let template = null;

          try {
            const courseTemplateData =
              await this.courseTemplateRepository.findOne({
                where: { contextId: record.uc_contextId },
              });

            if (courseTemplateData) {
              courseTemplate = {
                courseTemplateId: courseTemplateData.coursetemplateId,
                templateId: courseTemplateData.templateId,
                contextId: courseTemplateData.contextId,
                createdOn: courseTemplateData.createdOn,
                updatedOn: courseTemplateData.updatedOn,
              };

              // Fetch template data
              const templateData = await this.templatesRepository.findOne({
                where: { templateId: courseTemplateData.templateId },
              });

              if (templateData) {
                template = {
                  templatesId: templateData.templatesId,
                  templateId: templateData.templateId,
                  template_type: templateData.template_type,
                  title: templateData.title,
                  createdOn: templateData.createdOn,
                  updatedOn: templateData.updatedOn,
                };
              }
            }
          } catch (error) {
            this.loggerService.error(
              'Error fetching related template data:',
              error.message,
            );
          }

          return {
            usercertificateId: record.uc_usercertificateId,
            userId: record.uc_userId,
            contextId: record.uc_contextId,
            contextType: record.uc_contextType,
            tenantId: record.uc_tenantId,
            certificateId: record.uc_certificateId,
            status: record.uc_status,
            issuedOn: record.uc_issuedOn,
            createdOn: record.uc_createdOn,
            updatedOn: record.uc_updatedOn,
            createdBy: record.uc_createdBy,
            updatedBy: record.uc_updatedBy,
            certificate_type: record.uc_certificate_type,
            courseTemplate,
            template,
          };
        }),
      );

      const result = {
        data: transformedData,
        pagination: {
          page: page || 1,
          limit: limit || totalCount,
          total: totalCount,
          totalPages: limit ? Math.ceil(totalCount / limit) : 1,
          hasNext: limit ? (page || 1) < Math.ceil(totalCount / limit) : false,
          hasPrev: limit ? (page || 1) > 1 : false,
        },
      };

      return APIResponse.success(
        res,
        apiId,
        result,
        HttpStatus.OK,
        'User certificates retrieved successfully',
      );
    } catch (error) {
      this.loggerService.error('Error fetching user certificates:', error);
      return APIResponse.error(
        res,
        apiId,
        'Error fetching user certificates',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Add course template mapping
   * @param templateId - Template ID
   * @param contextId - Course ID (contextId)
   * @param res - Response object
   * @param request - Request object
   */
  async addCourseTemplate(
    templateId: string,
    contextId: string,
    userId: string,
    res: Response,
    request: any,
  ) {
    const apiId = 'api.add.course.template';
    try {
      // Check if courseId (contextId) already exists in database
      const existingCourseTemplate =
        await this.courseTemplateRepository.findOne({
          where: { contextId: contextId },
        });

      if (existingCourseTemplate) {
        // Update existing record with new templateId
        existingCourseTemplate.templateId = templateId;
        existingCourseTemplate.updatedOn = new Date();
        existingCourseTemplate.updatedBy = userId;

        await this.courseTemplateRepository.save(existingCourseTemplate);
        this.loggerService.log(
          `Course template updated: ${contextId} -> ${templateId}`,
        );

        return APIResponse.success(
          res,
          apiId,
          {
            courseTemplateId: existingCourseTemplate.coursetemplateId,
            templateId: templateId,
            contextId: contextId,
            action: 'updated',
          },
          HttpStatus.OK,
          'Course template updated successfully',
        );
      } else {
        // Create new record
        const courseTemplate = new CourseTemplate();
        courseTemplate.coursetemplateId = randomUUID();
        courseTemplate.templateId = templateId;
        courseTemplate.contextId = contextId;
        courseTemplate.createdOn = new Date();
        courseTemplate.updatedOn = new Date();
        courseTemplate.createdBy = userId;
        courseTemplate.updatedBy = userId;

        await this.courseTemplateRepository.save(courseTemplate);
        this.loggerService.log(
          `Course template created: ${contextId} -> ${templateId}`,
        );

        return APIResponse.success(
          res,
          apiId,
          {
            courseTemplateId: courseTemplate.coursetemplateId,
            templateId: templateId,
            contextId: contextId,
            action: 'created',
          },
          HttpStatus.CREATED,
          'Course template created successfully',
        );
      }
    } catch (error) {
      this.loggerService.error('Error adding course template:', error.message);
      this.loggerService.error('Error stack:', error.stack);
      this.loggerService.error(
        'Error details:',
        JSON.stringify(
          {
            message: error.message,
            code: error.code,
            detail: error.detail,
            constraint: error.constraint,
          },
          null,
          2,
        ),
      );
      return APIResponse.error(
        res,
        apiId,
        'Error adding course template',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get template HTML by templateId from external service
   * @param templateId - Template ID
   * @param res - Response object
   */
  async getTemplate(templateId: string, res: Response) {
    const apiId = 'api.get.template';
    try {
      const url =
        this.configService.get('RC_CREDENTIAL_SCHEMA_API_BASE_URL') +
        `/template/${templateId}`;

      this.loggerService.log(`Fetching template from URL: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      this.loggerService.log(
        `External service response status: ${response.status}`,
      );

      // Fetch template details from local database
      let localTemplateData = null;
      let courseTemplateData = null;

      try {
        // Get template details from templates table
        const template = await this.templatesRepository.findOne({
          where: { templateId: templateId },
        });

        if (template) {
          localTemplateData = {
            templatesId: template.templatesId,
            templateId: template.templateId,
            template_type: template.template_type,
            title: template.title,
            createdOn: template.createdOn,
            updatedOn: template.updatedOn,
            createdBy: template.createdBy,
            updatedBy: template.updatedBy,
          };

          // Get course template data associated with this template
          const courseTemplate = await this.courseTemplateRepository.findOne({
            where: { templateId: templateId },
          });

          if (courseTemplate) {
            courseTemplateData = {
              courseTemplateId: courseTemplate.coursetemplateId,
              templateId: courseTemplate.templateId,
              contextId: courseTemplate.contextId,
              createdOn: courseTemplate.createdOn,
              updatedOn: courseTemplate.updatedOn,
              createdBy: courseTemplate.createdBy,
              updatedBy: courseTemplate.updatedBy,
            };
          }
        }
      } catch (dbError) {
        this.loggerService.error(
          'Error fetching template from local database:',
          dbError.message,
        );
      }

      if (response.data) {
        // Combine external service response with local database data
        const combinedResponse = {
          ...response.data,
          localTemplate: localTemplateData,
          courseTemplate: courseTemplateData,
        };

        return APIResponse.success(
          res,
          apiId,
          combinedResponse,
          HttpStatus.OK,
          'Template retrieved successfully',
        );
      } else {
        return APIResponse.error(
          res,
          apiId,
          'No template data found',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      this.loggerService.error('Error fetching template:', error.message);

      if (error.response?.status === 404) {
        return APIResponse.error(
          res,
          apiId,
          'Template not found',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }

      return APIResponse.error(
        res,
        apiId,
        'Error fetching template',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all templates with course template data, pagination and filtering
   * @param filters - Filter and pagination parameters
   * @param res - Response object
   */
  async getTemplates(filters: any, res: Response) {
    const apiId = 'api.get.templates';
    try {
      const {
        title,
        templateType,
        templateId,
        contextId,
        limit = 10,
        offset = 0,
      } = filters;

      // Build query with joins
      let query = this.templatesRepository
        .createQueryBuilder('t')
        .leftJoin('course_templates', 'ct', 't.templateId = ct.templateId')
        .select([
          't.templatesId',
          't.templateId',
          't.template_type',
          't.title',
          't.createdOn',
          't.updatedOn',
          't.createdBy',
          't.updatedBy',
          'ct.coursetemplateId',
          'ct.contextId',
          'ct.createdOn as courseCreatedOn',
          'ct.updatedOn as courseUpdatedOn',
          'ct.createdBy as courseCreatedBy',
          'ct.updatedBy as courseUpdatedBy',
        ]);

      // Apply filters
      if (title) {
        query = query.andWhere('t.title ILIKE :title', { title: `%${title}%` });
      }

      if (templateId) {
        query = query.andWhere('t.templateId = :templateId', { templateId });
      }

      if (contextId) {
        query = query.andWhere('ct.contextId = :contextId', { contextId });
      }

      if (templateType) {
        query = query.andWhere('t.template_type = :templateType', {
          templateType,
        });
      }

      // Get total count for pagination
      const totalCount = await query.getCount();

      // Apply pagination
      query = query.orderBy('t.createdOn', 'DESC').limit(limit).offset(offset);

      const templates = await query.getRawMany();

      // Transform the data to a more structured format
      const transformedTemplates = templates.map((template) => ({
        templatesId: template.t_templatesId,
        templateId: template.t_templateId,
        templateType: template.t_template_type,
        title: template.t_title,
        createdOn: template.t_createdOn,
        updatedOn: template.t_updatedOn,
        createdBy: template.t_createdBy,
        updatedBy: template.t_updatedBy,
        courseTemplate: template.ct_coursetemplateId
          ? {
              courseTemplateId: template.ct_coursetemplateId,
              contextId: template.ct_contextId,
              createdOn: template.courseCreatedOn,
              updatedOn: template.courseUpdatedOn,
              createdBy: template.courseCreatedBy,
              updatedBy: template.courseUpdatedBy,
            }
          : null,
      }));

      // Calculate pagination info
      const hasNext = offset + limit < totalCount;
      const hasPrev = offset > 0;
      const totalPages = Math.ceil(totalCount / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      const response = {
        templates: transformedTemplates,
        pagination: {
          totalCount,
          totalPages,
          currentPage,
          limit,
          offset,
          hasNext,
          hasPrev,
        },
      };

      this.loggerService.log(
        `Retrieved ${transformedTemplates.length} templates out of ${totalCount} total`,
      );

      return APIResponse.success(
        res,
        apiId,
        response,
        HttpStatus.OK,
        'Templates retrieved successfully',
      );
    } catch (error) {
      this.loggerService.error('Error fetching templates:', error.message);
      return APIResponse.error(
        res,
        apiId,
        'Error fetching templates',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all course templates with pagination and filtering
   * @param filters - Filter and pagination parameters
   * @param res - Response object
   */
  async getCourseTemplateList(filters: any, res: Response) {
    const apiId = 'api.get.course.template.list';
    try {
      const { contextId, templateId, limit = 10, offset = 0 } = filters;

      // Build query for course templates
      let query = this.courseTemplateRepository
        .createQueryBuilder('ct')
        .leftJoin('templates', 't', 'ct.templateId = t.templateId')
        .select([
          'ct.coursetemplateId',
          'ct.templateId',
          'ct.contextId',
          'ct.createdOn',
          'ct.updatedOn',
          'ct.createdBy',
          'ct.updatedBy',
          't.templatesId',
          't.template_type',
          't.title as title',
        ]);

      // Apply filters
      if (contextId) {
        query = query.andWhere('ct.contextId = :contextId', { contextId });
      }

      if (templateId) {
        query = query.andWhere('ct.templateId = :templateId', { templateId });
      }

      // Get total count for pagination
      const totalCount = await query.getCount();

      // Apply pagination
      query = query.orderBy('ct.createdOn', 'DESC').limit(limit).offset(offset);

      const courseTemplates = await query.getRawMany();

      // Transform the data to a more structured format
      const transformedCourseTemplates = courseTemplates.map(
        (courseTemplate) => ({
          courseTemplateId: courseTemplate.ct_coursetemplateId,
          templateId: courseTemplate.ct_templateId,
          contextId: courseTemplate.ct_contextId,
          createdOn: courseTemplate.ct_createdOn,
          updatedOn: courseTemplate.ct_updatedOn,
          createdBy: courseTemplate.ct_createdBy,
          updatedBy: courseTemplate.ct_updatedBy,
          template: courseTemplate.t_templatesId
            ? {
                templatesId: courseTemplate.t_templatesId,
                templateType: courseTemplate.t_template_type,
                title: courseTemplate.title,
              }
            : null,
        }),
      );

      // Calculate pagination info
      const hasNext = offset + limit < totalCount;
      const hasPrev = offset > 0;
      const totalPages = Math.ceil(totalCount / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      const response = {
        courseTemplates: transformedCourseTemplates,
        pagination: {
          totalCount,
          totalPages,
          currentPage,
          limit,
          offset,
          hasNext,
          hasPrev,
        },
      };

      this.loggerService.log(
        `Retrieved ${transformedCourseTemplates.length} course templates out of ${totalCount} total`,
      );

      return APIResponse.success(
        res,
        apiId,
        response,
        HttpStatus.OK,
        'Course templates retrieved successfully',
      );
    } catch (error) {
      this.loggerService.error(
        'Error fetching course templates:',
        error.message,
      );
      return APIResponse.error(
        res,
        apiId,
        'Error fetching course templates',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Edit/Update template via external credential service and update local database
   * @param templateId - Template ID to update
   * @param template - Template content
   * @param type - Template type (certificate or badge)
   * @param title - Template title (optional)
   * @param template_type - Template type for database (optional)
   * @param res - Response object
   */
  async editTemplate(
    templateId: string,
    template: string,
    type: string,
    title?: string,
    template_type?: string,
    res?: Response,
  ) {
    const apiId = 'api.edit.template';
    try {
      const url =
        this.configService.get('RC_CREDENTIAL_SCHEMA_API_BASE_URL') +
        `/template/${templateId}`;

      const requestBody = {
        template: template,
        type: type,
      };

      const response = await axios.put(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Update local database if title or template_type is provided
      if (title || template_type) {
        try {
          const updateData: Partial<Templates> = {};

          if (title) {
            updateData.title = title;
          }

          if (template_type) {
            updateData.template_type = template_type;
          }

          // Update the template in local database
          await this.templatesRepository.update(
            { templateId: templateId },
            updateData,
          );
        } catch (dbError) {
          this.loggerService.error(
            'Error updating template in local database:',
            dbError.message,
          );
          // Continue with external service response even if database update fails
        }
      }

      // Fetch updated template data from local database to include title and template_type
      let localTemplateData = null;
      try {
        const localTemplate = await this.templatesRepository.findOne({
          where: { templateId: templateId },
          select: ['title', 'template_type'],
        });
        localTemplateData = localTemplate;
      } catch (dbError) {
        this.loggerService.error(
          'Error fetching updated template from local database:',
          dbError.message,
        );
      }

      // Prepare response data combining external service response with local database data
      const responseData = {
        ...response.data,
        title: localTemplateData?.title || null,
        template_type: localTemplateData?.template_type || null,
      };

      if (response.data && res) {
        return APIResponse.success(
          res,
          apiId,
          responseData,
          HttpStatus.OK,
          'Template updated successfully',
        );
      } else if (res) {
        return APIResponse.error(
          res,
          apiId,
          'No response data from external service',
          'INTERNAL_SERVER_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      } else {
        return responseData;
      }
    } catch (error) {
      this.loggerService.error('Error updating template:', error.message);

      if (res) {
        if (error.response?.status === 404) {
          return APIResponse.error(
            res,
            apiId,
            'Template not found',
            'NOT_FOUND',
            HttpStatus.NOT_FOUND,
          );
        }

        if (error.response?.status === 400) {
          return APIResponse.error(
            res,
            apiId,
            'Invalid template data',
            'BAD_REQUEST',
            HttpStatus.BAD_REQUEST,
          );
        }

        return APIResponse.error(
          res,
          apiId,
          'Error updating template',
          'INTERNAL_SERVER_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      } else {
        throw error;
      }
    }
  }
}
