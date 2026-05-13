import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Stores a tenant's integration configurations with external services.
 * Credentials are stored encrypted at the application layer (AES-256-GCM).
 *
 * integration_type values: 'sat', 'clip', 'mercadopago', 'srpago', 'whatsapp'
 */
@Entity('tenant_integrations')
export class TenantIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Integration identifier: sat | clip | mercadopago | srpago | whatsapp
   * Each type can only appear ONCE per tenant.
   */
  @Column({ type: 'varchar', length: 50, unique: true })
  integration_type: string;

  /** Human-readable display name (e.g. "Facturación SAT", "Terminal Clip") */
  @Column({ type: 'varchar', length: 100 })
  display_name: string;

  /**
   * Encrypted JSON blob containing credentials specific to each integration type.
   * - SAT: { rfc, regimen_fiscal, pac_provider, pac_api_key, cer_base64, key_base64, key_password }
   * - Clip: { merchant_id, api_key, terminal_id }
   * - WhatsApp: { phone_number_id, access_token, waba_id }
   * Encrypted with AES-256-GCM before persistence, decrypted on read.
   */
  @Column({ type: 'text' })
  credentials_encrypted: string;

  /** Whether this integration is currently active / should be used in flows */
  @Column({ type: 'boolean', default: false })
  is_active: boolean;

  /** Connection status: connected | disconnected | error */
  @Column({ type: 'varchar', length: 30, default: 'disconnected' })
  status: string;

  /** Last time a test-connection was performed */
  @Column({ type: 'timestamptz', nullable: true })
  last_tested_at: Date | null;

  /** Error message from last test or operation failure */
  @Column({ type: 'text', nullable: true })
  last_error: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
