import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';

const imageStorage = (subdir: string) => ({
  storage: diskStorage({
    destination: `./uploads/${subdir}`,
    filename: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, name: string) => void) => {
      cb(null, randomUUID() + extname(file.originalname).toLowerCase());
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, ok: boolean) => void) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imagenes'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

@ApiTags('Uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantUploadsController {
  @Post('image')
  @UseInterceptors(FileInterceptor('file', imageStorage('images')))
  uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibio ningun archivo');
    return { url: `/uploads/images/${file.filename}` };
  }

  @Post('logo')
  @UseInterceptors(FileInterceptor('file', imageStorage('logos')))
  uploadLogo(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibio ningun archivo');
    return { url: `/uploads/logos/${file.filename}` };
  }
}
