import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Size } from './size.entity';
import { SizeSystem } from './size-system.entity';

@Entity('size_equivalencies')
@Unique(['size_id', 'size_system_id'])
export class SizeEquivalency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  size_id: string;

  @ManyToOne(() => Size, (s) => s.equivalencies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'size_id' })
  size: Size;

  @Column({ type: 'uuid' })
  size_system_id: string;

  @ManyToOne(() => SizeSystem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'size_system_id' })
  sizeSystem: SizeSystem;

  /** Ej. "26.5", "8.5", "42" */
  @Column({ type: 'varchar', length: 20 })
  value: string;
}
