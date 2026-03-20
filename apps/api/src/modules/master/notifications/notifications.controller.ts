import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles('super-admin', 'soporte')
  findAll(
    @Query('limit') limit = 20,
    @Query('unread') unread?: string,
  ) {
    return this.notificationsService.findAll({
      limit: +limit,
      unreadOnly: unread === 'true',
    });
  }

  @Get('unread-count')
  @Roles('super-admin', 'soporte')
  getUnreadCount() {
    return this.notificationsService.getUnreadCount();
  }

  @Patch(':id/read')
  @Roles('super-admin', 'soporte')
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('read-all')
  @Roles('super-admin', 'soporte')
  markAllAsRead() {
    return this.notificationsService.markAllAsRead();
  }
}
