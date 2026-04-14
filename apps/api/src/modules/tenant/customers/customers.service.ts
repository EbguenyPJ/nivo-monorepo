import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import {
  Customer, CustomerAddress, Sale, SaleItem,
  LoyaltyLedger, Layaway, CreditAccount,
} from '@nivo/database';

@Injectable()
export class CustomersService {
  // ─── List with pagination + search ──────────────────────────────
  async findAll(
    connection: DataSource,
    query: {
      search?: string;
      page?: number;
      limit?: number;
      is_active?: string;
      membership_tier?: string;
    },
  ) {
    const repo = connection.getRepository(Customer);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    const qb = repo
      .createQueryBuilder('c')
      .where('c.deleted_at IS NULL');

    // Search across name, email, phone, rfc
    if (query.search?.trim()) {
      const s = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(c.name) LIKE :s OR LOWER(c.email) LIKE :s OR c.phone LIKE :s OR LOWER(c.rfc) LIKE :s)',
        { s },
      );
    }

    // Active filter
    if (query.is_active === 'true') {
      qb.andWhere('c.is_active = true');
    } else if (query.is_active === 'false') {
      qb.andWhere('c.is_active = false');
    }

    // Membership filter
    if (query.membership_tier) {
      qb.andWhere('c.membership_tier = :tier', { tier: query.membership_tier });
    }

    qb.orderBy('c.name', 'ASC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ��── Single customer with 360° profile ──────────────────────────
  async findOne(connection: DataSource, id: string) {
    const repo = connection.getRepository(Customer);
    const customer = await repo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['addresses', 'price_list'],
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    // Aggregate sales stats
    const saleRepo = connection.getRepository(Sale);
    const stats = await saleRepo
      .createQueryBuilder('s')
      .select('COUNT(s.id)', 'total_purchases')
      .addSelect('COALESCE(SUM(s.total_amount), 0)', 'total_spent')
      .addSelect('MAX(s.created_at)', 'last_purchase_date')
      .addSelect('COALESCE(AVG(s.total_amount), 0)', 'average_ticket')
      .where('s.customer_id = :id', { id })
      .andWhere('s.status = :status', { status: 'completed' })
      .getRawOne();

    // Most purchased size (analyze attributes.Talla from sale items)
    let favorite_size: string | null = null;
    try {
      const sizeData = await connection.getRepository(SaleItem)
        .createQueryBuilder('si')
        .innerJoin('si.sale', 's')
        .innerJoin('si.variant', 'v')
        .select("v.attributes->>'Talla MX'", 'size')
        .addSelect('SUM(si.quantity)', 'qty')
        .where('s.customer_id = :id', { id })
        .andWhere('s.status = :status', { status: 'completed' })
        .andWhere("v.attributes->>'Talla MX' IS NOT NULL")
        .groupBy("v.attributes->>'Talla MX'")
        .orderBy('qty', 'DESC')
        .limit(1)
        .getRawOne();
      favorite_size = sizeData?.size || null;
    } catch {
      // Attributes column may not have Talla MX for all tenants
    }

    // Loyalty recent (last 5 entries)
    const loyaltyRecent = await connection.getRepository(LoyaltyLedger).find({
      where: { customer_id: id },
      order: { created_at: 'DESC' },
      take: 5,
    });

    // Layaway summary
    const layawayRepo = connection.getRepository(Layaway);
    const activeLayaways = await layawayRepo.count({ where: { customer_id: id, status: 'active' } });
    const totalLayaways = await layawayRepo.count({ where: { customer_id: id } });

    // Credit account
    const creditAccount = await connection.getRepository(CreditAccount).findOne({
      where: { customer_id: id },
    });

    return {
      ...customer,
      stats: {
        total_purchases: Number(stats?.total_purchases || 0),
        total_spent: Number(stats?.total_spent || 0),
        lifetime_value: Number(stats?.total_spent || 0),
        last_purchase_date: stats?.last_purchase_date || null,
        average_ticket: Number(Number(stats?.average_ticket || 0).toFixed(2)),
        favorite_size,
      },
      loyalty_recent: loyaltyRecent,
      layaway_summary: { active: activeLayaways, total: totalLayaways },
      credit_account: creditAccount ? {
        id: creditAccount.id,
        credit_limit: Number(creditAccount.credit_limit),
        current_balance: Number(creditAccount.current_balance),
        available_credit: Number(creditAccount.credit_limit) - Number(creditAccount.current_balance),
        payment_terms: creditAccount.payment_terms,
        is_active: creditAccount.is_active,
      } : null,
    };
  }

  // ─── Create ─────────────────────────────────────────────────────
  async create(connection: DataSource, data: any) {
    const repo = connection.getRepository(Customer);

    // Derive display name: explicit name > first+last combo
    const firstName = data.first_name?.trim() || '';
    const lastName = data.last_name?.trim() || '';
    const derivedName = data.name?.trim() || `${firstName} ${lastName}`.trim();

    if (!derivedName) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    // Duplicate detection
    await this.checkDuplicates(connection, data);

    // Validate RFC format if provided
    if (data.rfc) {
      this.validateRfc(data.rfc);
    }

    const customer = repo.create({
      name: derivedName,
      first_name: firstName || null,
      last_name: lastName || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      rfc: data.rfc?.trim().toUpperCase() || null,
      date_of_birth: data.date_of_birth || null,
      notes: data.notes?.trim() || null,
      internal_notes: data.internal_notes?.trim() || null,
      price_list_id: data.price_list_id || null,
      membership_tier: data.membership_tier || null,
      tags: data.tags || [],
    });

    const saved = await repo.save(customer);

    // Create default address if provided
    if (data.address) {
      const addrRepo = connection.getRepository(CustomerAddress);
      const address = addrRepo.create({
        customer_id: saved.id,
        label: data.address.label || null,
        street: data.address.street,
        neighborhood: data.address.neighborhood || null,
        city: data.address.city,
        state: data.address.state,
        zip_code: data.address.zip_code,
        country: data.address.country || 'Mexico',
        reference: data.address.reference || null,
        is_default: true,
      });
      await addrRepo.save(address);
    }

    return this.findOne(connection, saved.id);
  }

  // ─── Update ─────────────────────────────────────────────────────
  async update(connection: DataSource, id: string, data: any) {
    const repo = connection.getRepository(Customer);
    const customer = await repo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    // Duplicate detection excluding self
    await this.checkDuplicates(connection, data, id);

    // Validate RFC if changing
    if (data.rfc !== undefined && data.rfc) {
      this.validateRfc(data.rfc);
      data.rfc = data.rfc.trim().toUpperCase();
    }

    // Trim string fields
    if (data.first_name !== undefined) data.first_name = data.first_name?.trim() || null;
    if (data.last_name !== undefined) data.last_name = data.last_name?.trim() || null;
    if (data.email !== undefined) data.email = data.email?.trim() || null;
    if (data.phone !== undefined) data.phone = data.phone?.trim() || null;
    if (data.notes !== undefined) data.notes = data.notes?.trim() || null;

    // Re-derive display name if first/last changed
    const fn = (data.first_name !== undefined ? data.first_name : customer.first_name) || '';
    const ln = (data.last_name !== undefined ? data.last_name : customer.last_name) || '';
    const derived = data.name?.trim() || `${fn} ${ln}`.trim();
    if (derived) data.name = derived;

    Object.assign(customer, data);
    await repo.save(customer);

    return this.findOne(connection, id);
  }

  // ─── Toggle active status ──────────────────────────────────────
  async toggleStatus(connection: DataSource, id: string) {
    const repo = connection.getRepository(Customer);
    const customer = await repo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    customer.is_active = !customer.is_active;
    return repo.save(customer);
  }

  // ─── Soft delete ───────────────────────────────────────────────
  async softDelete(connection: DataSource, id: string) {
    const repo = connection.getRepository(Customer);
    const customer = await repo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    if (Number(customer.credit_balance) > 0) {
      throw new BadRequestException(
        `No se puede eliminar: el cliente tiene saldo de credito pendiente ($${Number(customer.credit_balance).toFixed(2)})`,
      );
    }

    customer.deleted_at = new Date();
    customer.is_active = false;
    await repo.save(customer);

    return { message: `Cliente "${customer.name}" eliminado correctamente` };
  }

  // ─── Addresses ─────────────────────────────────────────────────
  async addAddress(connection: DataSource, customerId: string, data: any) {
    const customerRepo = connection.getRepository(Customer);
    const customer = await customerRepo.findOne({ where: { id: customerId, deleted_at: IsNull() } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    const addrRepo = connection.getRepository(CustomerAddress);

    // If setting as default, unmark others
    if (data.is_default) {
      await addrRepo.update({ customer_id: customerId }, { is_default: false });
    }

    const address = addrRepo.create({
      customer_id: customerId,
      label: data.label || null,
      street: data.street,
      neighborhood: data.neighborhood || null,
      city: data.city,
      state: data.state,
      zip_code: data.zip_code,
      country: data.country || 'Mexico',
      reference: data.reference || null,
      is_default: data.is_default || false,
    });

    return addrRepo.save(address);
  }

  async updateAddress(connection: DataSource, addressId: string, data: any) {
    const addrRepo = connection.getRepository(CustomerAddress);
    const address = await addrRepo.findOne({ where: { id: addressId } });
    if (!address) throw new NotFoundException('Direccion no encontrada');

    // If setting as default, unmark others
    if (data.is_default) {
      await addrRepo.update({ customer_id: address.customer_id }, { is_default: false });
    }

    Object.assign(address, data);
    return addrRepo.save(address);
  }

  async removeAddress(connection: DataSource, addressId: string) {
    const addrRepo = connection.getRepository(CustomerAddress);
    const address = await addrRepo.findOne({ where: { id: addressId } });
    if (!address) throw new NotFoundException('Direccion no encontrada');

    await addrRepo.remove(address);
    return { message: 'Direccion eliminada' };
  }

  // ─── Loyalty points ────────────────────────────────────────────
  async redeemPoints(connection: DataSource, data: { customer_id: string; points: number }) {
    const repo = connection.getRepository(Customer);
    const customer = await repo.findOne({ where: { id: data.customer_id } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    if (customer.loyalty_points < data.points) {
      throw new BadRequestException('Puntos insuficientes');
    }

    customer.loyalty_points -= data.points;
    return repo.save(customer);
  }

  // ─── Private helpers ───────────────────────────────────────────

  private async checkDuplicates(connection: DataSource, data: any, excludeId?: string) {
    const repo = connection.getRepository(Customer);

    if (data.email?.trim()) {
      const qb = repo
        .createQueryBuilder('c')
        .where('LOWER(c.email) = LOWER(:email)', { email: data.email.trim() })
        .andWhere('c.deleted_at IS NULL');
      if (excludeId) qb.andWhere('c.id != :excludeId', { excludeId });
      const existing = await qb.getOne();
      if (existing) {
        throw new ConflictException('Ya existe un cliente con este correo electronico');
      }
    }

    if (data.phone?.trim()) {
      const qb = repo
        .createQueryBuilder('c')
        .where('c.phone = :phone', { phone: data.phone.trim() })
        .andWhere('c.deleted_at IS NULL');
      if (excludeId) qb.andWhere('c.id != :excludeId', { excludeId });
      const existing = await qb.getOne();
      if (existing) {
        throw new ConflictException('Ya existe un cliente con este numero de telefono');
      }
    }

    if (data.rfc?.trim()) {
      const qb = repo
        .createQueryBuilder('c')
        .where('UPPER(c.rfc) = UPPER(:rfc)', { rfc: data.rfc.trim() })
        .andWhere('c.deleted_at IS NULL');
      if (excludeId) qb.andWhere('c.id != :excludeId', { excludeId });
      const existing = await qb.getOne();
      if (existing) {
        throw new ConflictException('Ya existe un cliente con este RFC');
      }
    }
  }

  private validateRfc(rfc: string) {
    const rfcRegex = /^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/i;
    if (!rfcRegex.test(rfc.trim())) {
      throw new BadRequestException('Formato de RFC invalido');
    }
  }
}
