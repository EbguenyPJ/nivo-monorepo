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
import { InventoryAuditItem } from './inventory-audit-item.entity';

@Entity('inventory_audits')
export class InventoryAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Auto-increment folio displayed as AUD-0001 */
  @Column({ type: 'int', generated: 'increment' })
  folio_number: number;

  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  /** full = entire branch, partial = filtered subset (brand, category, location, etc.) */
  @Column({ type: 'enum', enum: ['full', 'partial'], default: 'full' })
  type: string;

  /** draft → counting → review → completed / cancelled */
  @Column({
    type: 'enum',
    enum: ['draft', 'counting', 'review', 'completed', 'cancelled'],
    default: 'draft',
  })
  status: string;

  /** Optional filter criteria for partial audits (e.g. { brand_id, category_id, location_id }) */
  @Column({ type: 'jsonb', nullable: true })
  filter_criteria: Record<string, string> | null;

  /** Whether the POS / transfers are blocked for this branch during counting */
  @Column({ type: 'boolean', default: false })
  branch_locked: boolean;

  @Column({ type: 'uuid' })
  created_by_id: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'created_by_id' })
  created_by: Employee;

  @Column({ type: 'uuid', nullable: true })
  closed_by_id: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'closed_by_id' })
  closed_by: Employee | null;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => InventoryAuditItem, (item) => item.audit, { cascade: true })
  items: InventoryAuditItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  get folio(): string {
    return `AUD-${String(this.folio_number).padStart(4, '0')}`;
  }
}
