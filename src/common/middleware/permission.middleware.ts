import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction, response } from 'express';
import { RolePermissionService } from 'src/modules/permissionRbac/rolePermissionMapping/role-permission-mapping.service';
import APIResponse from '../utils/response';

@Injectable()
export class PermissionMiddleware implements NestMiddleware {
  constructor(private readonly rolePermissionService: RolePermissionService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    const isPermissionValid = await this.checkPermissions(
      'Admin',
      req.baseUrl,
      req.method,
      res,
    );
    if (isPermissionValid) return next();
    else {
      return APIResponse.error(
        response,
        '',
        'You do not have permission to access this resource',
        'You do not have permission to access this resource',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async checkPermissions(roleTitle, requestPath, requestMethod, response) {
    const parts = requestPath.match(/[^/]+/g);
    const apiPath = this.getApiPaths(parts);
    const allowedPermissions = await this.fetchPermissions(
      roleTitle,
      apiPath,
      response,
    );
    return allowedPermissions.some((permission) =>
      permission.requestType.includes(requestMethod),
    );
  }

  getApiPaths(parts: string[]) {
    //user/v1/tenant/update --> /user/v1/tenant/*
    //user/v1/list ==> user/v1/*
    let apiPath = '';
    if (parts.length == 3) apiPath = `/${parts[0]}/${parts[1]}/*`;
    if (parts.length > 3) apiPath = `/${parts[0]}/${parts[1]}/${parts[2]}/*`;

    console.log('apiPath: ', apiPath);
    return apiPath;
  }

  async fetchPermissions(roleTitle, apiPath, response) {
    return await this.rolePermissionService.getPermission(
      roleTitle,
      apiPath,
      response,
    );
  }
}
