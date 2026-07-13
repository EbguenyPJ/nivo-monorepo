import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DeliveryProof, Order, TenantSetting, BranchSettingOverride } from '@nivo/database';

export type VerificationMethod = 'pin' | 'signature' | 'qr';

export const DELIVERY_VERIFICATION_SETTING_KEY = 'entrega.verification_methods';

@Injectable()
export class DeliveryService {

  /** Métodos de verificación requeridos según settings del tenant (con override por sucursal). */
  async getRequiredMethods(connection: DataSource, branchId?: string | null): Promise<VerificationMethod[]> {
    const setting = await connection.getRepository(TenantSetting).findOne({
      where: { key: DELIVERY_VERIFICATION_SETTING_KEY },
    });

    let value = setting?.value ?? '';

    if (branchId && setting) {
      const override = await connection.getRepository(BranchSettingOverride).findOne({
        where: { branch_id: branchId, key: DELIVERY_VERIFICATION_SETTING_KEY },
      });
      if (override) value = override.value;
    }

    return value
      .split(',')
      .map((m) => m.trim().toLowerCase())
      .filter((m): m is VerificationMethod => m === 'pin' || m === 'signature' || m === 'qr');
  }

  /**
   * Requisitos de confirmación para un pedido. Si el PIN es requerido y el
   * pedido aún no tiene uno, se genera aquí (el cliente lo ve en su app).
   */
  async getRequirements(connection: DataSource, orderId: string) {
    const orderRepo = connection.getRepository(Order);
    const order = await orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const required = await this.getRequiredMethods(connection, order.branch_id);

    if (required.includes('pin') && !order.delivery_pin) {
      order.delivery_pin = String(Math.floor(1000 + Math.random() * 9000));
      await orderRepo.update(orderId, { delivery_pin: order.delivery_pin });
    }

    return {
      order_id: orderId,
      required_methods: required,
      pin_generated: required.includes('pin') && !!order.delivery_pin,
    };
  }

  async submitProof(
    connection: DataSource,
    orderId: string,
    employeeId: string,
    data: {
      latitude: number;
      longitude: number;
      recipient_name?: string;
      notes?: string;
      photo_url?: string;
      pin_code?: string;
      signature_data?: string;
      qr_payload?: string;
    },
  ) {
    const order = await connection.getRepository(Order).findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status !== 'out_for_delivery') {
      throw new BadRequestException('El pedido no está en camino');
    }

    // ── Validación server-side de los métodos requeridos ──
    const required = await this.getRequiredMethods(connection, order.branch_id);

    let pinVerified = false;
    if (required.includes('pin')) {
      if (!data.pin_code) {
        throw new BadRequestException('Este pedido requiere confirmar el código de entrega');
      }
      if (!order.delivery_pin || data.pin_code.trim() !== order.delivery_pin) {
        throw new BadRequestException('Código de entrega incorrecto');
      }
      pinVerified = true;
    }

    if (required.includes('signature') && !data.signature_data?.trim()) {
      throw new BadRequestException('Este pedido requiere la firma del cliente');
    }

    let qrVerified = false;
    if (required.includes('qr')) {
      const payload = (data.qr_payload ?? '').trim();
      if (!payload) {
        throw new BadRequestException('Este pedido requiere escanear el QR del cliente');
      }
      const valid = payload === order.id || (order.customer_id != null && payload === order.customer_id);
      if (!valid) {
        throw new BadRequestException('El QR escaneado no corresponde a este pedido');
      }
      qrVerified = true;
    }

    const repo = connection.getRepository(DeliveryProof);
    const proof = repo.create({
      order_id: orderId,
      employee_id: employeeId,
      latitude: data.latitude,
      longitude: data.longitude,
      recipient_name: data.recipient_name ?? null,
      notes: data.notes ?? null,
      photo_url: data.photo_url ?? null,
      signature_data: data.signature_data ?? null,
      pin_verified: pinVerified,
      qr_verified: qrVerified,
      status: 'delivered',
      delivered_at: new Date(),
    });
    await repo.save(proof);

    await connection.getRepository(Order).update(orderId, {
      status: 'delivered',
      completed_at: new Date(),
    });

    return proof;
  }

  async getProof(connection: DataSource, orderId: string) {
    const proof = await connection.getRepository(DeliveryProof).findOne({
      where: { order_id: orderId },
      relations: ['employee'],
    });
    if (!proof) throw new NotFoundException('No se encontró prueba de entrega');
    return proof;
  }
}
