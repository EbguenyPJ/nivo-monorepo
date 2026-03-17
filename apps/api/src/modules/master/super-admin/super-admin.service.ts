import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SuperAdmin } from '@nivo/database';

@Injectable()
export class SuperAdminService {
  constructor(
    @InjectRepository(SuperAdmin)
    private readonly superAdminRepo: Repository<SuperAdmin>,
  ) {}

  async findAll() {
    const admins = await this.superAdminRepo.find();
    return admins.map(({ password_hash, ...admin }) => admin);
  }

  async create(data: { email: string; password: string; role?: string }) {
    const existing = await this.superAdminRepo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const admin = this.superAdminRepo.create({
      email: data.email,
      password_hash: passwordHash,
      role: data.role || 'super-admin',
    });

    const saved = await this.superAdminRepo.save(admin);
    const { password_hash, ...result } = saved;
    return result;
  }
}
