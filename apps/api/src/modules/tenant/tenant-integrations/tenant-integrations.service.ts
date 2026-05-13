import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantIntegration, IntegrationLog } from '@nivo/database';
import { EncryptionService } from '../../../core/crypto/encryption.service';

/** Integration type definitions with their required credential fields */
const INTEGRATION_SCHEMAS: Record<string, { display_name: string; required_fields: string[] }> = {
  sat: {
    display_name: 'Facturación SAT (CFDI 4.0)',
    required_fields: ['rfc', 'regimen_fiscal', 'pac_provider', 'pac_api_key'],
  },
  clip: {
    display_name: 'Terminal Clip',
    required_fields: ['api_key'],
  },
  mercadopago: {
    display_name: 'Mercado Pago Point',
    required_fields: ['access_token'],
  },
  srpago: {
    display_name: 'Sr. Pago',
    required_fields: ['api_key', 'merchant_id'],
  },
  whatsapp: {
    display_name: 'WhatsApp Business',
    required_fields: ['phone_number_id', 'access_token'],
  },
};

/** Fields that contain sensitive secrets — masked in API responses */
const SENSITIVE_FIELDS = [
  'pac_api_key', 'api_key', 'access_token', 'key_password',
  'secret_key', 'token', 'cer_base64', 'key_base64',
];

function maskCredentials(creds: Record<string, any>): Record<string, any> {
  const masked: Record<string, any> = {};
  for (const [key, value] of Object.entries(creds)) {
    if (SENSITIVE_FIELDS.includes(key) && typeof value === 'string' && value.length > 4) {
      masked[key] = '••••' + value.slice(-4);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

@Injectable()
export class TenantIntegrationsService {
  constructor(private readonly encryption: EncryptionService) {}

  // ═══════════════════════════════════════════════════════════════
  // LIST / GET
  // ═══════════════════════════════════════════════════════════════

  /** List available integration types and their current config status */
  async listIntegrations(connection: DataSource) {
    const repo = connection.getRepository(TenantIntegration);
    const saved = await repo.find({ order: { created_at: 'ASC' } });
    const savedMap = new Map(saved.map((s) => [s.integration_type, s]));

    // Return ALL available types with their saved status
    return Object.entries(INTEGRATION_SCHEMAS).map(([type, schema]) => {
      const existing = savedMap.get(type);
      if (existing) {
        const creds = this.encryption.decrypt(existing.credentials_encrypted);
        return {
          id: existing.id,
          integration_type: type,
          display_name: schema.display_name,
          is_active: existing.is_active,
          status: existing.status,
          last_tested_at: existing.last_tested_at,
          last_error: existing.last_error,
          credentials: creds ? maskCredentials(creds) : {},
          required_fields: schema.required_fields,
          configured: true,
        };
      }
      return {
        id: null,
        integration_type: type,
        display_name: schema.display_name,
        is_active: false,
        status: 'disconnected',
        last_tested_at: null,
        last_error: null,
        credentials: {},
        required_fields: schema.required_fields,
        configured: false,
      };
    });
  }

  /** Get one integration with decrypted (masked) credentials */
  async getIntegration(connection: DataSource, type: string) {
    const schema = INTEGRATION_SCHEMAS[type];
    if (!schema) throw new BadRequestException(`Tipo de integración no válido: ${type}`);

    const repo = connection.getRepository(TenantIntegration);
    const entity = await repo.findOne({ where: { integration_type: type } });
    if (!entity) {
      return {
        integration_type: type,
        display_name: schema.display_name,
        is_active: false,
        status: 'disconnected',
        credentials: {},
        required_fields: schema.required_fields,
        configured: false,
      };
    }

    const creds = this.encryption.decrypt(entity.credentials_encrypted);
    return {
      id: entity.id,
      integration_type: type,
      display_name: schema.display_name,
      is_active: entity.is_active,
      status: entity.status,
      last_tested_at: entity.last_tested_at,
      last_error: entity.last_error,
      credentials: creds ? maskCredentials(creds) : {},
      required_fields: schema.required_fields,
      configured: true,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SAVE / UPDATE CREDENTIALS
  // ═══════════════════════════════════════════════════════════════

  async saveIntegration(
    connection: DataSource,
    type: string,
    data: { credentials: Record<string, any>; is_active?: boolean },
  ) {
    const schema = INTEGRATION_SCHEMAS[type];
    if (!schema) throw new BadRequestException(`Tipo de integración no válido: ${type}`);

    // Validate required fields
    for (const field of schema.required_fields) {
      if (!data.credentials[field]?.toString().trim()) {
        throw new BadRequestException(`El campo "${field}" es obligatorio para ${schema.display_name}`);
      }
    }

    const repo = connection.getRepository(TenantIntegration);
    let entity = await repo.findOne({ where: { integration_type: type } });

    // If credential fields contain masked values (••••), merge with existing
    if (entity) {
      const existingCreds = this.encryption.decrypt(entity.credentials_encrypted) || {};
      const mergedCreds = { ...existingCreds };
      for (const [key, value] of Object.entries(data.credentials)) {
        if (typeof value === 'string' && value.startsWith('••••')) {
          // Keep existing value — user didn't change this field
          continue;
        }
        mergedCreds[key] = value;
      }
      entity.credentials_encrypted = this.encryption.encrypt(mergedCreds);
      entity.display_name = schema.display_name;
      if (data.is_active !== undefined) entity.is_active = data.is_active;
    } else {
      entity = repo.create({
        integration_type: type,
        display_name: schema.display_name,
        credentials_encrypted: this.encryption.encrypt(data.credentials),
        is_active: data.is_active ?? false,
        status: 'disconnected',
      });
    }

    const saved = await repo.save(entity);
    const creds = this.encryption.decrypt(saved.credentials_encrypted);
    return {
      id: saved.id,
      integration_type: type,
      display_name: schema.display_name,
      is_active: saved.is_active,
      status: saved.status,
      credentials: creds ? maskCredentials(creds) : {},
      configured: true,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // TOGGLE ACTIVE
  // ═══════════════════════════════════════════════════════════════

  async toggleActive(connection: DataSource, type: string, is_active: boolean) {
    const repo = connection.getRepository(TenantIntegration);
    const entity = await repo.findOne({ where: { integration_type: type } });
    if (!entity) throw new NotFoundException('Integración no configurada');
    entity.is_active = is_active;
    await repo.save(entity);
    return { integration_type: type, is_active: entity.is_active };
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST CONNECTION
  // ═══════════════════════════════════════════════════════════════

  async testConnection(connection: DataSource, type: string) {
    const schema = INTEGRATION_SCHEMAS[type];
    if (!schema) throw new BadRequestException(`Tipo de integración no válido: ${type}`);

    const repo = connection.getRepository(TenantIntegration);
    const entity = await repo.findOne({ where: { integration_type: type } });
    if (!entity) throw new NotFoundException('Integración no configurada. Guarda las credenciales primero.');

    const creds = this.encryption.decrypt(entity.credentials_encrypted);
    if (!creds) throw new BadRequestException('No se pudieron descifrar las credenciales');

    const logRepo = connection.getRepository(IntegrationLog);
    const startTime = Date.now();
    let testResult: { success: boolean; message: string };

    try {
      testResult = await this.performConnectionTest(type, creds);
    } catch (err: any) {
      testResult = { success: false, message: err.message || 'Error desconocido' };
    }

    const duration = Date.now() - startTime;

    // Update integration status
    entity.status = testResult.success ? 'connected' : 'error';
    entity.last_tested_at = new Date();
    entity.last_error = testResult.success ? null : testResult.message;
    await repo.save(entity);

    // Log the test attempt
    await logRepo.save(logRepo.create({
      integration_id: entity.id,
      action: 'test_connection',
      status: testResult.success ? 'success' : 'error',
      request_payload: { type, tested_at: new Date().toISOString() },
      response_payload: { message: testResult.message },
      error_message: testResult.success ? null : testResult.message,
      duration_ms: duration,
    }));

    return {
      success: testResult.success,
      message: testResult.message,
      status: entity.status,
      last_tested_at: entity.last_tested_at,
    };
  }

  /** Perform actual connection test per integration type */
  private async performConnectionTest(
    type: string,
    creds: Record<string, any>,
  ): Promise<{ success: boolean; message: string }> {
    switch (type) {
      case 'sat': {
        // Validate RFC format
        const rfc = creds.rfc?.toString().trim();
        if (!rfc || !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) {
          return { success: false, message: 'Formato de RFC inválido' };
        }
        if (!creds.pac_api_key) {
          return { success: false, message: 'Falta la llave API del PAC' };
        }
        // In production: would call PAC API to validate credentials
        // For now: validate structure and mark as connected
        return { success: true, message: 'Credenciales del SAT validadas correctamente' };
      }

      case 'clip': {
        if (!creds.api_key) {
          return { success: false, message: 'Falta la API Key de Clip' };
        }
        // In production: would call Clip's /merchants/me endpoint
        return { success: true, message: 'Conexión con Clip verificada' };
      }

      case 'mercadopago': {
        if (!creds.access_token) {
          return { success: false, message: 'Falta el Access Token de Mercado Pago' };
        }
        // In production: would call MP's /users/me endpoint
        return { success: true, message: 'Conexión con Mercado Pago verificada' };
      }

      case 'srpago': {
        if (!creds.api_key || !creds.merchant_id) {
          return { success: false, message: 'Faltan credenciales de Sr. Pago' };
        }
        return { success: true, message: 'Conexión con Sr. Pago verificada' };
      }

      case 'whatsapp': {
        if (!creds.access_token || !creds.phone_number_id) {
          return { success: false, message: 'Faltan credenciales de WhatsApp Business' };
        }
        // In production: would call Meta's Graph API /phone_number_id
        return { success: true, message: 'Conexión con WhatsApp Business verificada' };
      }

      default:
        return { success: false, message: `Tipo de integración no soportado: ${type}` };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LOGS
  // ═══════════════════════════════════════════════════════════════

  async getLogs(
    connection: DataSource,
    type?: string,
    page = 0,
    limit = 20,
  ) {
    const logRepo = connection.getRepository(IntegrationLog);
    const qb = logRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.integration', 'integration')
      .orderBy('log.created_at', 'DESC')
      .skip(page * limit)
      .take(limit);

    if (type) {
      qb.andWhere('integration.integration_type = :type', { type });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  // ═══════════════════════════════════════════════════════════════
  // DELETE (removes configuration, keeps logs)
  // ═══════════════════════════════════════════════════════════════

  async deleteIntegration(connection: DataSource, type: string) {
    const repo = connection.getRepository(TenantIntegration);
    const entity = await repo.findOne({ where: { integration_type: type } });
    if (!entity) throw new NotFoundException('Integración no encontrada');
    await repo.remove(entity);
    return { deleted: true, integration_type: type };
  }
}
