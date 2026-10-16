/**
 * Server-safe pieces of the audit log (no hooks): area names, record links and the
 * "Details" disclosure that shows what was sent with a change.
 */
import Link from 'next/link';

const AREA: Record<string, string> = {
  order: 'Orders',
  product: 'Products',
  staff: 'Staff',
  ticket: 'Support tickets',
  settings: 'Settings',
  setting: 'Settings',
  variant: 'Inventory',
  inventory: 'Inventory, bulk changes',
  shipment: 'Couriers',
  catalog: 'Excel import',
  customer: 'Customers',
  review: 'Reviews',
  question: 'Questions',
  return: 'Returns',
  voucher: 'Vouchers',
  flash_sale: 'Flash sales',
  banner: 'Banners',
  category: 'Categories',
  brand: 'Brands',
  job: 'Background jobs',
};

/** Friendly name for an audit entity; unknown ones are tidied up rather than hidden. */
export function areaLabel(entity: string | null | undefined): string {
  if (!entity) return 'Other';
  if (AREA[entity]) return AREA[entity];
  const words = entity.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const RECORD_LINK: Record<string, { path: string; label: string }> = {
  order: { path: '/admin/orders', label: 'Open order' },
  product: { path: '/admin/products', label: 'Open product' },
  ticket: { path: '/admin/tickets', label: 'Open ticket' },
};

export function recordLink(entity: string | null, entityId: string | null): { href: string; label: string } | null {
  const target = entity ? RECORD_LINK[entity] : undefined;
  if (!target || !entityId) return null;
  return { href: `${target.path}/${encodeURIComponent(entityId)}`, label: target.label };
}

/** "variantIds" → "Variant ids", "free_shipping" → "Free shipping". */
function keyLabel(key: string) {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function Value({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="text-ink-faint">empty</span>;
  if (value === '[hidden]') return <span className="text-ink-faint">hidden</span>;
  if (typeof value === 'boolean') return <>{value ? 'Yes' : 'No'}</>;
  if (typeof value === 'number') return <span className="tabular-nums">{value}</span>;
  if (typeof value === 'string') return <span className="break-words whitespace-pre-wrap">{value}</span>;
  if (Array.isArray(value) && value.every((v) => v === null || ['string', 'number', 'boolean'].includes(typeof v))) {
    return value.length ? <span className="break-words">{value.join(', ')}</span> : <span className="text-ink-faint">none</span>;
  }
  return <pre className="overflow-x-auto rounded bg-paper px-2 py-1.5 font-mono text-xs leading-relaxed text-ink">{JSON.stringify(value, null, 2)}</pre>;
}

export function AuditDetails({ data, method, path, ip }: { data: unknown; method: string | null; path: string | null; ip: string | null }) {
  const entries = isPlainObject(data) ? Object.entries(data) : null;
  const empty = data === null || data === undefined || (entries !== null && entries.length === 0) || (Array.isArray(data) && data.length === 0);

  return (
    <details className="group mt-1">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-ink-soft select-none hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
        Details
      </summary>
      <div className="mt-2 max-w-2xl rounded-md border border-line bg-white px-3 py-2">
        {empty ? (
          <p className="text-sm text-ink-soft">No form details were sent with this change.</p>
        ) : entries ? (
          <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
            {entries.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-soft">{keyLabel(k)}</dt>
                <dd className="min-w-0 text-ink">
                  <Value value={v} />
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <Value value={data} />
        )}
        {(method || path || ip) && (
          <p className="mt-2 border-t border-line pt-1.5 font-mono text-[11px] break-all text-ink-faint">
            {[method, path].filter(Boolean).join(' ')}
            {ip ? ` · ${ip}` : ''}
          </p>
        )}
      </div>
    </details>
  );
}

/** Link to the record a change was made to, when there is a page for it. */
export function RecordLink({ entity, entityId }: { entity: string | null; entityId: string | null }) {
  const link = recordLink(entity, entityId);
  if (!link) return null;
  return (
    <Link href={link.href} className="font-medium text-padma hover:underline">
      {link.label}
    </Link>
  );
}
