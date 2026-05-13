import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * AES-256-GCM encryption service for securing integration credentials at rest.
 * Uses the INTEGRATION_ENCRYPTION_KEY env var (or JWT_SECRET as fallback)
 * to derive a 32-byte key via scrypt.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly AUTH_TAG_LENGTH = 16;
  private static readonly SALT = 'nivo-integrations-v1';

  constructor(private readonly config: ConfigService) {
    const secret = this.config.get<string>('INTEGRATION_ENCRYPTION_KEY')
      || this.config.get<string>('JWT_SECRET')
      || 'default-dev-key-change-in-prod';
    this.key = scryptSync(secret, EncryptionService.SALT, 32);
  }

  /**
   * Encrypt a plaintext JSON object into an opaque string:
   * base64( iv + authTag + ciphertext )
   */
  encrypt(data: Record<string, any>): string {
    const plaintext = JSON.stringify(data);
    const iv = randomBytes(EncryptionService.IV_LENGTH);
    const cipher = createCipheriv(EncryptionService.ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Pack: iv (16) + authTag (16) + ciphertext
    const packed = Buffer.concat([iv, authTag, encrypted]);
    return packed.toString('base64');
  }

  /**
   * Decrypt a previously encrypted string back to a JSON object.
   * Returns null if decryption fails (bad key, tampered data).
   */
  decrypt(encryptedBase64: string): Record<string, any> | null {
    try {
      const packed = Buffer.from(encryptedBase64, 'base64');
      const iv = packed.subarray(0, EncryptionService.IV_LENGTH);
      const authTag = packed.subarray(
        EncryptionService.IV_LENGTH,
        EncryptionService.IV_LENGTH + EncryptionService.AUTH_TAG_LENGTH,
      );
      const ciphertext = packed.subarray(
        EncryptionService.IV_LENGTH + EncryptionService.AUTH_TAG_LENGTH,
      );
      const decipher = createDecipheriv(EncryptionService.ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return JSON.parse(decrypted.toString('utf8'));
    } catch {
      return null;
    }
  }
}
