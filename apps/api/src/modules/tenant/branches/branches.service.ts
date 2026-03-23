import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Branch, Employee } from '@nivo/database';

@Injectable()
export class BranchesService {
  async findAll(connection: DataSource, includeInactive = false) {
    const repo = connection.getRepository(Branch);
    const where = includeInactive ? {} : { is_active: true };
    return repo.find({ where, order: { created_at: 'ASC' } });
  }

  async findOne(connection: DataSource, id: string) {
    const repo = connection.getRepository(Branch);
    const branch = await repo.findOne({ where: { id } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    return branch;
  }

  async create(
    connection: DataSource,
    data: {
      name: string;
      code: string;
      address?: string;
      city?: string;
      zip_code?: string;
      phone?: string;
      ticket_footer?: string;
    },
  ) {
    const repo = connection.getRepository(Branch);

    if (!data.name?.trim()) throw new BadRequestException('El nombre es obligatorio');
    if (!data.code?.trim()) throw new BadRequestException('El código es obligatorio');

    const existingName = await repo.findOne({ where: { name: data.name } });
    if (existingName) throw new ConflictException('Ya existe una sucursal con este nombre');

    const existingCode = await repo.findOne({ where: { code: data.code.toUpperCase() } });
    if (existingCode) throw new ConflictException('Ya existe una sucursal con este código');

    const branch = repo.create({
      name: data.name.trim(),
      code: data.code.toUpperCase().trim(),
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      zip_code: data.zip_code?.trim() || null,
      phone: data.phone?.trim() || null,
      ticket_footer: data.ticket_footer?.trim() || null,
      is_active: true,
    });

    return repo.save(branch);
  }

  async update(
    connection: DataSource,
    id: string,
    data: {
      name?: string;
      code?: string;
      address?: string;
      city?: string;
      zip_code?: string;
      phone?: string;
      ticket_footer?: string;
    },
  ) {
    const repo = connection.getRepository(Branch);
    const branch = await repo.findOne({ where: { id } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');

    if (data.name && data.name !== branch.name) {
      const duplicate = await repo.findOne({ where: { name: data.name } });
      if (duplicate) throw new ConflictException('Ya existe una sucursal con este nombre');
    }

    if (data.code && data.code.toUpperCase() !== branch.code) {
      const duplicate = await repo.findOne({ where: { code: data.code.toUpperCase() } });
      if (duplicate) throw new ConflictException('Ya existe una sucursal con este código');
      data.code = data.code.toUpperCase();
    }

    Object.assign(branch, data);
    return repo.save(branch);
  }

  async toggleStatus(connection: DataSource, id: string) {
    const repo = connection.getRepository(Branch);
    const branch = await repo.findOne({ where: { id } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');

    branch.is_active = !branch.is_active;
    return repo.save(branch);
  }

  async remove(connection: DataSource, id: string) {
    const repo = connection.getRepository(Branch);
    const branch = await repo.findOne({ where: { id } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');

    const employeeRepo = connection.getRepository(Employee);
    const employeeCount = await employeeRepo.count({ where: { branch_id: id } });
    if (employeeCount > 0) {
      throw new ConflictException(
        `No se puede eliminar la sucursal "${branch.name}": tiene ${employeeCount} empleado(s) asignado(s). Reasígnalos primero.`,
      );
    }

    await repo.remove(branch);
    return { message: `Sucursal "${branch.name}" eliminada correctamente` };
  }
}
