import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('price_lists')
export class PriceList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** Global default margin percentage for this price list (e.g. 30 = 30%) */
  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  default_margin_percentage: number;

  /** Whether this is the default price list used in the POS and product listings */
  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
