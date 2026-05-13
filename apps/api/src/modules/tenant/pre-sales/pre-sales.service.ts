import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PreSale, PreSaleItem, ProductVariant } from '@nivo/database';
import { v4 as uuid } from 'uuid';

@Injectable()
export class PreSalesService {

  async create(
    connection: DataSource,
    data: {
      branch_id: string;
      employee_id: string;
      customer_id?: string;
      items: { variant_id: string; quantity: number }[];
    },
  ) {
    if (!data.items?.length) throw new BadRequestException('La pre-venta debe tener artículos');

    const variantRepo = connection.getRepository(ProductVariant);
    let totalAmount = 0;
    const preSaleItems: Partial<PreSaleItem>[] = [];

    for (const item of data.items) {
      const variant = await variantRepo.findOne({
        where: { id: item.variant_id },
        relations: ['product'],
      });
      if (!variant) throw new NotFoundException(`Variante ${item.variant_id} no encontrada`);

      const unitPrice = Number(variant.price_override ?? variant.product.base_price);
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      preSaleItems.push({
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal,
      });
    }

    const qrCode = `nivo:presale:${uuid()}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    const repo = connection.getRepository(PreSale);
    const preSale = repo.create({
      branch_id: data.branch_id,
      employee_id: data.employee_id,
      customer_id: data.customer_id ?? null,
      total_amount: totalAmount,
      qr_code: qrCode,
      expires_at: expiresAt,
      items: preSaleItems as PreSaleItem[],
    });

    const saved = await repo.save(preSale);
    return this.findOne(connection, saved.id);
  }

  async findOne(connection: DataSource, id: string) {
    const preSale = await connection.getRepository(PreSale).findOne({
      where: { id },
      relations: ['items', 'items.variant', 'items.variant.product', 'employee', 'customer'],
    });
    if (!preSale) throw new NotFoundException('Pre-venta no encontrada');
    return preSale;
  }

  async findByQr(connection: DataSource, qrCode: string) {
    const preSale = await connection.getRepository(PreSale).findOne({
      where: { qr_code: qrCode },
      relations: ['items', 'items.variant', 'items.variant.product', 'employee', 'customer'],
    });
    if (!preSale) throw new NotFoundException('Pre-venta no encontrada');

    if (preSale.status === 'converted') throw new BadRequestException('Esta pre-venta ya fue convertida');
    if (preSale.status === 'expired' || new Date() > preSale.expires_at) {
      if (preSale.status !== 'expired') {
        await connection.getRepository(PreSale).update(preSale.id, { status: 'expired' });
      }
      throw new BadRequestException('Esta pre-venta ha expirado');
    }

    return preSale;
  }

  async markConverted(connection: DataSource, id: string) {
    await connection.getRepository(PreSale).update(id, { status: 'converted' });
  }
}
