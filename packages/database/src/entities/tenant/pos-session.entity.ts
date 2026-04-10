import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Branch } from './branch.entity';
import { CashRegister } from './cash-register.entity';
import { CashTransaction } from './cash-transaction.entity';

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

  @Column({ type: 'uuid', nullable: true })
  cash_register_id: string | null;

  @ManyToOne(() => CashRegister)
  @JoinColumn({ name: 'cash_register_id' })
  cash_register: CashRegister;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  opening_amount: number;

  /** Amount the cashier declared during Corte Z (blind close) */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  closing_amount: number | null;

  /** System-calculated expected cash amount at close time */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  expected_amount: number | null;

  /** closing_amount - expected_amount (positive = surplus, negative = shortage) */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  difference: number | null;

  @Column({ type: 'enum', enum: ['open', 'closed'], default: 'open' })
  status: string;

  @CreateDateColumn()
  opened_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  closed_at: Date | null;

  /** Employee who forced the close (if different from session owner) */
  @Column({ type: 'uuid', nullable: true })
  closed_by: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'closed_by' })
  closer: Employee | null;

  @OneToMany(() => CashTransaction, (tx) => tx.session)
  cash_transactions: CashTransaction[];
}
