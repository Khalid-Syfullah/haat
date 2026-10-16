import { UserCog } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Panel, Table, TableWrap, Td, Th } from '@/components/admin/bits';
import { AdminHeader } from '@/components/admin/shell';
import { AddStaffButton, PermissionInfo, StaffMember, StaffRowActions } from '@/components/admin/staff-manager';
import { Badge, EmptyState } from '@/components/ui';
import { relative } from '@/lib/format';
import { getMe, mustGet } from '@/lib/server';

export const metadata: Metadata = { title: 'Staff' };

export default async function StaffPage() {
  const [data, me] = await Promise.all([mustGet<{ items: StaffMember[]; permissions: PermissionInfo[] }>('/admin/staff'), getMe()]);
  const labelOf = new Map(data.permissions.map((p) => [p.key, p.label]));
  const owners = data.items.filter((m) => m.role === 'ADMIN').length;
  const staff = data.items.length - owners;

  return (
    <>
      <AdminHeader
        title="Staff"
        description="Owners can do everything. Staff only see the parts you tick."
        actions={<AddStaffButton permissions={data.permissions} />}
      />

      <Panel
        title="People with admin access"
        description={`${owners} owner${owners === 1 ? '' : 's'}, ${staff} staff`}
      >
        {data.items.length === 0 ? (
          <EmptyState
            icon={<UserCog className="size-10" />}
            title="No staff yet"
            body="People you give admin access to will appear here, with what they can do and when they last made a change."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Person</Th>
                  <Th>Role</Th>
                  <Th>Can do</Th>
                  <Th>Status</Th>
                  <Th>Last change</Th>
                  <Th align="right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((m) => {
                  const isMe = m.id === me.user?.id;
                  return (
                    <tr key={m.id} className={m.isActive ? 'hover:bg-paper/60' : 'bg-paper/60'}>
                      <Td className="min-w-52">
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-ink">{m.name}</span>
                          {isMe && <Badge>You</Badge>}
                        </span>
                        <span className="block text-xs text-ink-soft tabular-nums">{m.phone}</span>
                        {m.email && <span className="block text-xs text-ink-soft">{m.email}</span>}
                      </Td>
                      <Td>{m.role === 'ADMIN' ? <Badge tone="green">Owner</Badge> : <Badge tone="blue">Staff</Badge>}</Td>
                      <Td className="min-w-56">
                        {m.role === 'ADMIN' ? (
                          <span className="text-ink-soft">Everything</span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {m.effectivePermissions.map((p) => (
                              <Badge key={p}>{labelOf.get(p) ?? p}</Badge>
                            ))}
                          </span>
                        )}
                      </Td>
                      <Td>{m.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}</Td>
                      <Td className="whitespace-nowrap">
                        {m.lastActionAt ? (
                          <Link href={`/admin/audit-log?actorId=${m.id}`} className="group block">
                            <span className="block font-medium text-padma group-hover:underline">{relative(m.lastActionAt)}</span>
                            <span className="block text-xs text-ink-soft">
                              {m.actions} change{m.actions === 1 ? '' : 's'} in total
                            </span>
                          </Link>
                        ) : (
                          <span className="text-ink-faint">No changes yet</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <StaffRowActions member={m} permissions={data.permissions} isMe={isMe} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>
      <p className="mt-3 text-sm text-ink-soft">
        Removing access keeps the person&apos;s account as a normal customer. Every change made in the admin panel is listed in the{' '}
        <Link href="/admin/audit-log" className="font-medium text-padma hover:underline">
          audit log
        </Link>
        .
      </p>
    </>
  );
}
