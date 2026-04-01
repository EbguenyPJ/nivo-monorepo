import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ProductVariant } from './product-variant.entity';
import { PriceList } from './price-list.entity';

@Entity('variant_price_margins')
@Unique(['variant_id', 'price_list_id'])
export class VariantPriceMargin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  variant_id: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ type: 'uuid' })
  price_list_id: string;

  @ManyToOne(() => PriceList, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'price_list_id' })
  priceList: PriceList;

  /** Custom margin percentage for this specific variant on this price list */
  @Column({ type: 'decimal', precision: 8, scale: 2 })
  custom_margin_percentage: number;
}
