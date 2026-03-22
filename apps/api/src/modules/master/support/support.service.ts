import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { SupportTicket, TicketMessage, TicketAttachment } from '@nivo/database';

@Injectable()
export class SupportService implements OnModuleInit {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(TicketMessage)
    private readonly messageRepo: Repository<TicketMessage>,
    @InjectRepository(TicketAttachment)
    private readonly attachmentRepo: Repository<TicketAttachment>,
  ) {}

  onModuleInit() {
    const uploadDir = join(process.cwd(), 'uploads', 'support');
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }
  }

  async findAll(
    page: number,
    limit: number,
    filters?: { status?: string; priority?: string; tenant_id?: string; search?: string },
  ) {
    const qb = this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.messages', 'msg')
      .orderBy('ticket.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters?.status) {
      qb.andWhere('ticket.status = :status', { status: filters.status });
    }
    if (filters?.priority) {
      qb.andWhere('ticket.priority = :priority', { priority: filters.priority });
    }
    if (filters?.tenant_id) {
      qb.andWhere('ticket.tenant_id = :tenantId', { tenantId: filters.tenant_id });
    }
    if (filters?.search) {
      qb.andWhere('(LOWER(ticket.subject) LIKE :search OR LOWER(ticket.tenant_name) LIKE :search)', {
        search: `%${filters.search.toLowerCase()}%`,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['messages'],
      order: { messages: { created_at: 'ASC' } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const attachments = await this.attachmentRepo.find({
      where: { ticket_id: id },
      order: { created_at: 'ASC' },
    });

    return { ...ticket, attachments };
  }

  async create(
    data: Record<string, any>,
    files?: Express.Multer.File[],
  ) {
    const ticket = this.ticketRepo.create({
      tenant_id: data.tenant_id,
      tenant_name: data.tenant_name,
      subject: data.subject,
      category: data.category || 'general',
      status: 'open',
      priority: data.priority || 'medium',
    });

    const savedTicket = await this.ticketRepo.save(ticket);

    const firstMessage = this.messageRepo.create({
      ticket_id: savedTicket.id,
      sender_type: 'tenant',
      sender_name: data.tenant_name,
      message: data.message,
    });

    const savedMessage = await this.messageRepo.save(firstMessage);

    if (files && files.length > 0) {
      const attachments = files.map((file) =>
        this.attachmentRepo.create({
          ticket_id: savedTicket.id,
          message_id: savedMessage.id,
          original_name: file.originalname,
          stored_name: file.filename,
          mime_type: file.mimetype,
          size: file.size,
          path: file.path,
        }),
      );
      await this.attachmentRepo.save(attachments);
    }

    return this.findOne(savedTicket.id);
  }

  async addMessage(ticketId: string, data: { sender_type: string; sender_name: string; message: string }, files?: Express.Multer.File[]) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const msg = this.messageRepo.create({
      ticket_id: ticketId,
      sender_type: data.sender_type,
      sender_name: data.sender_name,
      message: data.message,
    });

    const savedMsg = await this.messageRepo.save(msg);

    if (files && files.length > 0) {
      const attachments = files.map((file) =>
        this.attachmentRepo.create({
          ticket_id: ticketId,
          message_id: savedMsg.id,
          original_name: file.originalname,
          stored_name: file.filename,
          mime_type: file.mimetype,
          size: file.size,
          path: file.path,
        }),
      );
      await this.attachmentRepo.save(attachments);
    }

    // Auto-update status to in_progress if admin replies to an open ticket
    if (data.sender_type === 'admin' && ticket.status === 'open') {
      ticket.status = 'in_progress';
      await this.ticketRepo.save(ticket);
    }

    return this.findOne(ticketId);
  }

  async updateStatus(id: string, status: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    ticket.status = status;
    return this.ticketRepo.save(ticket);
  }

  async getStats() {
    const total = await this.ticketRepo.count();
    const open = await this.ticketRepo.count({ where: { status: 'open' } });
    const inProgress = await this.ticketRepo.count({ where: { status: 'in_progress' } });
    const resolved = await this.ticketRepo.count({ where: { status: 'resolved' } });

    // Avg response time: average time between ticket creation and first admin message
    const ticketsWithMessages = await this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.messages', 'msg')
      .getMany();

    let totalResponseTime = 0;
    let respondedCount = 0;

    for (const ticket of ticketsWithMessages) {
      const adminMsg = ticket.messages?.find((m) => m.sender_type === 'admin');
      if (adminMsg) {
        const diff = new Date(adminMsg.created_at).getTime() - new Date(ticket.created_at).getTime();
        totalResponseTime += diff;
        respondedCount++;
      }
    }

    const avgResponseTime = respondedCount > 0
      ? Math.round(totalResponseTime / respondedCount / (1000 * 60)) // in minutes
      : 0;

    return { total, open, inProgress, resolved, avgResponseTime };
  }
}
