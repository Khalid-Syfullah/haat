import type { MetadataRoute } from 'next';
import type { CategoryNode, ListResponse } from '@/lib/types';

const API_URL = process.env.API_URL || 'http://localhost:4000';
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

export const revalidate = 3600;

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, { next: { revalidate: 3600 } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/flash-sale`, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${SITE_URL}/vouchers`, changeFrequency: 'daily', priority: 0.5 },
  ];
  const tree = (await get<CategoryNode[]>('/categories')) ?? [];
  for (const c of tree.flatMap((t) => [t, ...t.children])) {
    entries.push({ url: `${SITE_URL}/category/${c.slug}`, changeFrequency: 'daily', priority: 0.7 });
  }
  for (let page = 1; page <= 20; page++) {
    const list = await get<ListResponse>(`/products?sort=newest&limit=60&page=${page}`);
    if (!list?.items.length) break;
    for (const p of list.items) entries.push({ url: `${SITE_URL}/product/${p.slug}`, changeFrequency: 'weekly', priority: 0.6 });
    if (page >= list.pages) break;
  }
  return entries;
}
