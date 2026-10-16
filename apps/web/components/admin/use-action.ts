'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useToast } from '@/components/providers';
import { ApiError } from '@/lib/api';

/**
 * Runs one mutation at a time: tracks which action is busy, toasts the result,
 * shows the API's own message on failure and refreshes server data on success.
 */
export function useAction() {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async <T>(key: string, fn: () => Promise<T>, success?: string, opts: { refresh?: boolean } = {}): Promise<T | undefined> => {
      setBusy(key);
      try {
        const out = await fn();
        if (success) toast(success, 'success');
        if (opts.refresh !== false) router.refresh();
        return out;
      } catch (e) {
        toast(e instanceof ApiError ? e.message : 'Something went wrong. Try again.', 'error');
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [router, toast],
  );

  return { run, busy };
}
