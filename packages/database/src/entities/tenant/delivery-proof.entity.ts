import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Employee } from './employee.entity';

@Entity('delivery_proofs')
export class DeliveryProof {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  order_id: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  photo_url: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipient_name: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    type: 'enum',
    enum: ['pending', 'delivered', 'failed'],
    default: 'delivered',
  })
  status: string;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  delivered_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
