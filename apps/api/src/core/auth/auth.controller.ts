import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { email: string; password: string; tenant?: string },
  ) {
    if (body.tenant) {
      return this.authService.loginEmployee(body.email, body.password, body.tenant);
    }
    return this.authService.loginSuperAdmin(body.email, body.password);
  }

  @Post('login/pin')
  async loginPin(
    @Body() body: { pin_code: string; tenant: string; branch_id: string },
  ) {
    return this.authService.loginByPin(body.pin_code, body.tenant, body.branch_id);
  }

  @Post('impersonate/:tenantId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async impersonate(@Request() req: any, @Body() body: { tenant_id: string }) {
    return this.authService.impersonate(req.user.sub, body.tenant_id);
  }

  @Post('logout')
  async logout() {
    return { message: 'Logged out successfully' };
  }
}
