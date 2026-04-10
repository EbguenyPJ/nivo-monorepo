import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { PosSession } from './pos-session.entity';
import { Customer } from './customer.entity';
import { Employee } from './employee.entity';
import { Branch } from './branch.entity';
import { SaleItem } from './sale-item.entity';
import { SalePayment } from './sale-payment.entity';
import { SaleReturn } from './sale-return.entity';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  pos_session_id: string | null;

  @ManyToOne(() => PosSession, { nullable: true })
  @JoinColumn({ name: 'pos_session_id' })
  pos_session: PosSession | null;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

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
  total_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tax_amount: number;

  @Column({ type: 'enum', enum: ['cash', 'card', 'mixed', 'online'] })
  payment_method: string;

  @Column({ type: 'enum', enum: ['in_store', 'click_and_collect', 'delivery'], default: 'in_store' })
  sale_type: string;

  @Column({ type: 'enum', enum: ['completed', 'pending', 'partial_return', 'refunded'], default: 'completed' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
  items: SaleItem[];

  @OneToMany(() => SalePayment, (payment) => payment.sale, { cascade: true })
  payments: SalePayment[];

  @OneToMany(() => SaleReturn, (ret) => ret.sale)
  returns: SaleReturn[];

  @CreateDateColumn()
  created_at: Date;
}
