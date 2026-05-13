import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ReportingGuard implements CanActivate {
  private readonly logger = new Logger(ReportingGuard.name);
  private readonly usedTokens = new Set<string>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token =
      (request.query.token as string) ||
      request.headers['x-print-token'] as string;

    if (!token) {
      throw new UnauthorizedException('Report access token required');
    }

    if (this.usedTokens.has(token)) {
      throw new UnauthorizedException('Token already consumed (single-use)');
    }

    let payload: any;
    try {
      payload = this.jwt.verify(token, {
        secret: this.config.get('JWT_SECRET'),
      });
    } catch (err: any) {
      this.logger.warn(`Invalid report token: ${err.message}`);
      throw new UnauthorizedException('Invalid or expired report token');
    }

    if (payload.purpose !== 'report-render') {
      throw new UnauthorizedException('Token purpose mismatch');
    }

    this.usedTokens.add(token);

    setTimeout(() => {
      this.usedTokens.delete(token);
    }, 120_000);

    (request as any).reportPayload = payload;
    return true;
  }
}
