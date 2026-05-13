import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PurchaseRequisition } from './purchase-requisition.entity';
import { ProductVariant } from './product-variant.entity';
import { Supplier } from './supplier.entity';

/**
 * Line item within a purchase requisition.
 * Tracks what variant is needed, how many, and which supplier will fulfill it.
 */
@Entity('requisition_items')
export class RequisitionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  requisition_id: string;

  @ManyToOne(() => PurchaseRequisition, (r) => r.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requisition_id' })
  requisition: PurchaseRequisition;

  @Column({ type: 'uuid' })
  variant_id: string;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  /** System-calculated quantity: max_stock - current_stock */
  @Column({ type: 'int' })
  suggested_quantity: number;

  /** Manager-overridden quantity (null = use suggested) */
  @Column({ type: 'int', nullable: true })
  override_quantity: number | null;

  /** Current stock at the time this item was added/updated */
  @Column({ type: 'int', default: 0 })
  current_stock: number;

  /** Max stock target for this variant at this branch */
  @Column({ type: 'int', default: 0 })
  max_stock: number;

  /** Estimated unit cost (from variant.cost or supplier last_cost) */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  estimated_cost: number;

  /** Default supplier for this variant (resolved at add time) */
  @Column({ type: 'uuid', nullable: true })
  supplier_id: string | null;

  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null;

  /** Supplier SKU for the PO */
  @Column({ type: 'varchar', length: 100, nullable: true })
  supplier_sku: string | null;

  /** Final quantity to order (suggested or override) */
  get quantity(): number {
    return this.override_quantity ?? this.suggested_quantity;
  }

  get subtotal(): number {
    return this.quantity * Number(this.estimated_cost);
  }
}
