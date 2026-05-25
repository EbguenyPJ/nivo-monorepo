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
      .where('o.fulfillment_type = :ft', { ft: 'delivery' })
      .andWhere('o.status IN (:...statuses)', { statuses: ['paid', 'picking', 'packed', 'out_for_delivery'] });

    if (branchId) {
      qb.andWhere('(o.branch_id = :bid OR o.pickup_branch_id = :bid)', { bid: branchId });
    }

    return qb.orderBy('o.order_number', 'DESC').getMany();
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

  async listOrders(connection: DataSource, filters: {
    status?: string;
    fulfillment_type?: string;
    branch_id?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;

    const qb = connection.getRepository(Order)
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .leftJoinAndSelect('o.items', 'items');

    if (filters.status) qb.andWhere('o.status = :status', { status: filters.status });
    if (filters.fulfillment_type) qb.andWhere('o.fulfillment_type = :ft', { ft: filters.fulfillment_type });
    if (filters.branch_id) qb.andWhere('(o.pickup_branch_id = :bid OR o.branch_id = :bid)', { bid: filters.branch_id });
    if (filters.start_date) qb.andWhere('o.created_at >= :start', { start: filters.start_date });
    if (filters.end_date) qb.andWhere('o.created_at <= :end', { end: filters.end_date });
    if (filters.search) {
      qb.andWhere('(CAST(o.order_number AS TEXT) LIKE :s OR customer.name ILIKE :q)', {
        s: `%${filters.search}%`,
        q: `%${filters.search}%`,
      });
    }

    const [items, total] = await qb
      .orderBy('o.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async updateOrderStatus(connection: DataSource, orderId: string, newStatus: string, employeeId?: string) {
    const order = await connection.getRepository(Order).findOne({
      where: { id: orderId },
      relations: ['customer', 'pickup_branch'],
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const transitions: Record<string, string[]> = {
      pending_payment: ['paid', 'cancelled'],
      paid: ['picking', 'cancelled'],
      picking: ['packed', 'ready_for_pickup'],
      packed: ['ready_for_pickup', 'out_for_delivery'],
      ready_for_pickup: ['picked_up', 'cancelled'],
      out_for_delivery: ['delivered'],
    };

    const allowed = transitions[order.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(`No se puede cambiar de '${order.status}' a '${newStatus}'`);
    }

    const updateData: any = { status: newStatus };
    if (newStatus === 'packed') updateData.packed_at = new Date();
    if (['delivered', 'picked_up'].includes(newStatus)) updateData.completed_at = new Date();
    if (employeeId) updateData.employee_id = employeeId;

    await connection.getRepository(Order).update(orderId, updateData);

    return { status: newStatus, order_id: orderId };
  }

  async cancelOrder(connection: DataSource, orderId: string) {
    const order = await connection.getRepository(Order).findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (['delivered', 'picked_up', 'cancelled'].includes(order.status)) {
      throw new BadRequestException('No se puede cancelar un pedido completado');
    }
    await connection.getRepository(Order).update(orderId, { status: 'cancelled' });
    return { status: 'cancelled' };
  }

  async getPickupOrders(connection: DataSource, branchId?: string) {
    const qb = connection.getRepository(Order)
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.variant', 'variant')
      .leftJoinAndSelect('variant.product', 'product')
      .where('o.fulfillment_type = :ft', { ft: 'bopis' })
      .andWhere('o.status IN (:...statuses)', { statuses: ['paid', 'picking', 'packed', 'ready_for_pickup'] });

    if (branchId) {
      qb.andWhere('o.pickup_branch_id = :bid', { bid: branchId });
    }

    return qb.orderBy('o.order_number', 'DESC').getMany();
  }

  async getPickupByQR(connection: DataSource, orderId: string) {
    const order = await connection.getRepository(Order).findOne({
      where: { id: orderId },
      relations: [
        'customer', 'pickup_branch',
        'items', 'items.variant', 'items.variant.product',
      ],
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    // Spread into plain object so extra fields survive serialization
    const plain = JSON.parse(JSON.stringify(order));
    plain.qr_valid = order.status === 'ready_for_pickup';
    plain.pickup_info = {
      location: order.pickup_location,
      status: order.status,
      can_pickup: order.status === 'ready_for_pickup',
    };
    return plain;
  }

  async confirmPickupWithSignature(
    connection: DataSource,
    orderId: string,
    signatureData: { signature_url: string; recipient_name: string },
    employeeId: string,
  ) {
    const order = await connection.getRepository(Order).findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status !== 'ready_for_pickup') {
      throw new BadRequestException('El pedido no está listo para recoger');
    }

    await connection.getRepository(Order).update(orderId, {
      status: 'picked_up',
      completed_at: new Date(),
      employee_id: employeeId,
      signature_url: signatureData.signature_url,
    });

    return this.findOne(connection, orderId);
  }
}
