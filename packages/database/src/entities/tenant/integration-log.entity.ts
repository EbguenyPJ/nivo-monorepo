import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TenantIntegration } from './tenant-integration.entity';

/**
 * Audit log for every interaction with external services.
 * Captures requests, responses, errors and durations.
 */
@Entity('integration_logs')
export class IntegrationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  integration_id: string;

  @ManyToOne(() => TenantIntegration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'integration_id' })
  integration: TenantIntegration;

  /** Action performed: test_connection | emit_cfdi | send_whatsapp | charge_terminal | webhook_received */
  @Column({ type: 'varchar', length: 50 })
  action: string;

  /** success | error */
  @Column({ type: 'varchar', length: 20 })
  status: string;

  /** Request payload sent to external service (sanitized — NO secrets) */
  @Column({ type: 'jsonb', nullable: true })
  request_payload: Record<string, any> | null;

  /** Response received from external service (truncated if large) */
  @Column({ type: 'jsonb', nullable: true })
  response_payload: Record<string, any> | null;

  /** Error message if status = error */
  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  /** Duration of the external call in milliseconds */
  @Column({ type: 'int', nullable: true })
  duration_ms: number | null;

  /** Optional: which employee triggered this (nullable for webhook-triggered actions) */
  @Column({ type: 'uuid', nullable: true })
  triggered_by: string | null;

  @CreateDateColumn()
  created_at: Date;
}
