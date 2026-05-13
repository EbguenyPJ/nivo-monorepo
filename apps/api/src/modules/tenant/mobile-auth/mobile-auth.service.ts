import {
  Injectable, BadRequestException, UnauthorizedException, ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Customer, CustomerAuth, LoyaltyLedger } from '@nivo/database';

@Injectable()
export class MobileAuthService {
  constructor(private readonly jwtService: JwtService) {}

  async register(
    connection: DataSource,
    tenantId: string,
    data: { email: string; password: string; name: string; phone?: string },
  ) {
    const authRepo = connection.getRepository(CustomerAuth);
    const existing = await authRepo.findOne({ where: { email: data.email.toLowerCase() } });
    if (existing) throw new ConflictException('Ya existe una cuenta con este correo');

    if (data.password.length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    }

    const customerRepo = connection.getRepository(Customer);
    const customer = customerRepo.create({
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone ?? null,
    });
    const savedCustomer = await customerRepo.save(customer);

    const passwordHash = await bcrypt.hash(data.password, 10);
    const auth = authRepo.create({
      customer_id: savedCustomer.id,
      email: data.email.toLowerCase(),
      password_hash: passwordHash,
      phone: data.phone ?? null,
    });
    await authRepo.save(auth);

    const token = this.signToken(savedCustomer.id, auth.id, tenantId);

    return {
      access_token: token,
      user: this.formatUser(savedCustomer, auth),
    };
  }

  async login(
    connection: DataSource,
    tenantId: string,
    data: { email: string; password: string },
  ) {
    const authRepo = connection.getRepository(CustomerAuth);
    const auth = await authRepo.findOne({
      where: { email: data.email.toLowerCase() },
      relations: ['customer'],
    });
    if (!auth) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(data.password, auth.password_hash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    const customer = auth.customer;
    const token = this.signToken(customer.id, auth.id, tenantId);

    return {
      access_token: token,
      user: this.formatUser(customer, auth),
    };
  }

  async getProfile(connection: DataSource, customerId: string) {
    const customerRepo = connection.getRepository(Customer);
    const customer = await customerRepo.findOne({ where: { id: customerId } });
    if (!customer) throw new UnauthorizedException('Cliente no encontrado');

    const authRepo = connection.getRepository(CustomerAuth);
    const auth = await authRepo.findOne({ where: { customer_id: customerId } });

    return this.formatUser(customer, auth);
  }

  async updatePushToken(connection: DataSource, customerId: string, pushToken: string) {
    const authRepo = connection.getRepository(CustomerAuth);
    await authRepo.update({ customer_id: customerId }, { push_token: pushToken });
  }

  async getLoyaltyProfile(connection: DataSource, customerId: string) {
    const customer = await connection.getRepository(Customer).findOne({
      where: { id: customerId },
    });
    if (!customer) throw new UnauthorizedException('Cliente no encontrado');

    const ledgerRepo = connection.getRepository(LoyaltyLedger);
    const totalPurchases = await ledgerRepo.count({
      where: { customer_id: customerId },
    });

    return {
      customer_id: customer.id,
      name: customer.name,
      points: customer.loyalty_points,
      tier: customer.membership_tier,
      qr_data: `nivo:customer:${customer.id}`,
      total_purchases: totalPurchases,
      member_since: customer.created_at.toISOString(),
    };
  }

  private signToken(customerId: string, authId: string, tenantId: string): string {
    return this.jwtService.sign({
      sub: authId,
      customer_id: customerId,
      type: 'customer',
      tenant_id: tenantId,
    });
  }

  private formatUser(customer: Customer, auth: CustomerAuth | null) {
    return {
      id: auth?.id ?? customer.id,
      customer_id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: auth?.phone ?? customer.phone,
      loyalty_points: customer.loyalty_points,
      membership_tier: customer.membership_tier,
    };
  }
}
