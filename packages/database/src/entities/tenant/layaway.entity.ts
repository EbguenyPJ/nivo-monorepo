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
import { Branch } from './branch.entity';
import { Employee } from './employee.entity';

@Entity('layaways')
export class Layaway {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Auto-incrementing folio for display: APT-0001 */
  @Column({ type: 'int', generated: 'increment' })
  folio_number: number;

  @Index()
  @Column({ type: 'uuid' })
  customer_id: string;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  /** Total value of all items */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_amount: number;

  /** Initial down payment (enganche) */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  down_payment: number;

  /** Remaining balance to be paid */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  balance_due: number;

  @Column({
    type: 'enum',
    enum: ['active', 'paid_delivered', 'cancelled_refunded', 'cancelled_forfeited'],
    default: 'active',
  })
  status: string;

  /** Deadline for the customer to fully pay */
  @Column({ type: 'date' })
  due_date: Date;

  /** POS session where the layaway was created */
  @Column({ type: 'uuid', nullable: true })
  pos_session_id: string | null;

  /** Sale that is generated on final delivery (paid_delivered) */
  @Column({ type: 'uuid', nullable: true })
  final_sale_id: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany('LayawayItem', 'layaway', { cascade: true })
  items: any[];

  @OneToMany('LayawayPayment', 'layaway', { cascade: true })
  payments: any[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
