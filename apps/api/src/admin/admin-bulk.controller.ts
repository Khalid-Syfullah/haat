import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MovementReason, Permission, Prisma } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AlertsService } from '../alerts/alerts.service';
import { Audit, SkipAudit } from '../common/audit';
import { AuthUser, CurrentUser, Perm } from '../common/auth';
import { dhakaDay, toBool } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { applyImport, exportWorkbook, planImport, readSheet, templateWorkbook } from './catalog-sheet';

const ACTIONS = ['stock_set', 'stock_add', 'price_set', 'price_change_pct', 'sale_set', 'sale_pct_off', 'sale_clear', 'activate', 'deactivate'] as const;
type BulkAction = (typeof ACTIONS)[number];

class BulkDto {
  @IsArray() @ArrayMaxSize(1000) @IsString({ each: true }) variantIds: string[];
  @IsIn(ACTIONS) action: BulkAction;
  @IsOptional() @IsInt() value?: number;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) note?: string;
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Perm(Permission.CATALOG)
@Controller('admin')
export class AdminBulkController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  @Audit({ action: 'catalog.export', entity: 'catalog', summary: () => 'Downloaded the catalog as Excel' })
  @Get('catalog/export')
  async export(@Res() res: Response) {
    const buf = await exportWorkbook(this.prisma);
    res.setHeader('Content-Type', XLSX);
    res.setHeader('Content-Disposition', `attachment; filename="haat-catalog-${dhakaDay()}.xlsx"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  }

  @Get('catalog/template')
  async template(@Res() res: Response) {
    const buf = await templateWorkbook();
    res.setHeader('Content-Type', XLSX);
    res.setHeader('Content-Disposition', 'attachment; filename="haat-catalog-template.xlsx"');
    res.send(buf);
  }

  /** Upload an .xlsx. Without ?apply=true it only previews; with it, a file with no errors is applied. */
  @SkipAudit()
  @HttpCode(200)
  @Post('catalog/import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  async import(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File | undefined, @Query('apply') apply?: string) {
    if (!file) throw new BadRequestException('Choose an .xlsx file to upload');
    const rows = await readSheet(file.buffer);
    if (!rows.length) throw new BadRequestException('The sheet has no product rows under the header');
    const { plan, groups } = await planImport(this.prisma, rows);
    if (!toBool(apply)) return { applied: false, ...plan };
    if (plan.errors.length) throw new BadRequestException({ message: `Fix the ${plan.errors.length} problem(s) in the file first. Nothing was changed.`, ...plan });
    const touched = await applyImport(this.prisma, groups, user.id);
    await this.recordImport(user, file.originalname, plan.summary);
    void this.alerts.scan(touched).catch(() => undefined);
    return { applied: true, ...plan };
  }

  /** The import endpoint skips the generic audit row (previews change nothing), so applied imports are logged here. */
  private async recordImport(user: AuthUser, filename: string, s: { newProducts: number; updatedProducts: number; newVariants: number; updatedVariants: number; stockChanges: number }) {
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'catalog.import',
        entity: 'catalog',
        summary: `Imported ${filename}: ${s.newProducts} new and ${s.updatedProducts} changed products, ${s.newVariants} new and ${s.updatedVariants} changed SKUs, ${s.stockChanges} stock changes`,
        method: 'POST',
        path: '/api/admin/catalog/import',
        data: { filename, ...s },
      },
    });
  }

  /** One change applied to many variants at once, all or nothing. */
  @Audit({
    action: 'inventory.bulk',
    entity: 'inventory',
    summary: ({ body, result }) => `Bulk ${String(body.action).replace(/_/g, ' ')}${body.value !== undefined ? ` ${body.value}` : ''} on ${result?.updated ?? 0} SKU(s)`,
  })
  @HttpCode(200)
  @Post('inventory/bulk')
  async bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkDto) {
    const ids = [...new Set(dto.variantIds)];
    if (!ids.length) throw new BadRequestException('Select at least one SKU');
    const needsValue: BulkAction[] = ['stock_set', 'stock_add', 'price_set', 'price_change_pct', 'sale_set', 'sale_pct_off'];
    const value = dto.value;
    if (needsValue.includes(dto.action) && (value === undefined || value === null)) throw new BadRequestException('Enter a value');
    if (dto.action === 'stock_set' && value! < 0) throw new BadRequestException('Stock cannot be negative');
    if ((dto.action === 'price_set' || dto.action === 'sale_set') && value! < 1) throw new BadRequestException('Prices start at ৳1');
    if (dto.action === 'price_change_pct' && (value! < -90 || value! > 500 || value === 0)) throw new BadRequestException('Change prices by -90% to +500%');
    if (dto.action === 'sale_pct_off' && (value! < 1 || value! > 90)) throw new BadRequestException('Discount must be 1% to 90%');
    if ((dto.action === 'stock_set' || dto.action === 'stock_add') && !dto.note?.trim()) throw new BadRequestException('Add a note saying why stock changed');

    const touched: string[] = [];
    const updated = await this.prisma.$transaction(
      async (tx) => {
        const variants = await tx.productVariant.findMany({ where: { id: { in: ids } }, include: { product: { select: { title: true } } } });
        if (variants.length !== ids.length) throw new BadRequestException('Some selected SKUs no longer exist. Refresh and try again.');
        for (const v of variants) {
          const data: Prisma.ProductVariantUpdateInput = {};
          let delta = 0;
          switch (dto.action) {
            case 'stock_set':
              delta = value! - v.stock;
              data.stock = value!;
              break;
            case 'stock_add':
              if (v.stock + value! < 0) throw new BadRequestException(`${v.sku} has only ${v.stock} in stock`);
              delta = value!;
              data.stock = { increment: value! };
              break;
            case 'price_set':
              if (v.salePrice != null && v.salePrice >= value!) throw new BadRequestException(`${v.sku}: the new price must stay above its sale price ৳${v.salePrice}`);
              data.price = value!;
              break;
            case 'price_change_pct': {
              const next = Math.max(1, Math.round((v.price * (100 + value!)) / 100));
              if (v.salePrice != null && v.salePrice >= next) throw new BadRequestException(`${v.sku}: ৳${next} would not be above its sale price ৳${v.salePrice}. Clear the sale price first.`);
              data.price = next;
              break;
            }
            case 'sale_set':
              if (value! >= v.price) throw new BadRequestException(`${v.sku}: sale price must be below ৳${v.price}`);
              data.salePrice = value!;
              break;
            case 'sale_pct_off':
              data.salePrice = Math.max(1, Math.round((v.price * (100 - value!)) / 100));
              break;
            case 'sale_clear':
              data.salePrice = null;
              break;
            case 'activate':
              data.isActive = true;
              break;
            case 'deactivate':
              data.isActive = false;
              break;
          }
          await tx.productVariant.update({ where: { id: v.id }, data });
          if (delta !== 0) {
            await tx.inventoryMovement.create({
              data: { variantId: v.id, delta, reason: delta > 0 ? MovementReason.RESTOCK : MovementReason.ADJUSTMENT, note: dto.note!.trim(), createdById: user.id },
            });
          }
          touched.push(v.id);
        }
        return variants.length;
      },
      { timeout: 60_000 },
    );
    void this.alerts.scan(touched).catch(() => undefined);
    return { updated };
  }
}
