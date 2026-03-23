import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentMethod, Tax, CancellationReason, UnitOfMeasure } from '@nivo/database';

type CatalogEntity = typeof PaymentMethod | typeof Tax | typeof CancellationReason | typeof UnitOfMeasure;

@Injectable()
export class CatalogsService {
  // ─── Payment Methods ──────────────────────────────────────────
  async findAllPaymentMethods(connection: DataSource) {
    const repo = connection.getRepository(PaymentMethod);
    return repo.find({ order: { created_at: 'ASC' } });
  }

  async createPaymentMethod(connection: DataSource, data: { name: string; requires_reference?: boolean }) {
    const repo = connection.getRepository(PaymentMethod);
    await this.checkDuplicateName(repo, data.name);
    const entity = repo.create({
      name: data.name,
      requires_reference: data.requires_reference ?? false,
      is_active: true,
    });
    return repo.save(entity);
  }

  async updatePaymentMethod(connection: DataSource, id: string, data: Partial<{ name: string; requires_reference: boolean; is_active: boolean }>) {
    const repo = connection.getRepository(PaymentMethod);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Método de pago no encontrado');
    if (data.name && data.name !== entity.name) {
      await this.checkDuplicateName(repo, data.name, id);
    }
    Object.assign(entity, data);
    return repo.save(entity);
  }

  // ─── Taxes ────────────────────────────────────────────────────
  async findAllTaxes(connection: DataSource) {
    const repo = connection.getRepository(Tax);
    return repo.find({ order: { created_at: 'ASC' } });
  }

  async createTax(connection: DataSource, data: { name: string; percentage: number }) {
    const repo = connection.getRepository(Tax);
    await this.checkDuplicateName(repo, data.name);
    const entity = repo.create({
      name: data.name,
      percentage: data.percentage,
      is_active: true,
    });
    return repo.save(entity);
  }

  async updateTax(connection: DataSource, id: string, data: Partial<{ name: string; percentage: number; is_active: boolean }>) {
    const repo = connection.getRepository(Tax);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Impuesto no encontrado');
    if (data.name && data.name !== entity.name) {
      await this.checkDuplicateName(repo, data.name, id);
    }
    Object.assign(entity, data);
    return repo.save(entity);
  }

  // ─── Cancellation Reasons ────────────────────────────────────
  async findAllCancellationReasons(connection: DataSource) {
    const repo = connection.getRepository(CancellationReason);
    return repo.find({ order: { created_at: 'ASC' } });
  }

  async createCancellationReason(connection: DataSource, data: { name: string }) {
    const repo = connection.getRepository(CancellationReason);
    await this.checkDuplicateName(repo, data.name);
    const entity = repo.create({ name: data.name, is_active: true });
    return repo.save(entity);
  }

  async updateCancellationReason(connection: DataSource, id: string, data: Partial<{ name: string; is_active: boolean }>) {
    const repo = connection.getRepository(CancellationReason);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Motivo de cancelación no encontrado');
    if (data.name && data.name !== entity.name) {
      await this.checkDuplicateName(repo, data.name, id);
    }
    Object.assign(entity, data);
    return repo.save(entity);
  }

  // ─── Units of Measure ────────────────────────────────────────
  async findAllUnitsOfMeasure(connection: DataSource) {
    const repo = connection.getRepository(UnitOfMeasure);
    return repo.find({ order: { created_at: 'ASC' } });
  }

  async createUnitOfMeasure(connection: DataSource, data: { name: string; abbreviation?: string }) {
    const repo = connection.getRepository(UnitOfMeasure);
    await this.checkDuplicateName(repo, data.name);
    const entity = repo.create({
      name: data.name,
      abbreviation: data.abbreviation || null,
      is_active: true,
    });
    return repo.save(entity);
  }

  async updateUnitOfMeasure(connection: DataSource, id: string, data: Partial<{ name: string; abbreviation: string; is_active: boolean }>) {
    const repo = connection.getRepository(UnitOfMeasure);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Unidad de medida no encontrada');
    if (data.name && data.name !== entity.name) {
      await this.checkDuplicateName(repo, data.name, id);
    }
    Object.assign(entity, data);
    return repo.save(entity);
  }

  // ─── Helpers ──────────────────────────────────────────────────
  private async checkDuplicateName(repo: any, name: string, excludeId?: string) {
    const existing = await repo.findOne({ where: { name } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Ya existe un registro con el nombre "${name}"`);
    }
  }
}
