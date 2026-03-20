import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SupportTicket } from './support-ticket.entity';

@Entity('ticket_messages')
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ticket_id: string;

  @Column({ type: 'varchar', length: 20 })
  sender_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sender_name: string;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => SupportTicket, (ticket) => ticket.messages)
  @JoinColumn({ name: 'ticket_id' })
  ticket: SupportTicket;
}
