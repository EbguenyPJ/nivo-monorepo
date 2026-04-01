import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StorageLocation, InventoryLocation, Branch } from '@nivo/database';

/** Valid parent types for each location type */
const VALID_PARENT_TYPES: Record<string, (string | null)[]> = {
  zone: [null],                    // zones are always root
  aisle: [null, 'zone'],           // aisles can be root or under a zone
  shelf: ['aisle', 'zone'],        // shelves go under aisles or zones
  bin: ['shelf'],                  // bins go under shelves
};

@Injectable()
export class StorageLocationsService {
  // ─── List (tree) by branch ─────────────────────────────────────

  async findAllByBranch(
    connection: DataSource,
    branchId: string,
  ): Promise<{ tree: StorageLocation[]; flat: StorageLocation[] }> {
    const repo = connection.getRepository(StorageLocation);
    const flat = await repo.find({
      where: { branch_id: branchId },
      order: { type: 'ASC', code: 'ASC' },
    });

    // Build tree in memory
    const map = new Map<string, StorageLocation & { children: StorageLocation[] }>();
    for (const loc of flat) {
      map.set(loc.id, { ...loc, children: [] });
    }

    const tree: StorageLocation[] = [];
    for (const loc of map.values()) {
      if (loc.parent_id && map.has(loc.parent_id)) {
        map.get(loc.parent_id)!.children.push(loc);
      } else {
        tree.push(loc);
      }
    }

    return { tree, flat };
  }

  // ─── Single location ──────────────────────────────────────────

  async findOne(connection: DataSource, id: string): Promise<StorageLocation> {
    const repo = connection.getRepository(StorageLocation);
    const location = await repo.findOne({
      where: { id },
      relations: ['children'],
    });
    if (!location) throw new NotFoundException('Ubicación no encontrada');
    return location;
  }

  // ─── Create ────────────────────────────────────────────────────

  async create(
    connection: DataSource,
    data: {
      branch_id: string;
      parent_id?: string;
      name: string;
      code: string;
      type: string;
      description?: string;
    },
  ): Promise<StorageLocation> {
    const repo = connection.getRepository(StorageLocation);

    // Validate branch exists
    const branchRepo = connection.getRepository(Branch);
    const branch = await branchRepo.findOne({ where: { id: data.branch_id } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');

    // Validate type
    if (!VALID_PARENT_TYPES[data.type]) {
      throw new BadRequestException(`Tipo inválido: ${data.type}. Tipos válidos: zone, aisle, shelf, bin`);
    }

    // Validate parent hierarchy
    await this.validateParentHierarchy(repo, data.type, data.parent_id || null, data.branch_id);

    // Validate code uniqueness within branch
    const existing = await repo.findOne({ where: { branch_id: data.branch_id, code: data.code.trim() } });
    if (existing) throw new ConflictException(`Ya existe una ubicación con el código "${data.code}" en esta sucursal`);

    return repo.save(repo.create({
      branch_id: data.branch_id,
      parent_id: data.parent_id || null,
      name: data.name.trim(),
      code: data.code.trim(),
      type: data.type,
      description: data.description || null,
      is_active: true,
    }));
  }

  // ─── Bulk Create ───────────────────────────────────────────────

  async bulkCreate(
    connection: DataSource,
    branchId: string,
    locations: Array<{
      parent_id?: string;
      name: string;
      code: string;
      type: string;
      description?: string;
    }>,
  ): Promise<StorageLocation[]> {
    // Validate branch exists
    const branchRepo = connection.getRepository(Branch);
    const branch = await branchRepo.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');

    return connection.transaction(async (manager) => {
      const repo = manager.getRepository(StorageLocation);
      const results: StorageLocation[] = [];

      for (const loc of locations) {
        // Check code uniqueness (including just-created in this batch)
        const existing = await repo.findOne({ where: { branch_id: branchId, code: loc.code.trim() } });
        if (existing) throw new ConflictException(`Código duplicado: "${loc.code}"`);

        const saved = await repo.save(repo.create({
          branch_id: branchId,
          parent_id: loc.parent_id || null,
          name: loc.name.trim(),
          code: loc.code.trim(),
          type: loc.type,
          description: loc.description || null,
          is_active: true,
        }));
        results.push(saved);
      }

      return results;
    });
  }

  // ─── Update ────────────────────────────────────────────────────

  async update(
    connection: DataSource,
    id: string,
    data: { name?: string; code?: string; description?: string; is_active?: boolean },
  ): Promise<StorageLocation> {
    const repo = connection.getRepository(StorageLocation);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Ubicación no encontrada');

    // Check code uniqueness if changing
    if (data.code && data.code.trim() !== entity.code) {
      const dup = await repo.findOne({ where: { branch_id: entity.branch_id, code: data.code.trim() } });
      if (dup) throw new ConflictException(`Ya existe una ubicación con el código "${data.code}" en esta sucursal`);
      entity.code = data.code.trim();
    }

    if (data.name !== undefined) entity.name = data.name.trim();
    if (data.description !== undefined) entity.description = data.description || null;
    if (data.is_active !== undefined) entity.is_active = data.is_active;

    return repo.save(entity);
  }

  // ─── Toggle Status ─────────────────────────────────────────────

  async toggleStatus(connection: DataSource, id: string): Promise<StorageLocation> {
    const repo = connection.getRepository(StorageLocation);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Ubicación no encontrada');
    entity.is_active = !entity.is_active;
    return repo.save(entity);
  }

  // ─── Remove ────────────────────────────────────────────────────

  async remove(connection: DataSource, id: string): Promise<{ deleted: true }> {
    const repo = connection.getRepository(StorageLocation);
    const entity = await repo.findOne({ where: { id }, relations: ['children'] });
    if (!entity) throw new NotFoundException('Ubicación no encontrada');

    // Collect all descendant IDs (this location + children recursively)
    const allIds = await this.collectDescendantIds(repo, id);

    // Check if any InventoryLocation references these locations
    const invLocRepo = connection.getRepository(InventoryLocation);
    const refCount = await invLocRepo
      .createQueryBuilder('il')
      .where('il.location_id IN (:...ids)', { ids: allIds })
      .andWhere('il.quantity > 0')
      .getCount();

    if (refCount > 0) {
      throw new ConflictException(
        'No se puede eliminar esta ubicación porque tiene stock asignado. Mueve el stock primero.',
      );
    }

    // Safe to delete — cascade will handle children with 0 stock
    await repo.remove(entity);
    return { deleted: true };
  }

  // ─── Private Helpers ───────────────────────────────────────────

  private async validateParentHierarchy(
    repo: ReturnType<DataSource['getRepository']>,
    type: string,
    parentId: string | null,
    branchId: string,
  ): Promise<void> {
    const validParents = VALID_PARENT_TYPES[type];
    if (!validParents) return;

    if (parentId === null) {
      if (!validParents.includes(null)) {
        throw new BadRequestException(`Una ubicación de tipo "${type}" requiere un padre`);
      }
      return;
    }

    const parent = await (repo as any).findOne({ where: { id: parentId } });
    if (!parent) throw new NotFoundException('Ubicación padre no encontrada');
    if (parent.branch_id !== branchId) {
      throw new BadRequestException('La ubicación padre debe pertenecer a la misma sucursal');
    }
    if (!validParents.includes(parent.type)) {
      throw new BadRequestException(
        `Una ubicación de tipo "${type}" no puede ser hija de una de tipo "${parent.type}". Tipos padre válidos: ${validParents.filter(Boolean).join(', ')}`,
      );
    }
  }

  private async collectDescendantIds(
    repo: ReturnType<DataSource['getRepository']>,
    locationId: string,
  ): Promise<string[]> {
    const ids = [locationId];
    const children = await (repo as any).find({ where: { parent_id: locationId } });
    for (const child of children) {
      const childIds = await this.collectDescendantIds(repo, child.id);
      ids.push(...childIds);
    }
    return ids;
  }
}
