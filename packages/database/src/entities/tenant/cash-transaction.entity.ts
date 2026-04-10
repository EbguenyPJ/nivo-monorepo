import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PosSession } from './pos-session.entity';
import { Employee } from './employee.entity';

/**
 * Tracks every cash movement within a POS session.
 * Types:
 * - sale_cash: Cash portion of a sale (auto-created by system)
 * - refund:    Cash refund (auto-created by system)
 * - cash_in:   Manual cash deposit (e.g. extra change fund)
 * - cash_out:  Manual cash withdrawal / sangria (security withdrawal)
 * - audit:     Blind audit (Corte X) — records declared amount mid-shift
 */
@Entity('cash_transactions')
export class CashTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  session_id: string;

  @ManyToOne(() => PosSession)
  @JoinColumn({ name: 'session_id' })
  session: PosSession;

  @Column({ type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({
    type: 'enum',
    enum: ['sale_cash', 'refund', 'cash_in', 'cash_out', 'audit'],
  })
  type: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** For audit type: the declared amount the cashier counted */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  declared_amount: number | null;

  /** For audit type: system expected amount at time of audit */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  expected_amount: number | null;

  /** For audit type: declared - expected */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  difference: number | null;

  @CreateDateColumn()
  created_at: Date;
}
