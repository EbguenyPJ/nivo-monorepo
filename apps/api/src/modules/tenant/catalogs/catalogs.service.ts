import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource, Not, IsNull } from 'typeorm';
import {
  PaymentMethod, Tax, CancellationReason, UnitOfMeasure,
  Color, SizeGroup, SizeSystem, Size, SizeEquivalency,
  PriceList,
} from '@nivo/database';

@Injectable()
export class CatalogsService {
  // ═══════════════════════════════════════════════════════════════
  // PAYMENT METHODS
  // ═══════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════
  // TAXES
  // ═══════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════
  // CANCELLATION REASONS
  // ═══════════════════════════════════════════════════════════════
  async findAllCancellationReasons(connection: DataSource) {
    const repo = connection.getRepository(CancellationReason);
    return repo.find({ order: { created_at: 'ASC' } });
  }

  async createCancellationReason(connection: DataSource, data: { name: string; affects_inventory?: boolean }) {
    const repo = connection.getRepository(CancellationReason);
    await this.checkDuplicateName(repo, data.name);
    const entity = repo.create({
      name: data.name,
      affects_inventory: data.affects_inventory ?? true,
      is_active: true,
    });
    return repo.save(entity);
  }

  async updateCancellationReason(connection: DataSource, id: string, data: Partial<{ name: string; affects_inventory: boolean; is_active: boolean }>) {
    const repo = connection.getRepository(CancellationReason);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Motivo de cancelación no encontrado');
    if (data.name && data.name !== entity.name) {
      await this.checkDuplicateName(repo, data.name, id);
    }
    Object.assign(entity, data);
    return repo.save(entity);
  }

  // ═══════════════════════════════════════════════════════════════
  // UNITS OF MEASURE
  // ═══════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════
  // COLORS
  // ═══════════════════════════════════════════════════════════════
  async findAllColors(connection: DataSource) {
    const repo = connection.getRepository(Color);
    return repo.find({
      relations: ['branch'],
      order: { branch_id: { direction: 'ASC', nulls: 'FIRST' }, name: 'ASC' },
    });
  }

  async createColor(connection: DataSource, data: { name: string; hex_code: string; branch_id?: string | null }) {
    const repo = connection.getRepository(Color);
    const entity = repo.create({
      name: data.name,
      hex_code: data.hex_code,
      branch_id: data.branch_id || null,
      is_active: true,
    });
    return repo.save(entity);
  }

  async updateColor(connection: DataSource, id: string, data: Partial<{ name: string; hex_code: string; branch_id: string | null; is_active: boolean }>) {
    const repo = connection.getRepository(Color);
    const entity = await repo.findOne({ where: { id }, relations: ['branch'] });
    if (!entity) throw new NotFoundException('Color no encontrado');
    Object.assign(entity, data);
    return repo.save(entity);
  }

  // ═══════════════════════════════════════════════════════════════
  // SIZE GROUPS
  // ═══════════════════════════════════════════════════════════════
  async findAllSizeGroups(connection: DataSource) {
    const repo = connection.getRepository(SizeGroup);
    return repo.find({ order: { created_at: 'ASC' } });
  }

  async createSizeGroup(connection: DataSource, data: { name: string }) {
    const repo = connection.getRepository(SizeGroup);
    await this.checkDuplicateName(repo, data.name);
    return repo.save(repo.create({ name: data.name, is_active: true }));
  }

  async updateSizeGroup(connection: DataSource, id: string, data: Partial<{ name: string; is_active: boolean }>) {
    const repo = connection.getRepository(SizeGroup);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Grupo de tallas no encontrado');
    if (data.name && data.name !== entity.name) {
      await this.checkDuplicateName(repo, data.name, id);
    }
    Object.assign(entity, data);
    return repo.save(entity);
  }

  // ═══════════════════════════════════════════════════════════════
  // SIZE SYSTEMS
  // ═══════════════════════════════════════════════════════════════
  async findAllSizeSystems(connection: DataSource) {
    const repo = connection.getRepository(SizeSystem);
    return repo.find({ order: { created_at: 'ASC' } });
  }

  async createSizeSystem(connection: DataSource, data: { name: string }) {
    const repo = connection.getRepository(SizeSystem);
    await this.checkDuplicateName(repo, data.name);
    return repo.save(repo.create({ name: data.name, is_active: true }));
  }

  async updateSizeSystem(connection: DataSource, id: string, data: Partial<{ name: string; is_active: boolean }>) {
    const repo = connection.getRepository(SizeSystem);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Sistema de tallas no encontrado');
    if (data.name && data.name !== entity.name) {
      await this.checkDuplicateName(repo, data.name, id);
    }
    Object.assign(entity, data);
    return repo.save(entity);
  }

  // ═══════════════════════════════════════════════════════════════
  // SIZES (the rows — with equivalencies as cells)
  // ═══════════════════════════════════════════════════════════════

  /** Get all sizes for a group, joined with their equivalencies */
  async findSizesByGroup(connection: DataSource, groupId: string) {
    const repo = connection.getRepository(Size);
    return repo.find({
      where: { size_group_id: groupId },
      relations: ['equivalencies', 'equivalencies.sizeSystem'],
      order: { order_index: 'ASC' },
    });
  }

  /** Create a new size row with equivalencies for each system */
  async createSize(
    connection: DataSource,
    data: { size_group_id: string; equivalencies: { size_system_id: string; value: string }[] },
  ) {
    return connection.transaction(async (manager) => {
      // Auto-increment order_index
      const sizeRepo = manager.getRepository(Size);
      const maxRow = await sizeRepo
        .createQueryBuilder('s')
        .select('MAX(s.order_index)', 'max')
        .where('s.size_group_id = :gid', { gid: data.size_group_id })
        .getRawOne();
      const nextOrder = (maxRow?.max ?? -1) + 1;

      const size = sizeRepo.create({
        size_group_id: data.size_group_id,
        order_index: nextOrder,
      });
      const savedSize = await sizeRepo.save(size);

      // Create equivalencies
      if (data.equivalencies?.length) {
        const eqRepo = manager.getRepository(SizeEquivalency);
        const eqs = data.equivalencies
          .filter((e) => e.value?.trim())
          .map((e) =>
            eqRepo.create({
              size_id: savedSize.id,
              size_system_id: e.size_system_id,
              value: e.value.trim(),
            }),
          );
        if (eqs.length) await eqRepo.save(eqs);
      }

      return sizeRepo.findOne({
        where: { id: savedSize.id },
        relations: ['equivalencies', 'equivalencies.sizeSystem'],
      });
    });
  }

  /** Update a size row's equivalencies (upsert cells) */
  async updateSizeEquivalencies(
    connection: DataSource,
    sizeId: string,
    equivalencies: { size_system_id: string; value: string }[],
  ) {
    const sizeRepo = connection.getRepository(Size);
    const size = await sizeRepo.findOne({ where: { id: sizeId } });
    if (!size) throw new NotFoundException('Talla no encontrada');

    const eqRepo = connection.getRepository(SizeEquivalency);

    for (const eq of equivalencies) {
      const existing = await eqRepo.findOne({
        where: { size_id: sizeId, size_system_id: eq.size_system_id },
      });

      if (existing) {
        if (eq.value?.trim()) {
          existing.value = eq.value.trim();
          await eqRepo.save(existing);
        } else {
          await eqRepo.remove(existing);
        }
      } else if (eq.value?.trim()) {
        await eqRepo.save(
          eqRepo.create({
            size_id: sizeId,
            size_system_id: eq.size_system_id,
            value: eq.value.trim(),
          }),
        );
      }
    }

    return sizeRepo.findOne({
      where: { id: sizeId },
      relations: ['equivalencies', 'equivalencies.sizeSystem'],
    });
  }

  /** Reorder sizes (drag & drop) */
  async reorderSizes(connection: DataSource, items: { id: string; order_index: number }[]) {
    const repo = connection.getRepository(Size);
    for (const item of items) {
      await repo.update(item.id, { order_index: item.order_index });
    }
    return { reordered: true };
  }

  /** Delete a size row (and cascade equivalencies) */
  async deleteSize(connection: DataSource, id: string) {
    const repo = connection.getRepository(Size);
    const size = await repo.findOne({ where: { id } });
    if (!size) throw new NotFoundException('Talla no encontrada');
    await repo.remove(size);
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════
  // PRICE LISTS
  // ═══════════════════════════════════════════════════════════════
  async findAllPriceLists(connection: DataSource) {
    const repo = connection.getRepository(PriceList);
    return repo.find({ order: { is_default: 'DESC', created_at: 'ASC' } });
  }

  async createPriceList(connection: DataSource, data: { name: string; default_margin_percentage?: number }) {
    const repo = connection.getRepository(PriceList);
    await this.checkDuplicateName(repo, data.name);
    const entity = repo.create({
      name: data.name,
      default_margin_percentage: data.default_margin_percentage ?? 0,
      is_default: false,
      is_active: true,
    });
    return repo.save(entity);
  }

  async updatePriceList(
    connection: DataSource,
    id: string,
    data: Partial<{ name: string; default_margin_percentage: number; is_default: boolean; is_active: boolean }>,
  ) {
    const repo = connection.getRepository(PriceList);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Lista de precios no encontrada');
    if (data.name && data.name !== entity.name) {
      await this.checkDuplicateName(repo, data.name, id);
    }
    // If setting as default, unset current default first
    if (data.is_default === true && !entity.is_default) {
      await repo.update({}, { is_default: false });
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
