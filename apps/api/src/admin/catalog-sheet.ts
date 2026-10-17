import { BadRequestException } from '@nestjs/common';
import { MovementReason, Prisma, ProductStatus } from '@prisma/client';
import ExcelJS from 'exceljs';
import { slugify, variantLabel } from '../common/utils';
import { Db, PrismaService } from '../prisma/prisma.service';

/** Columns of the Products sheet, in order. Headers are matched case-insensitively on import. */
export const COLUMNS = [
  { key: 'handle', header: 'Product handle', width: 30, note: 'Groups the rows of one product. Same as the slug in the product URL. Required for new products.' },
  { key: 'title', header: 'Title', width: 40, note: 'Product title. Required for new products.' },
  { key: 'category', header: 'Category', width: 20, note: 'Category slug or name, e.g. "smartphones". Required for new products.' },
  { key: 'brand', header: 'Brand', width: 16, note: 'Brand name. A new name creates the brand.' },
  { key: 'status', header: 'Status', width: 10, note: 'ACTIVE, DRAFT or ARCHIVED.' },
  { key: 'opt1Name', header: 'Option 1 name', width: 14, note: 'e.g. Color' },
  { key: 'opt1Value', header: 'Option 1 value', width: 14, note: 'e.g. Black' },
  { key: 'opt2Name', header: 'Option 2 name', width: 14, note: '' },
  { key: 'opt2Value', header: 'Option 2 value', width: 14, note: '' },
  { key: 'opt3Name', header: 'Option 3 name', width: 14, note: '' },
  { key: 'opt3Value', header: 'Option 3 value', width: 14, note: '' },
  { key: 'sku', header: 'SKU', width: 18, note: 'Required on every row. An existing SKU updates that variant; a new one adds a variant.' },
  { key: 'price', header: 'Price', width: 10, note: 'Regular price in taka. Required for new variants.' },
  { key: 'salePrice', header: 'Sale price', width: 10, note: 'Must be below Price. Write "none" to remove a sale price.' },
  { key: 'stock', header: 'Stock', width: 8, note: 'Units on hand. The change is recorded in the stock movement log.' },
  { key: 'lowStock', header: 'Low stock alert', width: 10, note: 'Warn when stock is at or below this.' },
  { key: 'active', header: 'Variant active', width: 10, note: 'yes or no' },
  { key: 'weight', header: 'Weight (g)', width: 10, note: 'Shipping weight per unit, in grams.' },
  { key: 'warranty', header: 'Warranty', width: 18, note: 'e.g. 1 year brand warranty' },
  { key: 'returnDays', header: 'Return days', width: 10, note: '0 to 60. 0 means no returns.' },
  { key: 'highlights', header: 'Highlights', width: 40, note: 'Separate with |' },
  { key: 'keywords', header: 'Search keywords', width: 30, note: 'Bangla and Banglish names, misspellings.' },
  { key: 'description', header: 'Description', width: 50, note: '' },
  { key: 'images', header: 'Image URLs', width: 50, note: 'Separate with |. https:// links or /uploads/... paths. Replaces the product images.' },
] as const;

type Key = (typeof COLUMNS)[number]['key'];
type Row = Partial<Record<Key, string>> & { rowNumber: number };

const HEADER_TO_KEY = new Map<string, Key>(COLUMNS.map((c) => [c.header.toLowerCase(), c.key]));
const PRODUCT_FIELDS: Key[] = ['title', 'category', 'brand', 'status', 'weight', 'warranty', 'returnDays', 'highlights', 'keywords', 'description', 'images'];

export interface SheetIssue {
  row: number;
  sku?: string;
  message: string;
}

export interface SheetChange {
  row: number;
  sku: string;
  product: string;
  action: 'create' | 'update' | 'unchanged';
  details: string[];
}

export interface ImportPlan {
  rows: number;
  errors: SheetIssue[];
  changes: SheetChange[];
  summary: { newProducts: number; updatedProducts: number; newVariants: number; updatedVariants: number; unchanged: number; stockChanges: number; newBrands: string[] };
}

// ───────────────────────── Export ─────────────────────────

function styleHeader(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B6E4F' } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}

function instructions(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet('How to fill');
  ws.columns = [
    { header: 'Column', key: 'c', width: 22 },
    { header: 'What to put in it', key: 'n', width: 100 },
  ];
  for (const c of COLUMNS) ws.addRow({ c: c.header, n: c.note });
  ws.addRow({});
  ws.addRow({ c: 'Empty cells', n: 'An empty cell leaves that value unchanged on existing products and variants.' });
  ws.addRow({ c: 'One row per variant', n: 'Repeat the product handle on each variant row. Product columns can be filled on just the first row.' });
  ws.addRow({ c: 'Nothing is lost', n: 'Upload shows a preview first. Nothing changes until you confirm, and a file with any error changes nothing.' });
  styleHeader(ws);
}

export async function exportWorkbook(prisma: PrismaService): Promise<Buffer> {
  const products = await prisma.product.findMany({
    orderBy: [{ category: { name: 'asc' } }, { title: 'asc' }],
    include: {
      category: { select: { slug: true } },
      brand: { select: { name: true } },
      images: { orderBy: { sortOrder: 'asc' } },
      variants: { orderBy: { createdAt: 'asc' } },
    },
  });
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Tuktak Bazaar';
  const ws = wb.addWorksheet('Products');
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  for (const p of products) {
    p.variants.forEach((v, i) => {
      const opts = (v.options ?? {}) as Record<string, string>;
      const names = p.optionNames.length ? p.optionNames : Object.keys(opts);
      const first = i === 0;
      ws.addRow({
        handle: p.slug,
        title: first ? p.title : '',
        category: first ? p.category.slug : '',
        brand: first ? (p.brand?.name ?? '') : '',
        status: first ? p.status : '',
        opt1Name: names[0] ?? '',
        opt1Value: names[0] ? (opts[names[0]] ?? '') : '',
        opt2Name: names[1] ?? '',
        opt2Value: names[1] ? (opts[names[1]] ?? '') : '',
        opt3Name: names[2] ?? '',
        opt3Value: names[2] ? (opts[names[2]] ?? '') : '',
        sku: v.sku,
        price: v.price,
        salePrice: v.salePrice ?? '',
        stock: v.stock,
        lowStock: v.lowStockThreshold,
        active: v.isActive ? 'yes' : 'no',
        weight: first ? p.weightGrams : '',
        warranty: first ? (p.warranty ?? '') : '',
        returnDays: first ? p.returnDays : '',
        highlights: first ? p.highlights.join(' | ') : '',
        keywords: first ? p.keywords : '',
        description: first ? p.description : '',
        images: first ? p.images.map((im) => im.url).join(' | ') : '',
      });
    });
  }
  styleHeader(ws);
  instructions(wb);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function templateWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Tuktak Bazaar';
  const ws = wb.addWorksheet('Products');
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  const base = {
    handle: 'aarong-cotton-panjabi',
    category: 'mens-fashion',
    brand: 'Aarong',
    status: 'ACTIVE',
    opt1Name: 'Size',
    lowStock: 3,
    active: 'yes',
  };
  ws.addRow({
    ...base,
    title: 'Cotton Panjabi',
    opt1Value: 'M',
    sku: 'PANJ-COT-M',
    price: 2200,
    salePrice: 1890,
    stock: 12,
    weight: 400,
    warranty: '',
    returnDays: 7,
    highlights: '100% cotton | Hand-finished embroidery',
    keywords: 'panjabi পাঞ্জাবি punjabi',
    description: 'Breathable cotton panjabi for Eid and everyday wear.',
    images: 'https://example.com/panjabi-front.jpg | https://example.com/panjabi-back.jpg',
  });
  ws.addRow({ ...base, opt1Value: 'L', sku: 'PANJ-COT-L', price: 2200, salePrice: 1890, stock: 8 });
  styleHeader(ws);
  instructions(wb);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ───────────────────────── Import ─────────────────────────

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value as unknown;
  if (v == null) return '';
  if (typeof v === 'object') {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (o.richText) return o.richText.map((t) => t.text).join('').trim();
    if (o.text !== undefined) return String(o.text).trim();
    if (o.result !== undefined) return String(o.result).trim();
    if (v instanceof Date) return v.toISOString();
  }
  return String(v).trim();
}

export async function readSheet(buffer: Buffer): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new BadRequestException('That file is not an Excel workbook (.xlsx). Download the template and fill it in.');
  }
  const ws = wb.getWorksheet('Products') ?? wb.worksheets[0];
  if (!ws) throw new BadRequestException('The workbook has no sheets');
  const keys: (Key | undefined)[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    keys[col] = HEADER_TO_KEY.get(cellText(cell).toLowerCase());
  });
  if (!keys.includes('sku')) throw new BadRequestException('The first row must hold the column headers, including "SKU". Start from the template.');
  const rows: Row[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const out: Row = { rowNumber: n };
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = keys[col];
      if (key) out[key] = cellText(cell);
    });
    if (Object.keys(out).some((k) => k !== 'rowNumber' && out[k as Key])) rows.push(out);
  });
  if (rows.length > 5000) throw new BadRequestException('Import up to 5,000 rows at a time');
  return rows;
}

const toIntCell = (s: string | undefined) => (s === undefined || s === '' ? undefined : Number(s.replace(/[,৳\s]/g, '')));
const splitList = (s?: string) => (s ? s.split('|').map((x) => x.trim()).filter(Boolean) : undefined);

/** Works out what an import would change. Nothing is written. */
export async function planImport(db: Db, rows: Row[]) {
  const errors: SheetIssue[] = [];
  const err = (row: Row, message: string) => errors.push({ row: row.rowNumber, sku: row.sku, message });

  // Per-row validation
  const seen = new Map<string, number>();
  for (const row of rows) {
    if (!row.sku) {
      err(row, 'SKU is empty');
      continue;
    }
    row.sku = row.sku.toUpperCase().replace(/\s+/g, '');
    if (row.sku.length < 2 || row.sku.length > 60) err(row, 'SKU must be 2 to 60 characters');
    if (seen.has(row.sku)) err(row, `SKU ${row.sku} is also on row ${seen.get(row.sku)}`);
    seen.set(row.sku, row.rowNumber);
    for (const [key, label, min] of [
      ['price', 'Price', 1],
      ['stock', 'Stock', 0],
      ['lowStock', 'Low stock alert', 0],
      ['weight', 'Weight', 0],
      ['returnDays', 'Return days', 0],
    ] as const) {
      const n = toIntCell(row[key]);
      if (n !== undefined && (!Number.isInteger(n) || n < min)) err(row, `${label} must be a whole number of at least ${min}`);
    }
    if (toIntCell(row.returnDays) !== undefined && Number(row.returnDays) > 60) err(row, 'Return days can be at most 60');
    if (row.salePrice && row.salePrice.toLowerCase() !== 'none') {
      const n = toIntCell(row.salePrice);
      if (n === undefined || !Number.isInteger(n) || n < 1) err(row, 'Sale price must be a whole number, or "none"');
    }
    if (row.status && !(row.status.toUpperCase() in ProductStatus)) err(row, 'Status must be ACTIVE, DRAFT or ARCHIVED');
    if (row.active && !/^(yes|no|true|false|1|0|y|n)$/i.test(row.active)) err(row, 'Variant active must be yes or no');
    for (const url of splitList(row.images) ?? []) {
      if (!/^(https?:\/\/|\/uploads\/)/i.test(url)) err(row, `Image "${url.slice(0, 40)}" must be an https:// link or an /uploads/ path`);
    }
  }

  const skus = rows.map((r) => r.sku).filter((s): s is string => !!s);
  const handles = [...new Set(rows.map((r) => r.handle).filter((h): h is string => !!h))];
  const variants = await db.productVariant.findMany({
    where: { sku: { in: skus } },
    include: { product: { select: { id: true, slug: true, title: true, optionNames: true } } },
  });
  // Products named by a handle, plus the products of SKUs listed without one
  const slugs = [...new Set([...handles, ...variants.map((v) => v.product.slug)])];
  const [productsByHandle, categories, brands] = await Promise.all([
    db.product.findMany({
      where: { slug: { in: slugs } },
      include: { images: { orderBy: { sortOrder: 'asc' } }, brand: true, variants: { select: { sku: true } } },
    }),
    db.category.findMany({ select: { id: true, slug: true, name: true } }),
    db.brand.findMany({ select: { id: true, name: true } }),
  ]);
  const variantBySku = new Map(variants.map((v) => [v.sku, v]));
  const productBySlug = new Map(productsByHandle.map((p) => [p.slug, p]));
  const findCategory = (s: string) => categories.find((c) => c.slug === s.toLowerCase() || c.name.toLowerCase() === s.toLowerCase());
  const brandNames = new Map(brands.map((b) => [b.name.toLowerCase(), b]));

  // Group rows by product
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    if (!row.sku) continue;
    const existing = variantBySku.get(row.sku);
    if (existing && row.handle && existing.product.slug !== row.handle) {
      err(row, `SKU ${row.sku} belongs to "${existing.product.title}" (${existing.product.slug}), not ${row.handle}`);
      continue;
    }
    const key = row.handle || existing?.product.slug;
    if (!key) {
      err(row, 'New SKU: add a product handle so we know which product it belongs to');
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const changes: SheetChange[] = [];
  const newBrands = new Set<string>();
  const summary = { newProducts: 0, updatedProducts: 0, newVariants: 0, updatedVariants: 0, unchanged: 0, stockChanges: 0, newBrands: [] as string[] };
  const plans: GroupPlan[] = [];

  for (const [handle, group] of groups) {
    const firstOf = (key: Key) => group.find((r) => r[key])?.[key];
    const fields: Partial<Record<Key, string>> = {};
    for (const key of PRODUCT_FIELDS) {
      const v = firstOf(key);
      if (v !== undefined) fields[key] = v;
    }
    const optionNames = [firstOf('opt1Name'), firstOf('opt2Name'), firstOf('opt3Name')].filter((x): x is string => !!x);
    let categoryId: string | undefined;
    if (fields.category) {
      const cat = findCategory(fields.category);
      if (!cat) {
        err(group[0], `Category "${fields.category}" doesn't exist. Use a category slug from Admin → Categories.`);
        continue;
      }
      categoryId = cat.id;
    }
    if (fields.brand && !brandNames.has(fields.brand.toLowerCase())) newBrands.add(fields.brand);

    const existingProduct = productBySlug.get(handle);
    const productDetails: string[] = [];
    if (!existingProduct) {
      if (!fields.title) err(group[0], `New product ${handle}: Title is required`);
      if (!categoryId) err(group[0], `New product ${handle}: Category is required`);
    } else {
      if (fields.title && fields.title !== existingProduct.title) productDetails.push(`title → ${fields.title}`);
      if (fields.status && fields.status.toUpperCase() !== existingProduct.status) productDetails.push(`status → ${fields.status.toUpperCase()}`);
      if (categoryId && categoryId !== existingProduct.categoryId) productDetails.push(`category → ${fields.category}`);
      if (fields.brand && fields.brand.toLowerCase() !== (existingProduct.brand?.name ?? '').toLowerCase()) productDetails.push(`brand → ${fields.brand}`);
      if (fields.images && splitList(fields.images)!.join('|') !== existingProduct.images.map((i) => i.url).join('|')) productDetails.push('images replaced');
      if (fields.description !== undefined && fields.description !== existingProduct.description) productDetails.push('description');
      if (optionNames.length && existingProduct.optionNames.length && optionNames.join('|') !== existingProduct.optionNames.join('|')) {
        err(group[0], `${handle} uses options ${existingProduct.optionNames.join(', ')}; the file says ${optionNames.join(', ')}`);
        continue;
      }
    }
    // An existing product without options gets them: every one of its SKUs needs values, or the
    // ones left out could never be picked in the store.
    const addsOptions = !!existingProduct && !existingProduct.optionNames.length && optionNames.length > 0;
    if (addsOptions && existingProduct) {
      const inFile = new Set(group.map((r) => r.sku));
      const missing = existingProduct.variants.map((v) => v.sku).filter((sku) => !inFile.has(sku));
      if (missing.length) {
        err(group[0], `To add ${optionNames.join(', ')} to ${handle}, list all its SKUs with their option values (missing: ${missing.join(', ')})`);
        continue;
      }
      productDetails.push(`options → ${optionNames.join(', ')}`);
    }
    const names = optionNames.length ? optionNames : (existingProduct?.optionNames ?? []);

    const variantPlans: VariantPlan[] = [];
    for (const row of group) {
      const v = variantBySku.get(row.sku!);
      const values = [row.opt1Value, row.opt2Value, row.opt3Value];
      const options: Record<string, string> = {};
      names.forEach((n, i) => {
        if (values[i]) options[n] = values[i]!;
      });
      const price = toIntCell(row.price);
      const salePrice = row.salePrice ? (row.salePrice.toLowerCase() === 'none' ? null : toIntCell(row.salePrice)) : undefined;
      const stock = toIntCell(row.stock);
      const low = toIntCell(row.lowStock);
      const active = row.active ? /^(yes|true|1|y)$/i.test(row.active) : undefined;
      const details: string[] = [];
      if (!v) {
        if (price === undefined) err(row, 'New variant: Price is required');
        if (names.length && Object.keys(options).length !== names.length) err(row, `New variant: fill in ${names.join(', ')}`);
        const effPrice = price ?? 0;
        if (salePrice != null && salePrice >= effPrice) err(row, 'Sale price must be below Price');
        variantPlans.push({ row, sku: row.sku!, create: { price: effPrice, salePrice: salePrice ?? null, stock: stock ?? 0, low: low ?? 5, active: active ?? true, options } });
        changes.push({ row: row.rowNumber, sku: row.sku!, product: fields.title ?? existingProduct?.title ?? handle, action: 'create', details: [`price ৳${effPrice}`, `stock ${stock ?? 0}`] });
        summary.newVariants++;
        if ((stock ?? 0) > 0) summary.stockChanges++;
        continue;
      }
      if (addsOptions && Object.keys(options).length !== names.length) err(row, `Fill in ${names.join(', ')} for ${row.sku}`);
      const nextPrice = price ?? v.price;
      const nextSale = salePrice === undefined ? v.salePrice : salePrice;
      if (nextSale != null && nextSale >= nextPrice) err(row, `Sale price ৳${nextSale} must be below price ৳${nextPrice}`);
      if (price !== undefined && price !== v.price) details.push(`price ৳${v.price} → ৳${price}`);
      if (salePrice !== undefined && salePrice !== v.salePrice) details.push(salePrice === null ? 'sale price removed' : `sale ${v.salePrice ? `৳${v.salePrice}` : 'none'} → ৳${salePrice}`);
      if (stock !== undefined && stock !== v.stock) details.push(`stock ${v.stock} → ${stock}`);
      if (low !== undefined && low !== v.lowStockThreshold) details.push(`low-stock alert ${v.lowStockThreshold} → ${low}`);
      if (active !== undefined && active !== v.isActive) details.push(active ? 'activated' : 'deactivated');
      const optLabel = variantLabel(options);
      if (Object.keys(options).length && optLabel !== variantLabel(v.options)) details.push(`options → ${optLabel}`);
      const changed = details.length > 0;
      variantPlans.push({
        row,
        sku: row.sku!,
        id: v.id,
        oldStock: v.stock,
        update: changed
          ? { price, salePrice, stock, low, active, options: Object.keys(options).length ? options : undefined }
          : undefined,
      });
      changes.push({ row: row.rowNumber, sku: row.sku!, product: v.product.title, action: changed || productDetails.length ? 'update' : 'unchanged', details: [...details, ...(row === group[0] ? productDetails : [])] });
      if (changed) summary.updatedVariants++;
      else if (!productDetails.length || row !== group[0]) summary.unchanged++;
      if (stock !== undefined && stock !== v.stock) summary.stockChanges++;
    }
    if (!existingProduct) summary.newProducts++;
    else if (productDetails.length) summary.updatedProducts++;
    plans.push({ handle, productId: existingProduct?.id, fields, categoryId, optionNames: names, addsOptions, variants: variantPlans });
  }
  summary.newBrands = [...newBrands];
  errors.sort((a, b) => a.row - b.row);
  const plan: ImportPlan = { rows: rows.length, errors, changes: changes.sort((a, b) => a.row - b.row), summary };
  return { plan, groups: plans };
}

interface VariantPlan {
  row: Row;
  sku: string;
  id?: string;
  oldStock?: number;
  create?: { price: number; salePrice: number | null; stock: number; low: number; active: boolean; options: Record<string, string> };
  update?: { price?: number; salePrice?: number | null; stock?: number; low?: number; active?: boolean; options?: Record<string, string> };
}

interface GroupPlan {
  handle: string;
  productId?: string;
  fields: Partial<Record<Key, string>>;
  categoryId?: string;
  optionNames: string[];
  /** An existing product that had no options gets these option names. */
  addsOptions: boolean;
  variants: VariantPlan[];
}

/** Applies a plan with no errors in one transaction. Returns the ids of variants whose price or stock moved. */
export async function applyImport(prisma: PrismaService, groups: GroupPlan[], userId: string) {
  const touched: string[] = [];
  await prisma.$transaction(
    async (tx) => {
      const brandId = async (name?: string) => {
        if (!name) return undefined;
        const found = await tx.brand.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
        if (found) return found.id;
        let slug = slugify(name);
        if (await tx.brand.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
        return (await tx.brand.create({ data: { name, slug } })).id;
      };
      for (const g of groups) {
        const f = g.fields;
        const productData: Prisma.ProductUncheckedUpdateInput = {};
        if (f.title) productData.title = f.title;
        if (g.categoryId) productData.categoryId = g.categoryId;
        if (f.brand) productData.brandId = await brandId(f.brand);
        if (f.status) productData.status = f.status.toUpperCase() as ProductStatus;
        if (f.weight) productData.weightGrams = Number(f.weight);
        if (f.warranty !== undefined) productData.warranty = f.warranty || null;
        if (f.returnDays) productData.returnDays = Number(f.returnDays);
        if (f.highlights) productData.highlights = splitList(f.highlights);
        if (f.keywords !== undefined) productData.keywords = f.keywords;
        if (f.description !== undefined) productData.description = f.description;
        if (g.addsOptions) productData.optionNames = g.optionNames;
        let productId = g.productId;
        if (!productId) {
          let slug = slugify(g.handle);
          if (await tx.product.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
          const created = await tx.product.create({
            data: {
              ...(productData as Prisma.ProductUncheckedCreateInput),
              title: f.title!,
              slug,
              categoryId: g.categoryId!,
              optionNames: g.optionNames,
            },
          });
          productId = created.id;
        } else if (Object.keys(productData).length) {
          await tx.product.update({ where: { id: productId }, data: productData });
        }
        if (f.images) {
          await tx.productImage.deleteMany({ where: { productId } });
          await tx.productImage.createMany({ data: splitList(f.images)!.map((url, i) => ({ productId: productId!, url, sortOrder: i })) });
        }
        for (const v of g.variants) {
          if (v.create) {
            const c = v.create;
            const variant = await tx.productVariant.create({
              data: { productId, sku: v.sku, price: c.price, salePrice: c.salePrice, stock: c.stock, lowStockThreshold: c.low, isActive: c.active, options: c.options },
            });
            if (c.stock > 0) {
              await tx.inventoryMovement.create({ data: { variantId: variant.id, delta: c.stock, reason: MovementReason.RESTOCK, note: 'Excel import', createdById: userId } });
            }
            touched.push(variant.id);
          } else if (v.update && v.id) {
            const u = v.update;
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                price: u.price,
                salePrice: u.salePrice,
                stock: u.stock,
                lowStockThreshold: u.low,
                isActive: u.active,
                options: u.options,
              },
            });
            if (u.stock !== undefined && u.stock !== v.oldStock) {
              await tx.inventoryMovement.create({
                data: { variantId: v.id, delta: u.stock - (v.oldStock ?? 0), reason: MovementReason.ADJUSTMENT, note: 'Excel import', createdById: userId },
              });
            }
            touched.push(v.id);
          }
        }
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  return touched;
}
