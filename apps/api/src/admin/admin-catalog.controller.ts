import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { MovementReason, Permission, Prisma, ProductStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AlertsService } from '../alerts/alerts.service';
import { CatalogService } from '../catalog/catalog.service';
import { Audit } from '../common/audit';
import { AuthUser, CurrentUser, Perm } from '../common/auth';
import { clamp, slugify, toBool, toInt, variantLabel } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';

class ImageDto {
  @IsString() url: string;
  @IsOptional() @IsString() alt?: string;
}

class SpecDto {
  @IsString() @MaxLength(60) name: string;
  @IsString() @MaxLength(200) value: string;
}

class VariantDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(2) @MaxLength(60) sku: string;
  @IsOptional() @IsObject() options?: Record<string, string>;
  @IsInt() @Min(1) price: number;
  @IsOptional() @IsInt() @Min(1) salePrice?: number | null;
  @IsInt() @Min(0) stock: number;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
  @IsOptional() @IsString() imageUrl?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class ProductDto {
  @IsString() @MinLength(3) @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(100) slug?: string;
  @IsOptional() @IsString() @MaxLength(20000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) highlights?: string[];
  @IsOptional() @IsString() brandId?: string | null;
  @IsString() categoryId: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true }) optionNames?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SpecDto) specs?: SpecDto[];
  @IsOptional() @IsString() @MaxLength(1000) keywords?: string;
  @IsOptional() @IsString() @MaxLength(100) warranty?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(60) returnDays?: number;
  @IsOptional() @IsInt() @Min(0) weightGrams?: number;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => ImageDto) images: ImageDto[];
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => VariantDto) variants: VariantDto[];
}

class CategoryDto {
  @IsString() @MinLength(2) @MaxLength(60) name: string;
  @IsOptional() @IsString() @MaxLength(60) nameBn?: string | null;
  @IsOptional() @IsString() @MaxLength(80) slug?: string;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsString() icon?: string | null;
  @IsOptional() @IsString() imageUrl?: string | null;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class BrandDto {
  @IsString() @MinLength(1) @MaxLength(60) name: string;
  @IsOptional() @IsString() @MaxLength(80) slug?: string;
  @IsOptional() @IsString() logoUrl?: string | null;
}

class AdjustDto {
  @IsInt() delta: number;
  @IsString() @MinLength(2) @MaxLength(200) note: string;
}

@Perm(Permission.CATALOG)
@Controller('admin')
export class AdminCatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly alerts: AlertsService,
  ) {}

  // ───── Products ─────

  @Get('products')
  async products(@Query() query: Record<string, string>) {
    const page = clamp(toInt(query.page, 1), 1, 1000);
    const limit = clamp(toInt(query.limit, 20), 1, 100);
    const where: Prisma.ProductWhereInput = {};
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: query.q, mode: 'insensitive' } } } },
      ];
    }
    if (query.status && query.status in ProductStatus) where.status = query.status as ProductStatus;
    if (query.categoryId) where.categoryId = { in: await this.catalog.descendantIds(query.categoryId) };
    if (toBool(query.lowStock)) {
      // Each variant has its own threshold, so compare columns in SQL.
      const rows = await this.prisma.$queryRaw<{ productId: string }[]>`
        SELECT DISTINCT "productId" FROM "ProductVariant" WHERE "isActive" AND stock <= "lowStockThreshold"`;
      where.id = { in: rows.map((r) => r.productId) };
    }
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          variants: { where: { isActive: true } },
          category: { select: { name: true } },
          brand: { select: { name: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      items: rows.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        image: p.images[0]?.url ?? null,
        category: p.category.name,
        brand: p.brand?.name ?? null,
        variants: p.variants.length,
        stock: p.variants.reduce((s, v) => s + v.stock, 0),
        minPrice: p.variants.length ? Math.min(...p.variants.map((v) => v.salePrice ?? v.price)) : 0,
        lowStock: p.variants.some((v) => v.stock <= v.lowStockThreshold),
        soldCount: p.soldCount,
        ratingAvg: p.ratingAvg,
        updatedAt: p.updatedAt,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  @Get('products/:id')
  async product(@Param('id') id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: 'asc' } }, variants: { orderBy: { createdAt: 'asc' } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  @Audit({ action: 'product.create', entity: 'product', summary: ({ result }) => `Created product ${result?.title ?? ''}` })
  @Post('products')
  async createProduct(@CurrentUser() user: AuthUser, @Body() dto: ProductDto) {
    if (!dto.variants.length) throw new BadRequestException('Add at least one variant (SKU)');
    const slug = await this.uniqueSlug('product', dto.slug || dto.title);
    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...this.productData(dto),
          slug,
          images: { create: dto.images.map((img, i) => ({ url: img.url, alt: img.alt, sortOrder: i })) },
        },
      });
      for (const v of dto.variants) {
        const variant = await tx.productVariant.create({ data: { ...this.variantData(v), productId: created.id, stock: v.stock } });
        if (v.stock > 0) {
          await tx.inventoryMovement.create({
            data: { variantId: variant.id, delta: v.stock, reason: MovementReason.RESTOCK, note: 'Opening stock', createdById: user.id },
          });
        }
      }
      return created;
    });
    return this.product(product.id);
  }

  @Audit({ action: 'product.update', entity: 'product', summary: ({ result }) => `Updated product ${result?.title ?? ''}` })
  @Put('products/:id')
  async updateProduct(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id }, include: { variants: true } });
    if (!existing) throw new NotFoundException('Product not found');
    if (!dto.variants.length) throw new BadRequestException('Keep at least one variant (SKU)');
    const slug = dto.slug && dto.slug !== existing.slug ? await this.uniqueSlug('product', dto.slug, id) : existing.slug;

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: { ...this.productData(dto), slug } });
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({ data: dto.images.map((img, i) => ({ productId: id, url: img.url, alt: img.alt, sortOrder: i })) });

      const keep = new Set<string>();
      for (const v of dto.variants) {
        const current = v.id ? existing.variants.find((ev) => ev.id === v.id) : undefined;
        if (current) {
          keep.add(current.id);
          await tx.productVariant.update({ where: { id: current.id }, data: { ...this.variantData(v), stock: v.stock } });
          const delta = v.stock - current.stock;
          if (delta !== 0) {
            await tx.inventoryMovement.create({
              data: { variantId: current.id, delta, reason: MovementReason.ADJUSTMENT, note: 'Edited on product form', createdById: user.id },
            });
          }
        } else {
          const created = await tx.productVariant.create({ data: { ...this.variantData(v), productId: id, stock: v.stock } });
          keep.add(created.id);
          if (v.stock > 0) {
            await tx.inventoryMovement.create({
              data: { variantId: created.id, delta: v.stock, reason: MovementReason.RESTOCK, note: 'Opening stock', createdById: user.id },
            });
          }
        }
      }
      // Variants removed from the form: delete if never ordered, otherwise deactivate.
      for (const old of existing.variants.filter((v) => !keep.has(v.id))) {
        const used = await tx.orderItem.count({ where: { variantId: old.id } });
        if (used) await tx.productVariant.update({ where: { id: old.id }, data: { isActive: false } });
        else await tx.productVariant.delete({ where: { id: old.id } });
      }
    });
    // Restocks and price cuts reach the customers waiting on them straight away
    void this.alerts.scan(existing.variants.map((v) => v.id)).catch(() => undefined);
    return this.product(id);
  }

  @Audit({ action: 'product.archive', entity: 'product', summary: () => 'Archived a product' })
  @Delete('products/:id')
  async archiveProduct(@Param('id') id: string) {
    await this.prisma.product.update({ where: { id }, data: { status: 'ARCHIVED' } });
    return { ok: true };
  }

  private productData(dto: ProductDto) {
    return {
      title: dto.title.trim(),
      description: dto.description ?? '',
      highlights: (dto.highlights ?? []).map((h) => h.trim()).filter(Boolean),
      brandId: dto.brandId || null,
      categoryId: dto.categoryId,
      status: dto.status ?? ProductStatus.ACTIVE,
      optionNames: (dto.optionNames ?? []).map((o) => o.trim()).filter(Boolean),
      specs: (dto.specs ?? []).filter((s) => s.name.trim() && s.value.trim()) as unknown as Prisma.InputJsonValue,
      keywords: dto.keywords?.trim() ?? '',
      warranty: dto.warranty?.trim() || null,
      returnDays: dto.returnDays ?? 7,
      weightGrams: dto.weightGrams ?? 500,
      isFeatured: dto.isFeatured ?? false,
    };
  }

  private variantData(v: VariantDto) {
    if (v.salePrice != null && v.salePrice >= v.price) throw new BadRequestException(`Sale price for ${v.sku} must be below its regular price`);
    return {
      sku: v.sku.trim().toUpperCase(),
      options: (v.options ?? {}) as Prisma.InputJsonValue,
      price: v.price,
      salePrice: v.salePrice ?? null,
      lowStockThreshold: v.lowStockThreshold ?? 5,
      imageUrl: v.imageUrl || null,
      isActive: v.isActive ?? true,
    };
  }

  private async uniqueSlug(kind: 'product' | 'category' | 'brand', input: string, exceptId?: string) {
    const base = slugify(input);
    for (let i = 0; i < 50; i++) {
      const slug = i === 0 ? base : `${base}-${i + 1}`;
      const where = { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) };
      const taken =
        kind === 'product'
          ? await this.prisma.product.findFirst({ where })
          : kind === 'category'
            ? await this.prisma.category.findFirst({ where })
            : await this.prisma.brand.findFirst({ where });
      if (!taken) return slug;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  // ───── Categories ─────

  @Get('categories')
  async categories() {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    return rows.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
  }

  @Post('categories')
  async createCategory(@Body() dto: CategoryDto) {
    const slug = await this.uniqueSlug('category', dto.slug || dto.name);
    const row = await this.prisma.category.create({ data: { ...dto, slug } });
    this.catalog.clearCategoryCache();
    return row;
  }

  @Patch('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() dto: CategoryDto) {
    if (dto.parentId === id) throw new BadRequestException('A category cannot be its own parent');
    if (dto.parentId && (await this.catalog.descendantIds(id)).includes(dto.parentId)) {
      throw new BadRequestException('A category cannot sit under its own sub-category');
    }
    const slug = dto.slug ? await this.uniqueSlug('category', dto.slug, id) : undefined;
    const row = await this.prisma.category.update({ where: { id }, data: { ...dto, slug } });
    this.catalog.clearCategoryCache();
    return row;
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    const [products, children] = await Promise.all([
      this.prisma.product.count({ where: { categoryId: id } }),
      this.prisma.category.count({ where: { parentId: id } }),
    ]);
    if (products || children) throw new BadRequestException('Move its products and sub-categories first, or hide it instead');
    await this.prisma.category.delete({ where: { id } });
    this.catalog.clearCategoryCache();
    return { ok: true };
  }

  // ───── Brands ─────

  @Get('brands')
  async brands() {
    const rows = await this.prisma.brand.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } });
    return rows.map(({ _count, ...b }) => ({ ...b, productCount: _count.products }));
  }

  @Post('brands')
  async createBrand(@Body() dto: BrandDto) {
    const slug = await this.uniqueSlug('brand', dto.slug || dto.name);
    return this.prisma.brand.create({ data: { name: dto.name.trim(), slug, logoUrl: dto.logoUrl || null } });
  }

  @Patch('brands/:id')
  async updateBrand(@Param('id') id: string, @Body() dto: BrandDto) {
    const slug = dto.slug ? await this.uniqueSlug('brand', dto.slug, id) : undefined;
    return this.prisma.brand.update({ where: { id }, data: { name: dto.name.trim(), slug, logoUrl: dto.logoUrl || null } });
  }

  @Delete('brands/:id')
  async deleteBrand(@Param('id') id: string) {
    await this.prisma.brand.delete({ where: { id } });
    return { ok: true };
  }

  // ───── Inventory ─────

  @Get('inventory')
  async inventory(@Query() query: Record<string, string>) {
    const page = clamp(toInt(query.page, 1), 1, 1000);
    const where: Prisma.ProductVariantWhereInput = { isActive: true, product: { status: { not: 'ARCHIVED' } } };
    if (query.q) {
      where.OR = [
        { sku: { contains: query.q, mode: 'insensitive' } },
        { product: { title: { contains: query.q, mode: 'insensitive' } } },
      ];
    }
    let rows = await this.prisma.productVariant.findMany({
      where,
      include: { product: { select: { id: true, title: true, slug: true, images: { take: 1, orderBy: { sortOrder: 'asc' } } } } },
      orderBy: [{ stock: 'asc' }, { sku: 'asc' }],
    });
    if (toBool(query.lowOnly)) rows = rows.filter((v) => v.stock <= v.lowStockThreshold);
    const total = rows.length;
    const items = rows.slice((page - 1) * 50, page * 50).map((v) => ({
      id: v.id,
      sku: v.sku,
      label: variantLabel(v.options),
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
      low: v.stock <= v.lowStockThreshold,
      price: v.salePrice ?? v.price,
      product: { id: v.product.id, title: v.product.title, slug: v.product.slug, image: v.product.images[0]?.url ?? null },
    }));
    return { items, total, page, pages: Math.max(1, Math.ceil(total / 50)) };
  }

  @Audit({
    action: 'inventory.adjust',
    entity: 'variant',
    summary: ({ body, result }) => `Stock ${body.delta > 0 ? '+' : ''}${body.delta} (now ${result?.stock}): ${body.note}`,
  })
  @Post('inventory/:variantId/adjust')
  async adjust(@CurrentUser() user: AuthUser, @Param('variantId') variantId: string, @Body() dto: AdjustDto) {
    if (dto.delta === 0) throw new BadRequestException('Change the stock by at least 1');
    const result = await this.prisma.$transaction(async (tx) => {
      const where = dto.delta < 0 ? { id: variantId, stock: { gte: -dto.delta } } : { id: variantId };
      const res = await tx.productVariant.updateMany({ where, data: { stock: { increment: dto.delta } } });
      if (res.count !== 1) throw new BadRequestException('Stock cannot go below zero');
      await tx.inventoryMovement.create({
        data: {
          variantId,
          delta: dto.delta,
          reason: dto.delta > 0 ? MovementReason.RESTOCK : MovementReason.ADJUSTMENT,
          note: dto.note.trim(),
          createdById: user.id,
        },
      });
      return tx.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { id: true, stock: true } });
    });
    if (dto.delta > 0) void this.alerts.scan([variantId]).catch(() => undefined);
    return result;
  }

  @Get('inventory/:variantId/movements')
  movements(@Param('variantId') variantId: string) {
    return this.prisma.inventoryMovement.findMany({ where: { variantId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
}
