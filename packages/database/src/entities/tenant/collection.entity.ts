import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('collections')
export class Collection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** Parent collection id (null = root level) — Adjacency List */
  @Column({ type: 'uuid', nullable: true })
  parent_id: string | null;

  @ManyToOne(() => Collection, (c) => c.children, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_id' })
  parent: Collection | null;

  @OneToMany(() => Collection, (c) => c.parent)
  children: Collection[];

  /** Optional hex color for POS buttons (e.g. "#3B82F6") */
  @Column({ type: 'varchar', length: 9, nullable: true })
  color: string | null;

  /** Cover image for POS navigation tiles */
  @Column({ type: 'varchar', nullable: true })
  image_url: string | null;

  /** Display order among siblings */
  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
