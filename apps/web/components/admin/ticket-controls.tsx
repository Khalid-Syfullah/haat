'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { patch } from '@/lib/api';
import { Switch } from './controls';
import { TICKET_STATUSES, TICKET_STATUS_LABEL, TicketDetail, TicketPriority, TicketStatus } from './ticket-bits';
import { useAction } from './use-action';

const selectCls =
  'h-10 w-full rounded-md border border-line bg-white pr-8 pl-3 text-[15px] text-ink focus:border-padma focus:ring-2 focus:ring-padma/20 focus:outline-none disabled:bg-paper';

/**
 * Status, priority and assignee. Each change shows at once, then takes the server's answer;
 * changes made elsewhere (a reply sets the status) arrive through the props.
 */
export function TicketControls({
  id,
  status,
  priority,
  assigneeId,
  staff,
  meId,
}: {
  id: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  staff: TicketDetail['staff'];
  meId: string | null;
}) {
  const { run, busy } = useAction();
  const [s, setS] = useState(status);
  const [urgent, setUrgent] = useState(priority === 'HIGH');
  const [assignee, setAssignee] = useState(assigneeId ?? '');
  useEffect(() => setS(status), [status]);
  useEffect(() => setUrgent(priority === 'HIGH'), [priority]);
  useEffect(() => setAssignee(assigneeId ?? ''), [assigneeId]);
  const canTakeIt = !!meId && assignee !== meId && staff.some((p) => p.id === meId);

  const update = async (key: string, body: Record<string, unknown>, success: string, rollback: () => void) => {
    const fresh = await run(key, () => patch<TicketDetail>(`/admin/tickets/${id}`, body), success);
    if (!fresh) return rollback();
    setS(fresh.status);
    setUrgent(fresh.priority === 'HIGH');
    setAssignee(fresh.assignee?.id ?? '');
  };

  const assign = (next: string) => {
    const prev = assignee;
    setAssignee(next);
    const who = staff.find((p) => p.id === next)?.name;
    update('assignee', { assigneeId: next || null }, next ? (next === meId ? 'Assigned to you' : `Assigned to ${who}`) : 'Ticket unassigned', () => setAssignee(prev));
  };

  return (
    <div className="space-y-4 text-sm">
      <label className="block">
        <span className="mb-1 block font-medium text-ink">Status</span>
        <select
          className={selectCls}
          value={s}
          disabled={!!busy}
          onChange={(e) => {
            const next = e.target.value as TicketStatus;
            const prev = s;
            setS(next);
            update('status', { status: next }, `Marked as ${TICKET_STATUS_LABEL[next].toLowerCase()}`, () => setS(prev));
          }}
        >
          {TICKET_STATUSES.map((v) => (
            <option key={v} value={v}>
              {TICKET_STATUS_LABEL[v]}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="mb-1 block font-medium text-ink">Assigned to</span>
        <div className="flex gap-2">
          <select aria-label="Assigned to" className={selectCls} value={assignee} disabled={!!busy} onChange={(e) => assign(e.target.value)}>
            <option value="">Unassigned</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.id === meId ? ' (you)' : p.role === 'ADMIN' ? ' (owner)' : ''}
              </option>
            ))}
          </select>
          {canTakeIt && (
            <Button type="button" variant="outline" className="shrink-0" onClick={() => assign(meId!)} disabled={!!busy}>
              Take it
            </Button>
          )}
        </div>
      </div>

      <div>
        <Switch
          checked={urgent}
          tone="red"
          disabled={!!busy}
          label="Urgent"
          onChange={(v) => {
            setUrgent(v);
            update('priority', { priority: v ? 'HIGH' : 'NORMAL' }, v ? 'Marked as urgent' : 'Priority set to normal', () => setUrgent(!v));
          }}
        />
        <p className="mt-1 text-xs text-ink-soft">Urgent tickets go to the top of the queue. Order, delivery and payment problems on an order start as urgent.</p>
      </div>
    </div>
  );
}
