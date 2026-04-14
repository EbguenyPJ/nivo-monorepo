import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Layaway } from './layaway.entity';
import { ProductVariant } from './product-variant.entity';

@Entity('layaway_items')
export class LayawayItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  layaway_id: string;

  @ManyToOne(() => Layaway, (l) => l.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'layaway_id' })
  layaway: Layaway;

  @Column({ type: 'uuid' })
  variant_id: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;
}
