import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrderTracking, Order } from '@nivo/database';

@Injectable()
export class LogisticsService {

  async saveLocation(connection: DataSource, orderId: string, lat: number, lng: number) {
    const repo = connection.getRepository(OrderTracking);
    const point = repo.create({
      order_id: orderId,
      latitude: lat,
      longitude: lng,
    });
    return repo.save(point);
  }

  async getTrackingHistory(connection: DataSource, orderId: string) {
    const order = await connection.getRepository(Order).findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    return connection.getRepository(OrderTracking).find({
      where: { order_id: orderId },
      order: { timestamp: 'ASC' },
    });
  }

  async getLatestLocation(connection: DataSource, orderId: string) {
    const point = await connection.getRepository(OrderTracking).findOne({
      where: { order_id: orderId },
      order: { timestamp: 'DESC' },
    });
    if (!point) return null;
    return {
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      timestamp: point.timestamp,
    };
  }
}
