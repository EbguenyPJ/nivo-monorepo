import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Brand } from '@nivo/database';

@Injectable()
export class BrandsService {
  async findAll(connection: DataSource, includeInactive = false) {
    const repo = connection.getRepository(Brand);
    const where = includeInactive ? {} : { is_active: true };
    return repo.find({ where, order: { name: 'ASC' } });
  }

  async findOne(connection: DataSource, id: string) {
    const repo = connection.getRepository(Brand);
    const brand = await repo.findOne({ where: { id } });
    if (!brand) throw new NotFoundException('Marca no encontrada');
    return brand;
  }

  async create(connection: DataSource, data: { name: string; logo_url?: string }) {
    const repo = connection.getRepository(Brand);
    if (!data.name?.trim()) throw new BadRequestException('El nombre es obligatorio');

    const existing = await repo.findOne({ where: { name: data.name.trim() } });
    if (existing) throw new ConflictException('Ya existe una marca con este nombre');

    const brand = repo.create({
      name: data.name.trim(),
      logo_url: data.logo_url || null,
      is_active: true,
    });
    return repo.save(brand);
  }

  async update(connection: DataSource, id: string, data: Partial<{ name: string; logo_url: string; is_active: boolean }>) {
    const repo = connection.getRepository(Brand);
    const brand = await repo.findOne({ where: { id } });
    if (!brand) throw new NotFoundException('Marca no encontrada');

    if (data.name && data.name.trim() !== brand.name) {
      const dup = await repo.findOne({ where: { name: data.name.trim() } });
      if (dup) throw new ConflictException('Ya existe una marca con este nombre');
      data.name = data.name.trim();
    }

    Object.assign(brand, data);
    return repo.save(brand);
  }

  async toggleStatus(connection: DataSource, id: string) {
    const repo = connection.getRepository(Brand);
    const brand = await repo.findOne({ where: { id } });
    if (!brand) throw new NotFoundException('Marca no encontrada');
    brand.is_active = !brand.is_active;
    return repo.save(brand);
  }
}
