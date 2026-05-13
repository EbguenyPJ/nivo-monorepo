import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  Order, OrderItem, Inventory, ProductVariant,
  Customer, Branch,
} from '@nivo/database';

@Injectable()
export class OrdersService {

  async createOrder(
    connection: DataSource,
    customerId: string,
    data: {
      fulfillment_type: string;
      pickup_branch_id?: string;
      shipping_address?: Record<string, string>;
      stripe_payment_intent_id?: string;
      items: { variant_id: string; quantity: number }[];
      notes?: string;
    },
  ) {
    if (!data.items?.length) throw new BadRequestException('El pedido debe tener al menos un artículo');

    if (data.fulfillment_type === 'bopis' && !data.pickup_branch_id) {
      throw new BadRequestException('Se requiere sucursal de recolección para BOPIS');
    }

    const variantRepo = connection.getRepository(ProductVariant);
    const inventoryRepo = connection.getRepository(Inventory);

    let totalAmount = 0;
    const orderItems: Partial<OrderItem>[] = [];

    for (const item of data.items) {
      const variant = await variantRepo.findOne({
        where: { id: item.variant_id },
        relations: ['product'],
      });
      if (!variant) throw new NotFoundException(`Variante ${item.variant_id} no encontrada`);

      const unitPrice = Number(variant.price_override ?? variant.product.base_price);
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      orderItems.push({
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        discount: 0,
        subtotal,
      });

      if (data.pickup_branch_id) {
        const inv = await inventoryRepo.findOne({
          where: { variant_id: item.variant_id, branch_id: data.pickup_branch_id },
        });
        if (!inv || Number(inv.stock_available) < item.quantity) {
          throw new BadRequestException(`Stock insuficiente para variante ${variant.sku || item.variant_id}`);
        }
      }
    }

    const orderRepo = connection.getRepository(Order);
    const order = orderRepo.create({
      customer_id: customerId,
      fulfillment_type: data.fulfillment_type,
      pickup_branch_id: data.pickup_branch_id ?? null,
      shipping_address: data.shipping_address ?? null,
      stripe_payment_intent_id: data.stripe_payment_intent_id ?? null,
      status: data.stripe_payment_intent_id ? 'paid' : 'pending_payment',
      total_amount: totalAmount,
      paid_at: data.stripe_payment_intent_id ? new Date() : null,
      notes: data.notes ?? null,
      items: orderItems as OrderItem[],
    });

    const saved = await orderRepo.save(order);

    if (data.stripe_payment_intent_id && data.pickup_branch_id) {
      for (const item of data.items) {
        await inventoryRepo.decrement(
          { variant_id: item.variant_id, branch_id: data.pickup_branch_id },
          'stock_available',
          item.quantity,
        );
      }
    }

    return this.findOne(connection, saved.id);
  }

  async findByCustomer(connection: DataSource, customerId: string) {
    return connection.getRepository(Order).find({
      where: { customer_id: customerId },
      relations: ['pickup_branch', 'items', 'items.variant', 'items.variant.product'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(connection: DataSource, id: string) {
    const order = await connection.getRepository(Order).findOne({
      where: { id },
      relations: [
        'customer', 'pickup_branch', 'branch',
        'items', 'items.variant', 'items.variant.product',
      ],
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }

  async getPendingOrders(connection: DataSource, branchId?: string) {
    const qb = connection.getRepository(Order)
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.variant', 'variant')
      .leftJoinAndSelect('variant.product', 'product')
      .where('o.status IN (:...statuses)', { statuses: ['paid', 'picking'] });

    if (branchId) {
      qb.andWhere('(o.pickup_branch_id = :bid OR o.branch_id = :bid)', { bid: branchId });
    }

    return qb.orderBy('o.created_at', 'ASC').getMany();
  }

  async getOrderForPicking(connection: DataSource, orderId: string) {
    const order = await connection.getRepository(Order).findOne({
      where: { id: orderId },
      relations: ['customer', 'items', 'items.variant', 'items.variant.product'],
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    if (order.status === 'paid') {
      await connection.getRepository(Order).update(order.id, { status: 'picking' });
      order.status = 'picking';
    }

    return order;
  }

  async verifyPick(
    connection: DataSource,
    orderId: string,
    data: { barcode: string },
  ) {
    const order = await connection.getRepository(Order).findOne({
      where: { id: orderId },
      relations: ['items', 'items.variant'],
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const item = order.items.find(
      (i) => !i.is_picked && (i.variant?.barcode === data.barcode || i.variant?.sku === data.barcode),
    );

    if (!item) {
      return { match: false, message: 'Código no corresponde a ningún artículo pendiente' };
    }

    await connection.getRepository(OrderItem).update(item.id, {
      is_picked: true,
      picked_barcode: data.barcode,
    });

    const allPicked = order.items.every((i) => i.id === item.id || i.is_picked);
    return { match: true, item_id: item.id, all_picked: allPicked };
  }

  async markPacked(connection: DataSource, orderId: string, employeeId: string) {
    const order = await connection.getRepository(Order).findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const unpicked = order.items.filter((i) => !i.is_picked);
    if (unpicked.length > 0) {
      throw new BadRequestException(`Faltan ${unpicked.length} artículos por surtir`);
    }

    const nextStatus = order.fulfillment_type === 'bopis' ? 'ready_for_pickup' : 'packed';

    await connection.getRepository(Order).update(orderId, {
      status: nextStatus,
      packed_at: new Date(),
      employee_id: employeeId,
    });

    return { status: nextStatus };
  }

  async getDeliveryOrders(connection: DataSource, branchId?: string) {
    const qb = connection.getRepository(Order)
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .leftJoinAndSelect('o.pickup_branch', 'pickup_branch')
      .where('o.status = :status', { status: 'out_for_delivery' });

    if (branchId) {
      qb.andWhere('(o.branch_id = :bid OR o.pickup_branch_id = :bid)', { bid: branchId });
    }

    return qb.orderBy('o.created_at', 'ASC').getMany();
  }

  async markOutForDelivery(connection: DataSource, orderId: string) {
    const order = await connection.getRepository(Order).findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status !== 'packed') throw new BadRequestException('El pedido debe estar empacado');

    await connection.getRepository(Order).update(orderId, { status: 'out_for_delivery' });
    return { status: 'out_for_delivery' };
  }

  async markDelivered(connection: DataSource, orderId: string) {
    await connection.getRepository(Order).update(orderId, {
      status: 'delivered',
      completed_at: new Date(),
    });
  }

  async markPickedUp(connection: DataSource, orderId: string) {
    const order = await connection.getRepository(Order).findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status !== 'ready_for_pickup') throw new BadRequestException('El pedido no está listo para recoger');

    await connection.getRepository(Order).update(orderId, {
      status: 'picked_up',
      completed_at: new Date(),
    });
    return { status: 'picked_up' };
  }
}
