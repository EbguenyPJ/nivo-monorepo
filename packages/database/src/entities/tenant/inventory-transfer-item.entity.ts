import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InventoryTransfer } from './inventory-transfer.entity';
import { ProductVariant } from './product-variant.entity';

/**
 * Individual line item in an inventory transfer.
 * sent_quantity is set when dispatched; received_quantity is filled during reception.
 */
@Entity('inventory_transfer_items')
export class InventoryTransferItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  transfer_id: string;

  @ManyToOne(() => InventoryTransfer, (t) => t.items)
  @JoinColumn({ name: 'transfer_id' })
  transfer: InventoryTransfer;

  @Column({ type: 'uuid' })
  variant_id: string;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  /** Quantity the origin branch says it shipped */
  @Column({ type: 'int' })
  sent_quantity: number;

  /** Quantity the destination branch physically counted (null until reception) */
  @Column({ type: 'int', nullable: true })
  received_quantity: number | null;

  /** Difference: received - sent (negative = shortage, positive = surplus) */
  get difference(): number | null {
    if (this.received_quantity === null || this.received_quantity === undefined) return null;
    return this.received_quantity - this.sent_quantity;
  }
}
