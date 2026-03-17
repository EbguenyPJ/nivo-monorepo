import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Branch } from './branch.entity';

@Entity('pos_sessions')
export class PosSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  opening_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  closing_amount: number | null;

  @Column({ type: 'enum', enum: ['open', 'closed'], default: 'open' })
  status: string;

  @CreateDateColumn()
  opened_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  closed_at: Date | null;
}
