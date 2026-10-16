import type { Metadata } from 'next';
import { Listing } from '@/components/store/listing';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: typeof q === 'string' && q ? `${q}` : 'All products' };
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  return (
    <Listing
      params={params}
      heading={<h1 className="text-2xl font-bold">{q ? <>Results for “{q}”</> : 'All products'}</h1>}
      subheading={q ? ' in Bangla, Banglish and English' : undefined}
    />
  );
}
