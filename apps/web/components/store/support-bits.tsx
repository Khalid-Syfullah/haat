/** Server-safe pieces shared by the customer help pages. */
import { Badge } from '../ui';

export type TicketStatus = 'OPEN' | 'PENDING' | 'RESOLVED';

export const SUPPORT_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Waiting for us',
  PENDING: 'We replied',
  RESOLVED: 'Resolved',
};

export function SupportStatusBadge({ status }: { status: TicketStatus }) {
  const tone = status === 'PENDING' ? 'green' : status === 'OPEN' ? 'amber' : 'neutral';
  return <Badge tone={tone}>{SUPPORT_STATUS_LABEL[status] ?? status}</Badge>;
}

export interface SupportTicketSummary {
  ticketNo: string;
  subject: string;
  category: string;
  categoryLabel: string;
  status: TicketStatus;
  orderNo: string | null;
  lastMessageAt: string;
  createdAt: string;
  last: { body: string; fromStaff: boolean; createdAt: string } | null;
}

export interface SupportMessage {
  id: string;
  fromStaff: boolean;
  author: string;
  body: string;
  images: string[];
  createdAt: string;
}

export interface SupportTicketDetail {
  ticketNo: string;
  subject: string;
  category: string;
  categoryLabel: string;
  status: TicketStatus;
  order: { orderNo: string; status: string; total: number; createdAt: string } | null;
  createdAt: string;
  resolvedAt: string | null;
  messages: SupportMessage[];
}
