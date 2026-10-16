/** Server-safe pieces for the support ticket pages (no hooks). */
import { Badge } from '@/components/ui';
import type { Tone } from './bits';

export type TicketStatus = 'OPEN' | 'PENDING' | 'RESOLVED';
export type TicketPriority = 'NORMAL' | 'HIGH';

export const TICKET_STATUSES: TicketStatus[] = ['OPEN', 'PENDING', 'RESOLVED'];

/** What staff call each status. */
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Needs reply',
  PENDING: 'Waiting on customer',
  RESOLVED: 'Resolved',
};

const TICKET_TONE: Record<TicketStatus, Tone> = { OPEN: 'amber', PENDING: 'blue', RESOLVED: 'green' };

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge tone={TICKET_TONE[status] ?? 'neutral'}>{TICKET_STATUS_LABEL[status] ?? status}</Badge>;
}

export function UrgentBadge() {
  return <Badge tone="red">Urgent</Badge>;
}

/** "45 min", "26 h", "3 days": how long the customer has been waiting. */
export function waitFor(since: string, now = Date.now()) {
  const min = Math.max(0, Math.round((now - new Date(since).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}

export interface TicketListItem {
  id: string;
  ticketNo: string;
  subject: string;
  category: string;
  categoryLabel: string;
  status: TicketStatus;
  priority: TicketPriority;
  customer: { name: string; phone: string };
  assignee: { id: string; name: string } | null;
  order: { id: string; orderNo: string } | null;
  messages: number;
  lastFromStaff: boolean;
  preview: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface TicketList {
  items: TicketListItem[];
  total: number;
  page: number;
  pages: number;
  counts: Partial<Record<TicketStatus, number>>;
  mineOpen: number;
  categories: { value: string; label: string }[];
}

export interface TicketMessage {
  id: string;
  authorId: string;
  fromStaff: boolean;
  body: string;
  images: string[];
  createdAt: string;
  author: { id: string; name: string };
}

export interface TicketDetail {
  id: string;
  ticketNo: string;
  subject: string;
  category: string;
  categoryLabel: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  resolvedAt: string | null;
  lastMessageAt: string;
  user: { id: string; name: string; phone: string; email: string | null; createdAt: string; codBlocked: boolean };
  assignee: { id: string; name: string } | null;
  order: {
    id: string;
    orderNo: string;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    total: number;
    createdAt: string;
    courier: string | null;
    trackingNo: string | null;
  } | null;
  messages: TicketMessage[];
  otherTickets: { id: string; ticketNo: string; subject: string; status: TicketStatus; createdAt: string }[];
  recentOrders: { id: string; orderNo: string; status: string; total: number; createdAt: string }[];
  staff: { id: string; name: string; role: 'ADMIN' | 'STAFF' }[];
}
