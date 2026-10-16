import { History, Info, MessageSquareText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { areaLabel, AuditDetails, RecordLink } from '@/components/admin/audit-details';
import { AuditDateRange } from '@/components/admin/audit-filters';
import { flatParams, hrefWith, LinkTabs, Panel, Table, TableWrap, Td, Th } from '@/components/admin/bits';
import { FilterSelect, SearchBox, Toolbar, UrlPagination } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { Badge, EmptyState } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { mustGet } from '@/lib/server';

export const metadata: Metadata = { title: 'Audit log' };

interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  summary: string;
  method: string | null;
  path: string | null;
  data: unknown;
  ip: string | null;
  createdAt: string;
}

interface AuditPage {
  items: AuditEntry[];
  total: number;
  page: number;
  pages: number;
  entities: { entity: string; count: number }[];
  actors: { id: string; name: string; count: number }[];
}

interface SmsEntry {
  id: string;
  phone: string;
  body: string;
  kind: string;
  provider: string;
  status: 'sent' | 'failed' | 'logged';
  error: string | null;
  providerRef: string | null;
  userId: string | null;
  createdAt: string;
}

interface SmsPage {
  items: SmsEntry[];
  total: number;
  page: number;
  pages: number;
  provider: 'console' | 'sslwireless';
}

const SMS_KIND: Record<string, string> = {
  otp: 'Login code',
  alert: 'Price or stock alert',
  cart: 'Cart reminder',
  ticket: 'Support reply',
};

const ACTIVITY_KEYS = ['q', 'actorId', 'entity', 'entityId', 'from', 'to', 'page'] as const;
const SMS_KEYS = ['q', 'kind', 'page'] as const;

function pick(sp: Record<string, string>, keys: readonly string[]) {
  const out: Record<string, string> = {};
  for (const k of keys) if (sp[k]) out[k] = sp[k];
  return out;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = flatParams(await searchParams);
  const tab = sp.tab === 'sms' ? 'sms' : 'activity';

  return (
    <>
      <AdminHeader title="Audit log" description="Who changed what in the admin panel, and every text message the store sent." />
      <LinkTabs
        label="Audit log sections"
        active={tab}
        tabs={[
          { key: 'activity', label: 'Activity', href: '/admin/audit-log' },
          { key: 'sms', label: 'Text messages', href: hrefWith('/admin/audit-log', {}, { tab: 'sms' }) },
        ]}
      />
      {tab === 'sms' ? <SmsTab sp={sp} /> : <ActivityTab sp={sp} />}
    </>
  );
}

async function ActivityTab({ sp }: { sp: Record<string, string> }) {
  const query = pick(sp, ACTIVITY_KEYS);
  const data = await mustGet<AuditPage>(`/admin/audit-log?${new URLSearchParams(query)}`);
  const filtered = Boolean(sp.q || sp.actorId || sp.entity || sp.entityId || sp.from || sp.to);

  // A renamed person shows up once per name; list them once.
  const people = new Map<string, { name: string; count: number }>();
  for (const a of data.actors) {
    const cur = people.get(a.id);
    people.set(a.id, cur ? { name: cur.name, count: cur.count + a.count } : { name: a.name, count: a.count });
  }

  return (
    <>
      <Toolbar>
        <SearchBox placeholder="Search what changed or who did it" label="Search activity" />
        <FilterSelect
          param="actorId"
          label="Person"
          allLabel="Everyone"
          options={[...people].map(([id, p]) => ({ value: id, label: `${p.name} (${p.count})` }))}
        />
        <FilterSelect
          param="entity"
          label="Area"
          allLabel="All areas"
          options={data.entities
            .map((e) => ({ value: e.entity, label: `${areaLabel(e.entity)} (${e.count})` }))
            .sort((a, b) => a.label.localeCompare(b.label))}
        />
        <AuditDateRange />
      </Toolbar>

      <p className="mb-2 text-sm text-ink-soft" aria-live="polite">
        {plural(data.total, 'change')}
        {filtered ? ' match' : ' so far'}
        {sp.entityId && (
          <>
            {' '}
            to one record.{' '}
            <Link href={hrefWith('/admin/audit-log', query, { entityId: null, page: null })} className="font-medium text-padma hover:underline">
              Show every record
            </Link>
          </>
        )}
      </p>

      <Panel>
        {data.items.length === 0 ? (
          <EmptyState
            icon={<History className="size-10" />}
            title={filtered ? 'Nothing matches these filters' : 'No activity yet'}
            body={
              filtered
                ? 'Try another person, area or date range, or clear the search.'
                : 'Changes owners and staff make in the admin panel, like confirming orders or editing products, will appear here.'
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Person</Th>
                  <Th>What happened</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.id} className="hover:bg-paper/60">
                    <Td className="align-top! whitespace-nowrap text-ink-soft tabular-nums">{dateTime(e.createdAt)}</Td>
                    <Td className="min-w-40 align-top!">
                      <span className="block font-medium whitespace-nowrap text-ink">{e.actorName ?? 'System'}</span>
                      {e.actorRole && <span className="block text-xs text-ink-soft">{e.actorRole === 'ADMIN' ? 'Owner' : 'Staff'}</span>}
                    </Td>
                    <Td className="min-w-72 align-top!">
                      <p className="break-words text-ink">{e.summary}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
                        <span>{areaLabel(e.entity)}</span>
                        <RecordLink entity={e.entity} entityId={e.entityId} />
                      </p>
                      <AuditDetails data={e.data} method={e.method} path={e.path} ip={e.ip} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>
      <div className="mt-4">
        <UrlPagination page={data.page} pages={data.pages} />
      </div>
    </>
  );
}

function SmsStatus({ status }: { status: SmsEntry['status'] }) {
  if (status === 'sent') return <Badge tone="green">Sent</Badge>;
  if (status === 'failed') return <Badge tone="red">Failed</Badge>;
  return <Badge>Not sent (test mode)</Badge>;
}

async function SmsTab({ sp }: { sp: Record<string, string> }) {
  const query = pick(sp, SMS_KEYS);
  const data = await mustGet<SmsPage>(`/admin/sms-log?${new URLSearchParams(query)}`);
  const filtered = Boolean(sp.q || sp.kind);

  return (
    <>
      {data.provider === 'console' && (
        <div className="mb-4 flex gap-2.5 rounded-[6px] border border-marigold/40 bg-marigold-tint px-4 py-3 text-sm text-ink" role="note">
          <Info className="mt-0.5 size-4 shrink-0 text-marigold-dark" aria-hidden />
          <p>Text messages are in test mode. They are written to the server log instead of being sent. Add SSL Wireless details on the server to send them.</p>
        </div>
      )}

      <Toolbar>
        <SearchBox placeholder="Phone number" label="Search by phone number" />
        <FilterSelect param="kind" label="Type" allLabel="All types" options={Object.entries(SMS_KIND).map(([value, label]) => ({ value, label }))} />
      </Toolbar>

      <p className="mb-2 text-sm text-ink-soft" aria-live="polite">
        {plural(data.total, 'message')}
        {filtered ? ' match' : ' so far'}
      </p>

      <Panel>
        {data.items.length === 0 ? (
          <EmptyState
            icon={<MessageSquareText className="size-10" />}
            title={filtered ? 'No messages match' : 'No text messages yet'}
            body={
              filtered
                ? 'Check the number, or search by its last few digits.'
                : 'Login codes, price and stock alerts, cart reminders and support replies sent to customers will appear here.'
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Phone</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((m) => (
                  <tr key={m.id} className="hover:bg-paper/60">
                    <Td className="align-top! whitespace-nowrap text-ink-soft tabular-nums">{dateTime(m.createdAt)}</Td>
                    <Td className="align-top! whitespace-nowrap tabular-nums">{m.phone}</Td>
                    <Td className="align-top! whitespace-nowrap">
                      <Badge tone={m.kind === 'otp' ? 'blue' : 'neutral'}>{SMS_KIND[m.kind] ?? m.kind}</Badge>
                    </Td>
                    <Td className="min-w-32 align-top!">
                      <span className="whitespace-nowrap">
                        <SmsStatus status={m.status} />
                      </span>
                      {m.status === 'failed' && m.error && <span className="mt-1 block max-w-56 text-xs break-words text-sindoor">{m.error}</span>}
                    </Td>
                    <Td className="min-w-72 align-top!">
                      <p className="max-w-xl break-words whitespace-pre-wrap text-ink">{m.body}</p>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>
      <div className="mt-4">
        <UrlPagination page={data.page} pages={data.pages} />
      </div>
    </>
  );
}
