import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from './customer.entity';
import { Sale } from './sale.entity';
import { Employee } from './employee.entity';

/**
 * Auditable ledger for loyalty points — every point movement is tracked.
 * Types:
 * - earned:           Points from a completed sale
 * - redeemed:         Points used as payment in POS
 * - expired:          Automated expiration (batch job)
 * - manual_credit:    Admin manually grants points
 * - manual_debit:     Admin manually deducts points
 * - layaway_earned:   Points earned on layaway final payment
 */
@Entity('loyalty_ledgers')
export class LoyaltyLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  customer_id: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  /** Optional: the sale that generated or consumed these points */
  @Column({ type: 'uuid', nullable: true })
  sale_id: string | null;

  @ManyToOne(() => Sale, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale | null;

  @Column({
    type: 'enum',
    enum: ['earned', 'redeemed', 'expired', 'manual_credit', 'manual_debit', 'layaway_earned'],
  })
  type: string;

  /** Points added (positive for earned/credit, 0 for redeemed/expired) */
  @Column({ type: 'int', default: 0 })
  points_earned: number;

  /** Points consumed (positive for redeemed/expired/debit, 0 for earned) */
  @Column({ type: 'int', default: 0 })
  points_spent: number;

  /** Running balance after this transaction */
  @Column({ type: 'int', default: 0 })
  balance_after: number;

  /** Description / reason */
  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  /** Employee who performed the action */
  @Column({ type: 'uuid', nullable: true })
  employee_id: string | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee | null;

  @CreateDateColumn()
  created_at: Date;
}
