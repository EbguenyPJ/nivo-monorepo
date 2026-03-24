import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { Collection } from '@nivo/database';

@Injectable()
export class CollectionsService {
  /**
   * Returns the full tree structure (all collections with children nested).
   * We load flat, then build the tree in memory — safe for small datasets (< 500 nodes).
   */
  async getTree(connection: DataSource, includeInactive = false) {
    const repo = connection.getRepository(Collection);
    const where = includeInactive ? {} : { is_active: true };
    const all = await repo.find({ where, order: { sort_order: 'ASC', name: 'ASC' } });

    // Build tree
    const map = new Map<string, any>();
    const roots: any[] = [];

    for (const c of all) {
      map.set(c.id, { ...c, children: [] });
    }

    for (const c of all) {
      const node = map.get(c.id)!;
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /** Flat list (useful for selects) */
  async findAll(connection: DataSource, includeInactive = false) {
    const repo = connection.getRepository(Collection);
    const where = includeInactive ? {} : { is_active: true };
    return repo.find({ where, order: { sort_order: 'ASC', name: 'ASC' } });
  }

  async findOne(connection: DataSource, id: string) {
    const repo = connection.getRepository(Collection);
    const collection = await repo.findOne({ where: { id }, relations: ['children'] });
    if (!collection) throw new NotFoundException('Colección no encontrada');
    return collection;
  }

  async create(connection: DataSource, data: { name: string; parent_id?: string; color?: string; image_url?: string }) {
    const repo = connection.getRepository(Collection);
    if (!data.name?.trim()) throw new BadRequestException('El nombre es obligatorio');

    // Get sort_order for new sibling
    const siblings = await repo.find({
      where: { parent_id: data.parent_id || IsNull() as any },
    });
    const maxSort = siblings.reduce((max, s) => Math.max(max, s.sort_order), -1);

    const collection = repo.create({
      name: data.name.trim(),
      parent_id: data.parent_id || null,
      color: data.color || null,
      image_url: data.image_url || null,
      sort_order: maxSort + 1,
      is_active: true,
    });
    return repo.save(collection);
  }

  async update(connection: DataSource, id: string, data: Partial<{ name: string; parent_id: string | null; color: string; image_url: string; is_active: boolean; sort_order: number }>) {
    const repo = connection.getRepository(Collection);
    const collection = await repo.findOne({ where: { id } });
    if (!collection) throw new NotFoundException('Colección no encontrada');

    // Prevent circular reference (can't be its own parent)
    if (data.parent_id === id) throw new BadRequestException('Una colección no puede ser su propio padre');

    // If reparenting, check we don't create a cycle
    if (data.parent_id !== undefined && data.parent_id !== collection.parent_id) {
      if (data.parent_id) {
        const isDescendant = await this.isDescendantOf(connection, data.parent_id, id);
        if (isDescendant) throw new BadRequestException('No se puede mover a un descendiente propio');
      }
    }

    Object.assign(collection, data);
    return repo.save(collection);
  }

  /** Move a collection to a new parent + position */
  async move(connection: DataSource, id: string, data: { parent_id: string | null; sort_order: number }) {
    const repo = connection.getRepository(Collection);
    const collection = await repo.findOne({ where: { id } });
    if (!collection) throw new NotFoundException('Colección no encontrada');

    if (data.parent_id === id) throw new BadRequestException('Una colección no puede ser su propio padre');
    if (data.parent_id) {
      const isDescendant = await this.isDescendantOf(connection, data.parent_id, id);
      if (isDescendant) throw new BadRequestException('No se puede mover a un descendiente propio');
    }

    collection.parent_id = data.parent_id;
    collection.sort_order = data.sort_order;
    return repo.save(collection);
  }

  /** Reorder siblings */
  async reorder(connection: DataSource, items: { id: string; sort_order: number }[]) {
    const repo = connection.getRepository(Collection);
    for (const item of items) {
      await repo.update(item.id, { sort_order: item.sort_order });
    }
    return { success: true };
  }

  async toggleStatus(connection: DataSource, id: string) {
    const repo = connection.getRepository(Collection);
    const collection = await repo.findOne({ where: { id } });
    if (!collection) throw new NotFoundException('Colección no encontrada');
    collection.is_active = !collection.is_active;
    return repo.save(collection);
  }

  async remove(connection: DataSource, id: string) {
    const repo = connection.getRepository(Collection);
    const collection = await repo.findOne({ where: { id }, relations: ['children'] });
    if (!collection) throw new NotFoundException('Colección no encontrada');

    // Reparent children to this collection's parent
    if (collection.children && collection.children.length > 0) {
      for (const child of collection.children) {
        child.parent_id = collection.parent_id;
        await repo.save(child);
      }
    }

    await repo.remove(collection);
    return { message: `Colección "${collection.name}" eliminada` };
  }

  /** Check if `targetId` is a descendant of `ancestorId` */
  private async isDescendantOf(connection: DataSource, targetId: string, ancestorId: string): Promise<boolean> {
    const repo = connection.getRepository(Collection);
    let current = await repo.findOne({ where: { id: targetId } });
    const visited = new Set<string>();

    while (current && current.parent_id) {
      if (current.parent_id === ancestorId) return true;
      if (visited.has(current.parent_id)) return false;
      visited.add(current.parent_id);
      current = await repo.findOne({ where: { id: current.parent_id } });
    }
    return false;
  }
}
