'use client';

import { FlaskConical, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError, post } from '@/lib/api';
import { PAYMENT_LABEL, tk } from '@/lib/format';
import { useToast } from '../providers';
import { Button, Spinner } from '../ui';
import { Countdown } from './countdown';

interface Session {
  orderNo: string;
  amount: number;
  method: string;
  status: string;
  expiresAt: string | null;
}

/**
 * Stand-in for the SSLCommerz hosted page while PAYMENT_PROVIDER=mock.
 * It talks to the same markPaid path the real gateway callback uses.
 */
export function MockGateway({ session }: { session: string }) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'success' | 'fail' | null>(null);

  useEffect(() => {
    api<Session>(`/payments/mock/${session}`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Payment session not found'));
  }, [session]);

  async function finish(outcome: 'success' | 'fail') {
    setBusy(outcome);
    try {
      const res = await post<{ orderNo: string }>(`/payments/mock/${session}/complete`, { outcome });
      router.push(`/account/orders/${res.orderNo}?payment=${outcome === 'success' ? 'success' : 'failed'}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Payment failed', 'error');
      setBusy(null);
    }
  }

  if (error) return <p className="rounded-md bg-sindoor-tint p-4 text-sindoor">{error}</p>;
  if (!data) return <Spinner className="mx-auto size-8" />;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex items-center gap-2 bg-ink px-5 py-3 text-sm text-white">
        <Lock className="size-4" /> Secure payment
        <span className="ml-auto flex items-center gap-1 rounded bg-marigold px-2 py-0.5 text-xs font-bold text-ink">
          <FlaskConical className="size-3.5" /> Test mode
        </span>
      </div>
      <div className="p-6 text-center">
        <p className="text-ink-soft">Order {data.orderNo}</p>
        <p className="mt-1 text-4xl font-bold">{tk(data.amount)}</p>
        <p className="mt-1 font-semibold">{PAYMENT_LABEL[data.method] ?? data.method}</p>
        {data.status === 'PAID' ? (
          <p className="mt-6 rounded-md bg-padma-tint p-3 text-padma-dark">This payment is already complete.</p>
        ) : (
          <>
            {data.expiresAt && (
              <p className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-soft">
                Complete within <Countdown to={data.expiresAt} />
              </p>
            )}
            <div className="mt-6 space-y-2">
              <Button size="lg" block onClick={() => finish('success')} loading={busy === 'success'} disabled={!!busy}>
                Pay {tk(data.amount)}
              </Button>
              <Button size="lg" block variant="outline" onClick={() => finish('fail')} loading={busy === 'fail'} disabled={!!busy}>
                Simulate a failed payment
              </Button>
            </div>
          </>
        )}
        <p className="mt-6 text-xs text-ink-faint">
          This page replaces the SSLCommerz checkout during development. Set PAYMENT_PROVIDER=sslcommerz with sandbox credentials to use the real gateway.
        </p>
      </div>
    </div>
  );
}
