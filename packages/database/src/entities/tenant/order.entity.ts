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

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', generated: 'increment' })
  order_number: number;

  @Index()
  @Column({ type: 'uuid' })
  customer_id: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @Column({ type: 'uuid', nullable: true })
  employee_id: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee | null;

  @Column({
    type: 'enum',
    enum: ['bopis', 'delivery', 'ship_to_home'],
    default: 'bopis',
  })
  fulfillment_type: string;

  @Index()
  @Column({
    type: 'enum',
    enum: [
      'pending_payment', 'paid', 'picking', 'packed',
      'ready_for_pickup', 'picked_up',
      'out_for_delivery', 'delivered', 'cancelled',
    ],
    default: 'pending_payment',
  })
  status: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discount_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  tax_amount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_payment_intent_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  shipping_address: Record<string, string> | null;

  @Column({ type: 'uuid', nullable: true })
  pickup_branch_id: string | null;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'pickup_branch_id' })
  pickup_branch: Branch | null;

  @Column({ type: 'uuid', nullable: true })
  shipping_method_id: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  shipping_cost: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  pickup_location: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  signature_url: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  packed_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @OneToMany('OrderItem', 'order', { cascade: true })
  items: any[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  get folio(): string {
    return `ORD-${String(this.order_number).padStart(5, '0')}`;
  }
}
