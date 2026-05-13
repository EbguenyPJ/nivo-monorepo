import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PreSale } from './pre-sale.entity';
import { ProductVariant } from './product-variant.entity';

@Entity('pre_sale_items')
export class PreSaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pre_sale_id: string;

  @ManyToOne(() => PreSale, (ps) => ps.items)
  @JoinColumn({ name: 'pre_sale_id' })
  pre_sale: PreSale;

  @Column({ type: 'uuid' })
  variant_id: string;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;
}
