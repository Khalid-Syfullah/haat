'use client';

import { Archive } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/providers';
import { Button } from '@/components/ui';
import { del } from '@/lib/api';
import { ConfirmDialog } from './common';
import { errorMessage } from './utils';

export function ArchiveProductButton({ id, title, onDone, size = 'sm' }: { id: string; title: string; onDone?: () => void; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <Button type="button" variant={size === 'md' ? 'outline' : 'ghost'} size={size} onClick={() => setOpen(true)}>
        <Archive className="size-4" aria-hidden />
        Archive
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Archive product"
        body={
          <>
            <span className="font-semibold text-ink">{title}</span> will be hidden from the store. Past orders keep their records. You can set it back to active from the
            editor.
          </>
        }
        confirmLabel="Archive product"
        onConfirm={async () => {
          try {
            await del(`/admin/products/${id}`);
            toast('Product archived');
            setOpen(false);
            if (onDone) onDone();
            else router.refresh();
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        }}
      />
    </>
  );
}
