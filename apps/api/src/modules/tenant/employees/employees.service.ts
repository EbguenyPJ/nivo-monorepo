import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Employee } from '@nivo/database';

@Injectable()
export class EmployeesService {
  async findAll(connection: DataSource) {
    const repo = connection.getRepository(Employee);
    const employees = await repo.find({ relations: ['branch'] });
    return employees.map(({ password_hash, ...emp }) => emp);
  }

  async findOne(connection: DataSource, id: string) {
    const repo = connection.getRepository(Employee);
    const employee = await repo.findOne({ where: { id }, relations: ['branch'] });
    if (!employee) throw new NotFoundException('Employee not found');
    const { password_hash, ...result } = employee;
    return result;
  }

  async create(connection: DataSource, data: any) {
    const repo = connection.getRepository(Employee);
    const existing = await repo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const employee = repo.create({
      name: data.name,
      email: data.email,
      password_hash: passwordHash,
      pin_code: data.pin_code,
      role: data.role || 'cashier',
      branch_id: data.branch_id,
      is_active: true,
    });

    const saved = await repo.save(employee);
    const { password_hash, ...result } = saved;
    return result;
  }

  async update(connection: DataSource, id: string, data: any) {
    const repo = connection.getRepository(Employee);
    const employee = await repo.findOne({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');

    if (data.password) {
      data.password_hash = await bcrypt.hash(data.password, 12);
      delete data.password;
    }

    Object.assign(employee, data);
    const saved = await repo.save(employee);
    const { password_hash, ...result } = saved;
    return result;
  }
}
