import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Size } from './size.entity';

@Entity('size_groups')
export class SizeGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Ej. "Hombre", "Mujer", "Niño", "Bebé", "Unisex" */
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(() => Size, (s) => s.sizeGroup)
  sizes: Size[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
