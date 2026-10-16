import Link from 'next/link';
import clsx from 'clsx';

/** Wordmark: হাট set in Galada, with the Latin name for people who don't read Bangla. */
export function Logo({ light = true, className }: { light?: boolean; className?: string }) {
  return (
    <Link href="/" className={clsx('inline-flex items-end gap-1.5 leading-none', className)} aria-label="Haat home">
      <span className={clsx('font-brand text-[34px] leading-[0.8]', light ? 'text-marigold' : 'text-padma')}>হাট</span>
      <span className={clsx('pb-0.5 text-lg font-bold tracking-tight', light ? 'text-white' : 'text-ink')}>Haat</span>
    </Link>
  );
}
