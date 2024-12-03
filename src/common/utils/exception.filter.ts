// import {
//   ExceptionFilter,
//   Catch,
//   ArgumentsHost,
//   HttpException,
//   HttpStatus,
// } from '@nestjs/common';
// import { QueryFailedError } from 'typeorm';
// import { Response, Request } from 'express';
// import APIResponse from '../utils/response';
// import { LoggerService } from '../logger/logger.service';

// @Catch()
// export class AllExceptionsFilter implements ExceptionFilter {
//   constructor(
//     private readonly apiId?: string,
//     private loggerService?: LoggerService,
//   ) {}
//   catch(exception: unknown, host: ArgumentsHost) {
//     const ctx = host.switchToHttp();
//     const response = ctx.getResponse<Response>();
//     const request = ctx.getRequest<Request>();
//     const userId = request.query.userId;

//     const status =
//       exception instanceof HttpException ? exception.getStatus() : 500;
//     const exceptionResponse =
//       exception instanceof HttpException ? exception.getResponse() : null;
//     const errorMessage =
//       exception instanceof HttpException
//         ? (exceptionResponse as any).message || exception.message
//         : 'INTERNAL_SERVER_ERROR';

//     console.log(
//       `Error occurred on API: ${request.url} for Method:  ${request.method}`,
//       errorMessage,
//       'TodoService',
//       `userId: ${userId}`,
//     );
//     if (exception instanceof QueryFailedError) {
//       const statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
//       const errorResponse = APIResponse.error(
//         response,
//         this.apiId,
//         (exception as QueryFailedError).message,
//         'NTERNAL_SERVER_ERROR',
//         statusCode,
//       );
//       this.loggerService.error(
//         `Database Query Failed on API: ${request.url} for Method: ${request.method}`,
//         (exception as QueryFailedError).message,
//         'TodoService',
//         `userId: ${userId}`,
//       );
//       return response.status(statusCode).json(errorResponse);
//     }
//     const detailedErrorMessage = `${errorMessage}`;
//     const errorResponse = APIResponse.error(
//       response,
//       this.apiId,
//       detailedErrorMessage,
//       exception instanceof HttpException
//         ? exception.name
//         : 'INTERNAL_SERVER_ERROR',
//       status,
//     );
//     return response.status(status).json(errorResponse);
//   }
// }
