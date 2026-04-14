import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from './customer.entity';

/**
 * Wholesale / B2B credit account for trusted customers.
 * One account per customer.
 */
@Entity('credit_accounts')
export class CreditAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  customer_id: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  /** Maximum credit allowed */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  credit_limit: number;

  /** Current outstanding debt */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  current_balance: number;

  /** Payment terms in days (e.g. 15, 30) */
  @Column({ type: 'int', default: 30 })
  payment_terms: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany('CreditTransaction', 'credit_account', { cascade: true })
  transactions: any[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  /** Available credit = credit_limit - current_balance */
  get available_credit(): number {
    return Number(this.credit_limit) - Number(this.current_balance);
  }
}
