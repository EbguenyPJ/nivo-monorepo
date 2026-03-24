import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @ManyToOne(() => Product, (product) => product.variants)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'varchar', length: 100, unique: true })
  sku: string;

  /**
   * Dynamic attributes as JSONB — e.g. { "Color": "Negro", "Talla MX": "26", "Material": "Piel" }
   * Replaces the old fixed `color` + `size_mex` columns.
   */
  @Column({ type: 'jsonb', default: {} })
  attributes: Record<string, string>;

  /** If null, product.base_price is used */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price_override: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cost: number;

  @Column({ type: 'varchar', nullable: true })
  barcode: string | null;

  /** Variant images (array of URLs stored as JSONB) */
  @Column({ type: 'jsonb', default: [] })
  images: string[];

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  // ─── Legacy compatibility getters (read-only) ───────────────────
  get color(): string {
    return this.attributes?.['Color'] || '';
  }

  get size_mex(): number {
    return parseFloat(this.attributes?.['Talla MX'] || '0');
  }

  get price(): number {
    return this.price_override ?? 0;
  }
}
