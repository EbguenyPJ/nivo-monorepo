import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LoyaltyConfig, LoyaltyLedger, Customer } from '@nivo/database';

@Injectable()
export class LoyaltyService {
  // ═══════════════════════════════════════════════════════════════════
  //  CONFIG — Global loyalty program settings
  // ═══════════════════════════════════════════════════════════════════

  async getConfig(connection: DataSource): Promise<LoyaltyConfig> {
    const repo = connection.getRepository(LoyaltyConfig);
    let config = await repo.findOne({ where: {} });
    if (!config) {
      // Auto-create default config
      config = repo.create({
        is_active: false,
        spend_per_point: 100,
        point_value: 1,
        min_redemption_points: 1,
        expiration_days: 0,
        earn_on_layaway: true,
        earn_on_credit: false,
      });
      config = await repo.save(config);
    }
    return config;
  }

  async updateConfig(connection: DataSource, data: Partial<LoyaltyConfig>): Promise<LoyaltyConfig> {
    const config = await this.getConfig(connection);
    const repo = connection.getRepository(LoyaltyConfig);

    if (data.spend_per_point !== undefined) config.spend_per_point = data.spend_per_point;
    if (data.point_value !== undefined) config.point_value = data.point_value;
    if (data.min_redemption_points !== undefined) config.min_redemption_points = data.min_redemption_points;
    if (data.expiration_days !== undefined) config.expiration_days = data.expiration_days;
    if (data.is_active !== undefined) config.is_active = data.is_active;
    if (data.earn_on_layaway !== undefined) config.earn_on_layaway = data.earn_on_layaway;
    if (data.earn_on_credit !== undefined) config.earn_on_credit = data.earn_on_credit;

    return repo.save(config);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  EARN POINTS — Called by POS after completing a sale
  // ═══════════════════════════════════════════════════════════════════

  async earnPoints(
    connection: DataSource,
    data: {
      customer_id: string;
      sale_id: string;
      sale_amount: number;
      employee_id?: string;
      type?: string;
    },
  ): Promise<LoyaltyLedger | null> {
    const config = await this.getConfig(connection);
    if (!config.is_active) return null;

    const spendPerPoint = Number(config.spend_per_point);
    if (spendPerPoint <= 0) return null;

    const pointsEarned = Math.floor(Number(data.sale_amount) / spendPerPoint);
    if (pointsEarned <= 0) return null;

    const customerRepo = connection.getRepository(Customer);
    const customer = await customerRepo.findOne({ where: { id: data.customer_id } });
    if (!customer) return null;

    const newBalance = customer.loyalty_points + pointsEarned;

    // Update customer balance
    customer.loyalty_points = newBalance;
    await customerRepo.save(customer);

    // Create ledger entry
    const ledgerRepo = connection.getRepository(LoyaltyLedger);
    const entry = ledgerRepo.create({
      customer_id: data.customer_id,
      sale_id: data.sale_id,
      type: data.type || 'earned',
      points_earned: pointsEarned,
      points_spent: 0,
      balance_after: newBalance,
      description: `${pointsEarned} punto${pointsEarned !== 1 ? 's' : ''} por compra de $${Number(data.sale_amount).toFixed(2)}`,
      employee_id: data.employee_id || null,
    });

    return ledgerRepo.save(entry);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  REDEEM POINTS — Called by POS when customer pays with points
  // ═══════════════════════════════════════════════════════════════════

  async redeemPoints(
    connection: DataSource,
    data: {
      customer_id: string;
      sale_id?: string;
      points: number;
      employee_id?: string;
    },
  ): Promise<LoyaltyLedger> {
    const config = await this.getConfig(connection);
    if (!config.is_active) throw new BadRequestException('El programa de lealtad no esta activo');

    if (data.points < config.min_redemption_points) {
      throw new BadRequestException(`El minimo de puntos a canjear es ${config.min_redemption_points}`);
    }

    const customerRepo = connection.getRepository(Customer);
    const customer = await customerRepo.findOne({ where: { id: data.customer_id } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    if (customer.loyalty_points < data.points) {
      throw new BadRequestException(`El cliente solo tiene ${customer.loyalty_points} puntos disponibles`);
    }

    const newBalance = customer.loyalty_points - data.points;
    customer.loyalty_points = newBalance;
    await customerRepo.save(customer);

    const ledgerRepo = connection.getRepository(LoyaltyLedger);
    const entry = ledgerRepo.create({
      customer_id: data.customer_id,
      sale_id: data.sale_id || null,
      type: 'redeemed',
      points_earned: 0,
      points_spent: data.points,
      balance_after: newBalance,
      description: `Canje de ${data.points} punto${data.points !== 1 ? 's' : ''} ($${(data.points * Number(config.point_value)).toFixed(2)} de descuento)`,
      employee_id: data.employee_id || null,
    });

    return ledgerRepo.save(entry);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MANUAL ADJUSTMENT — Admin grants/deducts points
  // ═══════════════════════════════════════════════════════════════════

  async manualAdjustment(
    connection: DataSource,
    data: {
      customer_id: string;
      points: number;
      type: 'manual_credit' | 'manual_debit';
      description?: string;
      employee_id?: string;
    },
  ): Promise<LoyaltyLedger> {
    if (data.points <= 0) throw new BadRequestException('La cantidad de puntos debe ser positiva');

    const customerRepo = connection.getRepository(Customer);
    const customer = await customerRepo.findOne({ where: { id: data.customer_id } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    let newBalance: number;
    let earned = 0;
    let spent = 0;

    if (data.type === 'manual_credit') {
      newBalance = customer.loyalty_points + data.points;
      earned = data.points;
    } else {
      if (customer.loyalty_points < data.points) {
        throw new BadRequestException(`El cliente solo tiene ${customer.loyalty_points} puntos`);
      }
      newBalance = customer.loyalty_points - data.points;
      spent = data.points;
    }

    customer.loyalty_points = newBalance;
    await customerRepo.save(customer);

    const ledgerRepo = connection.getRepository(LoyaltyLedger);
    const entry = ledgerRepo.create({
      customer_id: data.customer_id,
      type: data.type,
      points_earned: earned,
      points_spent: spent,
      balance_after: newBalance,
      description: data.description || (data.type === 'manual_credit' ? 'Ajuste manual: abono' : 'Ajuste manual: cargo'),
      employee_id: data.employee_id || null,
    });

    return ledgerRepo.save(entry);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  LEDGER HISTORY — for customer profile
  // ═══════════════════════════════════════════════════════════════════

  async getCustomerLedger(
    connection: DataSource,
    customerId: string,
    page = 1,
    limit = 20,
  ) {
    const repo = connection.getRepository(LoyaltyLedger);
    const [items, total] = await repo.findAndCount({
      where: { customer_id: customerId },
      relations: ['sale', 'employee'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CALCULATE POINTS VALUE — helper for POS
  // ═══════════════════════════════════════════════════════════════════

  async calculatePointsValue(connection: DataSource, points: number): Promise<number> {
    const config = await this.getConfig(connection);
    return points * Number(config.point_value);
  }
}
