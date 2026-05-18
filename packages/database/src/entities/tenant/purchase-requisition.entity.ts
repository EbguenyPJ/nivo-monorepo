import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Branch } from './branch.entity';
import { Employee } from './employee.entity';
import { RequisitionItem } from './requisition-item.entity';

/**
 * Internal purchase requisition — one active draft per branch.
 * Answers: "What merchandise does this branch need to reach max stock?"
 *
 * State machine: draft → locked → approved → (generates POs)
 */
@Entity('purchase_requisitions')
export class PurchaseRequisition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Auto-increment folio displayed as REQ-0001 */
  @Column({ type: 'int', generated: 'increment' })
  folio_number: number;

  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({
    type: 'enum',
    enum: ['draft', 'locked', 'approved'],
    default: 'draft',
  })
  status: 'draft' | 'locked' | 'approved';

  /** Total estimated cost (sum of items qty * estimated_cost) */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_estimated_cost: number;

  /** Total items in the requisition */
  @Column({ type: 'int', default: 0 })
  total_items: number;

  /** Employee who locked the requisition for review */
  @Column({ type: 'uuid', nullable: true })
  locked_by_id: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'locked_by_id' })
  locked_by: Employee | null;

  @Column({ type: 'timestamp', nullable: true })
  locked_at: Date | null;

  /** Employee who approved and triggered PO generation */
  @Column({ type: 'uuid', nullable: true })
  approved_by_id: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approved_by: Employee | null;

  @Column({ type: 'timestamp', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'boolean', default: false })
  created_by_ai: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => RequisitionItem, (item) => item.requisition, { cascade: true })
  items: RequisitionItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  get folio(): string {
    return `REQ-${String(this.folio_number).padStart(4, '0')}`;
  }
}
