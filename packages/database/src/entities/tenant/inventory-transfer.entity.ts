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
import { InventoryTransferItem } from './inventory-transfer-item.entity';

/**
 * A transfer shipment between two branches.
 * Lifecycle: draft → in_transit → completed | discrepancy
 *
 * While in_transit, items are deducted from origin but NOT added to destination.
 * Only upon reception (completed/discrepancy) does destination stock increase.
 */
@Entity('inventory_transfers')
export class InventoryTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Auto-incrementing human-readable folio (e.g. TR-0012) */
  @Column({ type: 'int', generated: 'increment' })
  folio_number: number;

  @Column({ type: 'uuid' })
  origin_branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'origin_branch_id' })
  origin_branch: Branch;

  @Column({ type: 'uuid' })
  destination_branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'destination_branch_id' })
  destination_branch: Branch;

  @Column({
    type: 'enum',
    enum: ['draft', 'in_transit', 'completed', 'discrepancy', 'cancelled'],
    default: 'draft',
  })
  status: string;

  /** Employee who created/dispatched the transfer */
  @Column({ type: 'uuid' })
  created_by_id: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'created_by_id' })
  created_by: Employee;

  /** Employee who received the transfer at destination */
  @Column({ type: 'uuid', nullable: true })
  received_by_id: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'received_by_id' })
  received_by: Employee | null;

  /** When the transfer was dispatched (status → in_transit) */
  @Column({ type: 'timestamp', nullable: true })
  shipped_at: Date | null;

  /** When the transfer was received (status → completed/discrepancy) */
  @Column({ type: 'timestamp', nullable: true })
  received_at: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Summary of discrepancies, auto-generated on reception */
  @Column({ type: 'text', nullable: true })
  discrepancy_notes: string | null;

  @OneToMany(() => InventoryTransferItem, (item) => item.transfer, { cascade: true })
  items: InventoryTransferItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  /** Human-readable folio */
  get folio(): string {
    return `TR-${String(this.folio_number).padStart(4, '0')}`;
  }
}
