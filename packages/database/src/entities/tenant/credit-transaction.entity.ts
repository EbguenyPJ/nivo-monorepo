import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CreditAccount } from './credit-account.entity';
import { Sale } from './sale.entity';
import { Employee } from './employee.entity';

/**
 * Every movement in a credit account is logged here.
 * Types:
 * - charge:   Sale charged to credit (increases debt)
 * - payment:  Customer pays down their debt (cash, transfer, etc.)
 * - adjustment_credit:  Admin reduces debt manually
 * - adjustment_debit:   Admin increases debt manually
 */
@Entity('credit_transactions')
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  credit_account_id: string;

  @ManyToOne(() => CreditAccount, (ca) => ca.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'credit_account_id' })
  credit_account: CreditAccount;

  @Column({
    type: 'enum',
    enum: ['charge', 'payment', 'adjustment_credit', 'adjustment_debit'],
  })
  type: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  /** Running balance after this transaction */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  balance_after: number;

  /** Optional link to the sale that generated a charge */
  @Column({ type: 'uuid', nullable: true })
  sale_id: string | null;

  @ManyToOne(() => Sale, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale | null;

  /** For payments: cash, transfer, card, etc. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  payment_method: string | null;

  /** For payments/adjustments: reference number or description */
  @Column({ type: 'varchar', length: 500, nullable: true })
  reference: string | null;

  /** Due date for this specific charge (calculated from payment_terms) */
  @Column({ type: 'date', nullable: true })
  due_date: Date | null;

  @Column({ type: 'uuid', nullable: true })
  employee_id: string | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee | null;

  /** POS session where this transaction happened */
  @Column({ type: 'uuid', nullable: true })
  pos_session_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
