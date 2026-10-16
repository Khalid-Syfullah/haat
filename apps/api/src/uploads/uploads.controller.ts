import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomBytes } from 'crypto';
import { diskStorage } from 'multer';
import { extname, resolve } from 'path';

const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/svg+xml', '.svg'],
]);

/**
 * Stores images on local disk under UPLOAD_DIR, served at /uploads.
 * Swap diskStorage for an S3 storage engine in production.
 */
@Controller('uploads')
export class UploadsController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, resolve(process.env.UPLOAD_DIR || './uploads')),
        filename: (_req, file, cb) => {
          const ext = ALLOWED.get(file.mimetype) ?? (extname(file.originalname).toLowerCase() || '.bin');
          cb(null, `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}${ext}`);
        },
      }),
      limits: { fileSize: 3 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, cb) => {
        // SVG can carry scripts, so only raster images from customers; admins upload via the same route.
        const ok = ALLOWED.has(file.mimetype) && file.mimetype !== 'image/svg+xml';
        cb(ok ? null : new BadRequestException('Upload a JPG, PNG, WEBP or GIF image under 3 MB'), ok);
      },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file received');
    return { url: `/uploads/${file.filename}`, size: file.size };
  }
}
