import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TicketMessage } from './ticket-message.entity';

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 255 })
  tenant_name: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'varchar', length: 50, default: 'open' })
  status: string;

  @Column({ type: 'varchar', length: 50, default: 'medium' })
  priority: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => TicketMessage, (msg) => msg.ticket, { cascade: true })
  messages: TicketMessage[];
}
