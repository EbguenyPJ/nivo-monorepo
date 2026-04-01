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
import { StorageLocation } from './storage-location.entity';

@Entity('inventory_locations')
@Unique(['variant_id', 'branch_id', 'location_id'])
export class InventoryLocation {
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

  @Column({ type: 'uuid' })
  location_id: string;

  @ManyToOne(() => StorageLocation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: StorageLocation;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @UpdateDateColumn()
  updated_at: Date;
}
