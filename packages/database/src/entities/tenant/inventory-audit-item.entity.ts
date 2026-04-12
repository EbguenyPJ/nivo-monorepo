import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InventoryAudit } from './inventory-audit.entity';
import { ProductVariant } from './product-variant.entity';
import { StorageLocation } from './storage-location.entity';

@Entity('inventory_audit_items')
export class InventoryAuditItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  audit_id: string;

  @ManyToOne(() => InventoryAudit, (a) => a.items)
  @JoinColumn({ name: 'audit_id' })
  audit: InventoryAudit;

  @Column({ type: 'uuid' })
  variant_id: string;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  /** Optional: specific storage location being counted */
  @Column({ type: 'uuid', nullable: true })
  location_id: string | null;

  @ManyToOne(() => StorageLocation, { nullable: true })
  @JoinColumn({ name: 'location_id' })
  location: StorageLocation | null;

  /** Snapshot of system stock at the moment counting started */
  @Column({ type: 'int' })
  expected_quantity: number;

  /** Physical count entered by employee (null = not yet counted) */
  @Column({ type: 'int', nullable: true })
  counted_quantity: number | null;

  /** counted - expected (auto-computed on save) */
  @Column({ type: 'int', nullable: true })
  difference: number | null;

  /**
   * pending = waiting to be counted
   * counted = employee submitted a count
   * recount = manager requested a recount (resets counted_quantity)
   * accepted = manager accepted the difference
   */
  @Column({
    type: 'enum',
    enum: ['pending', 'counted', 'recount', 'accepted'],
    default: 'pending',
  })
  item_status: string;

  /** Reason selected by manager when accepting a discrepancy */
  @Column({ type: 'varchar', length: 100, nullable: true })
  adjustment_reason: string | null;

  /** Cost per unit at time of audit (for financial impact) */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  unit_cost: number;
}
