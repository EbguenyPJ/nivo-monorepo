import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('integrations')
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  type: string;

  @Column({ type: 'varchar', length: 100 })
  display_name: string;

  @Column({ type: 'boolean', default: false })
  is_enabled: boolean;

  @Column({ type: 'simple-json', nullable: true })
  config: Record<string, any>;

  @Column({ type: 'varchar', length: 50, default: 'disconnected' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  last_tested_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
