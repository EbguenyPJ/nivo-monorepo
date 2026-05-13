import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Branch } from './branch.entity';
import { Employee } from './employee.entity';
import { ExpenseCategory } from './expense-category.entity';
import { PosSession } from './pos-session.entity';

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ type: 'uuid' })
  category_id: string;

  @ManyToOne(() => ExpenseCategory)
  @JoinColumn({ name: 'category_id' })
  category: ExpenseCategory;

  @Column({ type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  /** If paid from POS register, links to the active session for cash tracking */
  @Column({ type: 'uuid', nullable: true })
  pos_session_id: string | null;

  @ManyToOne(() => PosSession, { nullable: true })
  @JoinColumn({ name: 'pos_session_id' })
  pos_session: PosSession | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'text' })
  description: string;

  /** 'cash' = from POS register, 'bank' = from bank account (doesn't affect cash register) */
  @Column({ type: 'varchar', length: 20, default: 'bank' })
  payment_source: string;

  /** Optional receipt/ticket image path */
  @Column({ type: 'varchar', length: 500, nullable: true })
  receipt_url: string | null;

  @Column({ type: 'date' })
  date: string;

  /** Cancelled expenses: soft-flag instead of delete */
  @Column({ type: 'boolean', default: false })
  is_cancelled: boolean;

  /** Who cancelled + reason */
  @Column({ type: 'text', nullable: true })
  cancellation_note: string | null;

  @CreateDateColumn()
  created_at: Date;
}
