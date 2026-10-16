'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, del } from '@/lib/api';
import { useToast } from '../providers';
import { Button } from '../ui';

export function AlertRemoveButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={busy}
      aria-label={`Remove the alert for ${title}`}
      onClick={async () => {
        setBusy(true);
        try {
          await del(`/alerts/${id}`);
          toast('Alert removed');
          router.refresh();
        } catch (e) {
          toast(e instanceof ApiError ? e.message : 'Could not remove the alert', 'error');
          setBusy(false);
        }
      }}
    >
      Remove
    </Button>
  );
}
