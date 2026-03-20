import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '@nivo/database';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async findAll(options: { limit?: number; unreadOnly?: boolean }) {
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .orderBy('n.created_at', 'DESC')
      .take(options.limit || 20);

    if (options.unreadOnly) {
      qb.where('n.is_read = :isRead', { isRead: false });
    }

    const [data, total] = await qb.getManyAndCount();
    const unreadCount = await this.notificationRepo.count({ where: { is_read: false } });

    return { data, total, unreadCount };
  }

  async markAsRead(id: string) {
    await this.notificationRepo.update(id, { is_read: true });
    return { success: true };
  }

  async markAllAsRead() {
    await this.notificationRepo.update({ is_read: false }, { is_read: true });
    return { success: true };
  }

  async create(data: {
    type: string;
    title: string;
    message: string;
    tenant_id?: string;
    tenant_name?: string;
  }) {
    const notification = this.notificationRepo.create({
      type: data.type,
      title: data.title,
      message: data.message,
      tenant_id: data.tenant_id || null,
      tenant_name: data.tenant_name || null,
      is_read: false,
    });

    return this.notificationRepo.save(notification);
  }

  async getUnreadCount() {
    const count = await this.notificationRepo.count({ where: { is_read: false } });
    return { unreadCount: count };
  }
}
