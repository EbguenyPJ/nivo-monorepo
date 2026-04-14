import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Layaway } from './layaway.entity';
import { Employee } from './employee.entity';
import { PosSession } from './pos-session.entity';

/**
 * Each payment (abono) made towards a layaway.
 * The first payment is the down_payment (enganche).
 */
@Entity('layaway_payments')
export class LayawayPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  layaway_id: string;

  @ManyToOne(() => Layaway, (l) => l.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'layaway_id' })
  layaway: Layaway;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  /** cash, card, transfer, mixed */
  @Column({ type: 'varchar', length: 50 })
  payment_method: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string | null;

  @Column({ type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  /** POS session where this payment was collected */
  @Column({ type: 'uuid', nullable: true })
  pos_session_id: string | null;

  @ManyToOne(() => PosSession, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pos_session_id' })
  pos_session: PosSession | null;

  @CreateDateColumn()
  created_at: Date;
}
