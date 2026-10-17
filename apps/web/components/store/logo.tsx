import Link from 'next/link';
import clsx from 'clsx';

/** The Bangla wordmark, set in Galada. Used by the logo, the admin sidebar, invoices and the 404 page. */
export const BRAND_BN = 'টুকটাক বাজার';
export const BRAND_NAME = 'Tuktak Bazaar';

/** Wordmark: টুকটাক বাজার in Galada, with the Latin name for people who don't read Bangla (from tablet width up). */
export function Logo({ light = true, className }: { light?: boolean; className?: string }) {
  return (
    <Link href="/" className={clsx('inline-flex items-end gap-2 leading-none whitespace-nowrap', className)} aria-label={`${BRAND_NAME} home`}>
      <span className={clsx('font-brand text-[28px] leading-[0.85] sm:text-[30px]', light ? 'text-marigold' : 'text-padma')}>{BRAND_BN}</span>
      <span className={clsx('hidden pb-0.5 text-base font-bold tracking-tight sm:inline', light ? 'text-white' : 'text-ink')}>{BRAND_NAME}</span>
    </Link>
  );
}
