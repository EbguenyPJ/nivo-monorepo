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
import { Supplier } from './supplier.entity';
import { Branch } from './branch.entity';
import { Employee } from './employee.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { PurchaseRequisition } from './purchase-requisition.entity';

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Auto-increment folio displayed as OC-0001 */
  @Column({ type: 'int', generated: 'increment' })
  folio_number: number;

  @Column({ type: 'uuid' })
  supplier_id: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  /** Branch that will receive the merchandise */
  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({
    type: 'enum',
    enum: ['draft', 'ordered', 'partial', 'received', 'cancelled'],
    default: 'draft',
  })
  status: string;

  /** Sum of (unit_cost × ordered_quantity) for all items */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_cost: number;

  /** Supplier invoice reference */
  @Column({ type: 'varchar', length: 100, nullable: true })
  invoice_number: string | null;

  @Column({ type: 'uuid' })
  created_by_id: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'created_by_id' })
  created_by: Employee;

  @Column({ type: 'uuid', nullable: true })
  received_by_id: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'received_by_id' })
  received_by: Employee | null;

  /** Expected delivery date */
  @Column({ type: 'date', nullable: true })
  expected_date: string | null;

  @Column({ type: 'timestamp', nullable: true })
  received_at: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', nullable: true })
  discrepancy_notes: string | null;

  /** If this PO was auto-generated from a requisition */
  @Column({ type: 'uuid', nullable: true })
  requisition_id: string | null;

  @ManyToOne(() => PurchaseRequisition, { nullable: true })
  @JoinColumn({ name: 'requisition_id' })
  requisition: PurchaseRequisition | null;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchase_order, { cascade: true })
  items: PurchaseOrderItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  get folio(): string {
    return `OC-${String(this.folio_number).padStart(4, '0')}`;
  }
}
