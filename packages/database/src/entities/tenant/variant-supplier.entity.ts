import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ProductVariant } from './product-variant.entity';
import { Supplier } from './supplier.entity';

/**
 * Pivot table linking product variants to their suppliers.
 * A variant can have multiple suppliers; one is marked as default.
 */
@Entity('variant_suppliers')
@Unique(['variant_id', 'supplier_id'])
export class VariantSupplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  variant_id: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ type: 'uuid' })
  supplier_id: string;

  @ManyToOne(() => Supplier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  /** SKU used by the supplier for this variant */
  @Column({ type: 'varchar', length: 100, nullable: true })
  supplier_sku: string | null;

  /** Last known cost from this supplier */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  last_cost: number;

  /** True = default supplier for automatic requisitions */
  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
