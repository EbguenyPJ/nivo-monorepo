import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Branch } from './branch.entity';
import { Employee } from './employee.entity';
import { Customer } from './customer.entity';

@Entity('pre_sales')
export class PreSale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({
    type: 'enum',
    enum: ['open', 'converted', 'expired'],
    default: 'open',
  })
  status: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_amount: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  qr_code: string;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @OneToMany('PreSaleItem', 'pre_sale', { cascade: true })
  items: any[];

  @CreateDateColumn()
  created_at: Date;
}
