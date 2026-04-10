import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Sale } from './sale.entity';
import { Employee } from './employee.entity';
import { Branch } from './branch.entity';
import { PosSession } from './pos-session.entity';
import { SaleReturnItem } from './sale-return-item.entity';

/**
 * Master return record.
 * A return is ALWAYS linked to an original sale (parent).
 * The original sale is NEVER modified — only its status is updated to
 * 'partial_return' or 'refunded' to reflect the current state.
 */
@Entity('sale_returns')
export class SaleReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Original sale being (partially) returned */
  @Column({ type: 'uuid' })
  sale_id: string;

  @ManyToOne(() => Sale)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  /** Employee who processed the return (manager/admin) */
  @Column({ type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  /** Branch where the return was processed */
  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  /** POS session active when the return was processed (for cash tracking) */
  @Column({ type: 'uuid', nullable: true })
  pos_session_id: string | null;

  @ManyToOne(() => PosSession, { nullable: true })
  @JoinColumn({ name: 'pos_session_id' })
  pos_session: PosSession | null;

  /** Total refund amount (positive number) */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  refund_amount: number;

  /** How the refund was given back */
  @Column({ type: 'enum', enum: ['cash', 'card_reversal', 'store_credit'] })
  refund_method: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @OneToMany(() => SaleReturnItem, (item) => item.sale_return, { cascade: true })
  items: SaleReturnItem[];

  @CreateDateColumn()
  created_at: Date;
}
