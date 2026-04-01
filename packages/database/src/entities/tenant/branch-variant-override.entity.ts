import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ProductVariant } from './product-variant.entity';
import { Branch } from './branch.entity';

@Entity('branch_variant_overrides')
@Unique(['variant_id', 'branch_id'])
export class BranchVariantOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  variant_id: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  /** Override purchase price if this branch bought it at a different cost */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  purchase_price_override: number;
}
