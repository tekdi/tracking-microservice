import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Extract tenantId from request headers
    const tenantId = request.headers.tenantId || 
                     request.headers.tenantid || 
                     request.headers['x-tenant-id'] || 
                     null;
    
    // Validate tenantId is required
    if (!tenantId) {
      throw new BadRequestException('tenantId is required in the header');
    }
    
    // Add tenantId to request object for easy access in controllers/services
    request.tenantId = tenantId;
    
    return true;
  }
}