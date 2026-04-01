import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { SizeGroup } from './size-group.entity';
import { SizeEquivalency } from './size-equivalency.entity';

@Entity('sizes')
export class Size {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  size_group_id: string;

  @ManyToOne(() => SizeGroup, (g) => g.sizes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'size_group_id' })
  sizeGroup: SizeGroup;

  /** Orden de la fila para Drag & Drop (menor a mayor en el POS) */
  @Column({ type: 'int', default: 0 })
  order_index: number;

  @OneToMany(() => SizeEquivalency, (eq) => eq.size, { cascade: true })
  equivalencies: SizeEquivalency[];

  @CreateDateColumn()
  created_at: Date;
}
