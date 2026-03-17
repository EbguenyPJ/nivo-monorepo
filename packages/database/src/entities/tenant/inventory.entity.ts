import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ProductVariant } from './product-variant.entity';
import { Branch } from './branch.entity';

@Entity('inventory')
@Unique(['variant_id', 'branch_id'])
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  variant_id: string;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ type: 'int', default: 0 })
  stock_available: number;

  @Column({ type: 'int', default: 5 })
  stock_minimum: number;

  @UpdateDateColumn()
  updated_at: Date;
}
