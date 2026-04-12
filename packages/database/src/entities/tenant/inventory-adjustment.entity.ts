import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InventoryAudit } from './inventory-audit.entity';
import { ProductVariant } from './product-variant.entity';
import { Branch } from './branch.entity';
import { Employee } from './employee.entity';

@Entity('inventory_adjustments')
export class InventoryAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  audit_id: string | null;

  @ManyToOne(() => InventoryAudit, { nullable: true })
  @JoinColumn({ name: 'audit_id' })
  audit: InventoryAudit | null;

  @Column({ type: 'uuid' })
  variant_id: string;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  /** shrinkage (loss), surplus, damage, transfer_error, other */
  @Column({ type: 'varchar', length: 50 })
  reason: string;

  /** Positive = surplus, Negative = shrinkage */
  @Column({ type: 'int' })
  quantity: number;

  /** unit_cost × quantity — financial impact */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  financial_impact: number;

  @Column({ type: 'uuid' })
  approved_by_id: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'approved_by_id' })
  approved_by: Employee;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}
