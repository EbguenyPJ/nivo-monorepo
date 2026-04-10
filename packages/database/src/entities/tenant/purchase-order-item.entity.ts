import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { ProductVariant } from './product-variant.entity';

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  purchase_order_id: string;

  @ManyToOne(() => PurchaseOrder, (po) => po.items)
  @JoinColumn({ name: 'purchase_order_id' })
  purchase_order: PurchaseOrder;

  @Column({ type: 'uuid' })
  variant_id: string;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ type: 'int' })
  ordered_quantity: number;

  @Column({ type: 'int', nullable: true })
  received_quantity: number | null;

  /** Cost per unit the supplier charged */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_cost: number;

  get subtotal(): number {
    return this.ordered_quantity * Number(this.unit_cost);
  }

  get difference(): number | null {
    if (this.received_quantity === null || this.received_quantity === undefined) return null;
    return this.received_quantity - this.ordered_quantity;
  }
}
