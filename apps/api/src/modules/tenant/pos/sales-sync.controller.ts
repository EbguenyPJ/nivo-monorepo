import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PosService } from './pos.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@ApiTags('Sales Sync')
@Controller('sales')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SalesSyncController {
  constructor(private readonly posService: PosService) {}

  @Post('sync')
  async syncOfflineSales(@Req() req: Request, @Body() body: { sales: any[] }) {
    const results = [];
    for (const sale of body.sales) {
      try {
        const result = await this.posService.createSale(req.tenantConnection!, req.user as any, sale);
        results.push({ id: sale.id, status: 'synced', sale: result });
      } catch (error: any) {
        results.push({ id: sale.id, status: 'error', message: error.message });
      }
    }
    return { synced: results.filter((r) => r.status === 'synced').length, total: body.sales.length, results };
  }

  @Post('refund')
  async refund(@Req() req: Request, @Body() body: { sale_id: string; reason: string }) {
    const connection = req.tenantConnection!;
    const saleRepo = connection.getRepository('Sale');
    const sale = await saleRepo.findOne({ where: { id: body.sale_id } });
    if (!sale) throw new Error('Sale not found');

    (sale as any).status = 'refunded';
    (sale as any).notes = `Refunded: ${body.reason}`;
    return saleRepo.save(sale);
  }
}
