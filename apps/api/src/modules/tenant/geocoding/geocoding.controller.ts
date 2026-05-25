import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { GeocodingService } from './geocoding.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@ApiTags('Geocoding')
@Controller('geocoding')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Post('backfill')
  async backfill(@Req() req: Request) {
    const count = await this.geocodingService.backfillAll(req.tenantConnection!);
    return { message: `Geocoded ${count} addresses`, count };
  }
}
