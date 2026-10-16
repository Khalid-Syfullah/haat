import { ShieldOff } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Panel } from '@/components/admin/bits';
import { EmptyState } from '@/components/ui';

export const metadata: Metadata = { title: 'No access' };

export default function NoAccess() {
  return (
    <Panel>
      <EmptyState
        icon={<ShieldOff className="size-10" />}
        title="Your account can't open this page"
        body="This part of the admin panel needs a permission your staff account doesn't have. Ask a store owner to add it under Staff."
        action={
          <Link href="/admin" className="inline-flex h-10 items-center rounded-md bg-padma px-4 text-[15px] font-semibold text-white hover:bg-padma-dark">
            Back to the dashboard
          </Link>
        }
      />
    </Panel>
  );
}
