import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SaleReturn } from './sale-return.entity';
import { SaleItem } from './sale-item.entity';
import { ProductVariant } from './product-variant.entity';

/**
 * Individual item within a return.
 * Each returned item has a disposition:
 * - 'floor': Goes back to sales floor (stock restored)
 * - 'shrinkage': Damaged/defective — sent to virtual shrinkage storage (not restocked)
 */
@Entity('sale_return_items')
export class SaleReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  sale_return_id: string;

  @ManyToOne(() => SaleReturn, (ret) => ret.items)
  @JoinColumn({ name: 'sale_return_id' })
  sale_return: SaleReturn;

  /** Reference to the original sale item being returned */
  @Column({ type: 'uuid' })
  sale_item_id: string;

  @ManyToOne(() => SaleItem)
  @JoinColumn({ name: 'sale_item_id' })
  sale_item: SaleItem;

  @Column({ type: 'uuid' })
  variant_id: string;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  /** How many units are being returned (can be less than original qty) */
  @Column({ type: 'int' })
  quantity: number;

  /** Unit price at time of original sale */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price: number;

  /** quantity * unit_price */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  /** Where does the returned product go? */
  @Column({ type: 'enum', enum: ['floor', 'shrinkage'] })
  disposition: string;
}
