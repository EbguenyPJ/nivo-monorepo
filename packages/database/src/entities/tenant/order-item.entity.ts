import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { ProductVariant } from './product-variant.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  order_id: string;

  @ManyToOne(() => Order, (o) => o.items)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'uuid' })
  variant_id: string;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'boolean', default: false })
  is_picked: boolean;

  @Column({ type: 'varchar', nullable: true })
  picked_barcode: string | null;
}
