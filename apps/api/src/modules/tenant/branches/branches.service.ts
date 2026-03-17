import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Branch, Employee } from '@nivo/database';

@Injectable()
export class BranchesService {
  async findAll(connection: DataSource) {
    const repo = connection.getRepository(Branch);
    return repo.find({ order: { created_at: 'DESC' } });
  }

  async findOne(connection: DataSource, id: string) {
    const repo = connection.getRepository(Branch);
    const branch = await repo.findOne({ where: { id } });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(connection: DataSource, data: { name: string; address?: string; phone?: string }) {
    const repo = connection.getRepository(Branch);
    const existing = await repo.findOne({ where: { name: data.name } });
    if (existing) throw new ConflictException('A branch with this name already exists');

    const branch = repo.create({
      name: data.name,
      address: data.address || null,
      phone: data.phone || null,
    });

    return repo.save(branch);
  }

  async update(connection: DataSource, id: string, data: { name?: string; address?: string; phone?: string }) {
    const repo = connection.getRepository(Branch);
    const branch = await repo.findOne({ where: { id } });
    if (!branch) throw new NotFoundException('Branch not found');

    if (data.name && data.name !== branch.name) {
      const duplicate = await repo.findOne({ where: { name: data.name } });
      if (duplicate) throw new ConflictException('A branch with this name already exists');
    }

    Object.assign(branch, data);
    return repo.save(branch);
  }

  async remove(connection: DataSource, id: string) {
    const repo = connection.getRepository(Branch);
    const branch = await repo.findOne({ where: { id } });
    if (!branch) throw new NotFoundException('Branch not found');

    const employeeRepo = connection.getRepository(Employee);
    const employeeCount = await employeeRepo.count({ where: { branch_id: id } });
    if (employeeCount > 0) {
      throw new ConflictException(
        `Cannot delete branch "${branch.name}": ${employeeCount} employee(s) are still assigned to it. Reassign them first.`,
      );
    }

    await repo.remove(branch);
    return { message: `Branch "${branch.name}" deleted successfully` };
  }
}
