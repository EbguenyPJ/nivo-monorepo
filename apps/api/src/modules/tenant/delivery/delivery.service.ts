import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DeliveryProof, Order } from '@nivo/database';

@Injectable()
export class DeliveryService {

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
    },
  ) {
    const order = await connection.getRepository(Order).findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status !== 'out_for_delivery') {
      throw new BadRequestException('El pedido no está en camino');
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
