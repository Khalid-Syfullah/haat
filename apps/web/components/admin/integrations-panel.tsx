'use client';

import clsx from 'clsx';
import { Check, Copy, Play } from 'lucide-react';
import { ReactNode, useRef, useState } from 'react';
import { useToast } from '@/components/providers';
import { Badge, Button } from '@/components/ui';
import { post } from '@/lib/api';
import { Panel } from './bits';
import { useAction } from './use-action';

export interface SystemStatus {
  jobsEnabled: boolean;
  jobs: { name: string; label: string; schedule: string }[];
  sms: { provider: 'console' | 'sslwireless'; live: boolean };
  payments: { provider: 'mock' | 'sslcommerz' };
  couriers: {
    code: string;
    name: string;
    configured: boolean;
    missing: string[];
    locationKind: string | null;
    test: boolean;
    webhookUrl: string;
  }[];
}

const COUNT_WORD: Record<string, string> = {
  sent: 'sent',
  cancelled: 'cancelled',
  fixed: 'fixed',
  checked: 'checked',
  changed: 'changed',
  repaired: 'orders brought up to date',
};

/** { checked: 3, changed: 1 } → "3 checked, 1 changed". */
function describe(result: Record<string, unknown> | undefined): string {
  if (!result) return 'Done';
  if (result.skipped) return 'Already running, so this run was skipped. Try again in a minute.';
  const parts = Object.entries(result)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => `${v} ${COUNT_WORD[k] ?? k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}`);
  return parts.length ? `Done: ${parts.join(', ')}` : 'Done';
}

function StatusRow({ title, badge, children }: { title: string; badge: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex shrink-0 items-center gap-2 sm:w-48">
        <span className="font-medium text-ink">{title}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div>{badge}</div>
        <p className="mt-1 text-sm text-ink-soft">{children}</p>
      </div>
    </div>
  );
}

function CopyField({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  const box = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard access (plain http): select the text so it can be copied by hand.
      if (box.current) window.getSelection()?.selectAllChildren(box.current);
      toast('Copy the selected link by hand', 'error');
    }
  };

  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <code ref={box} aria-label={label} className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1.5 font-mono text-xs leading-snug break-all text-ink">
        {value}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
        {copied ? <Check className="size-4 text-padma" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

export function IntegrationsPanel({ system }: { system: SystemStatus }) {
  const { run, busy } = useAction();
  const toast = useToast();
  const [results, setResults] = useState<Record<string, string>>({});

  const runJob = async (name: string) => {
    // useAction shows the API's message if the run fails; the counts are toasted here.
    const out = await run(name, async () => (await post<Record<string, unknown>>(`/admin/jobs/${encodeURIComponent(name)}/run`)) ?? {}, undefined, { refresh: false });
    if (!out) return;
    const words = describe(out);
    setResults((r) => ({ ...r, [name]: out.skipped ? 'skipped, it was already running' : words.replace(/^Done: /, '') }));
    toast(words, out.skipped ? 'error' : 'success');
  };

  const real = system.couriers.filter((c) => !c.test);
  const test = system.couriers.filter((c) => c.test);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Connections</h2>
        <p className="text-sm text-ink-soft">What this server is connected to. These are set in the server&apos;s api.env file, not on this page.</p>
      </div>

      <Panel title="Couriers" description="Book consignments from an order once its courier is set up." bodyClassName="divide-y divide-line">
        {[...real, ...test].map((c) => (
          <div key={c.code} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{c.name}</span>
              {c.test ? <Badge tone="blue">For testing</Badge> : c.configured ? <Badge tone="green">Ready</Badge> : <Badge>Not set up</Badge>}
            </div>
            {c.test ? (
              <p className="mt-1 text-sm text-ink-soft">For trying things out; consignments are not real.</p>
            ) : (
              <div className="mt-2 grid gap-3 lg:grid-cols-2">
                {!c.configured && c.missing.length > 0 && (
                  <div className="min-w-0">
                    <p className="text-sm text-ink-soft">Add these to the server&apos;s api.env:</p>
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {c.missing.map((m) => (
                        <li key={m} className="rounded bg-paper px-1.5 py-0.5 font-mono text-xs text-ink">
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className={clsx('min-w-0', c.configured && 'lg:col-span-2 lg:max-w-2xl')}>
                  <CopyField value={c.webhookUrl} label={`${c.name} webhook link`} />
                  <p className="mt-1 text-xs text-ink-soft">
                    Paste this into the courier&apos;s merchant panel so deliveries update here on their own.
                    {/<[A-Z0-9_]+>/.test(c.webhookUrl) && <> Replace {c.webhookUrl.match(/<[A-Z0-9_]+>/)?.[0]} with the value from api.env.</>}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
        {system.couriers.length === 0 && <p className="px-4 py-6 text-sm text-ink-soft">Couriers the server can book with will appear here.</p>}
      </Panel>

      <Panel title="Payments and text messages" bodyClassName="divide-y divide-line">
        <StatusRow title="Online payments" badge={system.payments.provider === 'sslcommerz' ? <Badge tone="green">SSLCommerz</Badge> : <Badge tone="amber">Test gateway</Badge>}>
          {system.payments.provider === 'sslcommerz'
            ? 'bKash, Nagad and card payments go through SSLCommerz and money reaches your merchant account.'
            : 'bKash, Nagad and card payments open a practice page. No real money moves. Add SSLCommerz details on the server to take real payments.'}
        </StatusRow>
        <StatusRow
          title="Text messages"
          badge={
            system.sms.provider === 'console' ? (
              <Badge tone="amber">Test mode</Badge>
            ) : system.sms.live ? (
              <Badge tone="green">SSL Wireless</Badge>
            ) : (
              <Badge tone="red">SSL Wireless, details missing</Badge>
            )
          }
        >
          {system.sms.provider === 'console'
            ? 'Login codes, alerts and replies are written to the server log instead of being sent. Add SSL Wireless details on the server to send them.'
            : system.sms.live
              ? 'Login codes, alerts and support replies are sent to customers through SSL Wireless.'
              : 'SSL Wireless is chosen, but its API token or SID is missing in api.env, so messages fail. Add both and restart the server.'}
        </StatusRow>
      </Panel>

      <Panel title="Background jobs" description="Tasks the server runs on its own. Run one now if you don't want to wait.">
        {!system.jobsEnabled && (
          <p className="border-b border-line bg-marigold-tint px-4 py-2.5 text-sm text-ink">
            Background jobs are switched off on this server, so these only run when you press Run now.
          </p>
        )}
        <ul className="divide-y divide-line">
          {system.jobs.map((j) => (
            <li key={j.name} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-ink">{j.label}</p>
                <p className="text-xs text-ink-soft">
                  {system.jobsEnabled ? j.schedule : `${j.schedule} when jobs are on`}
                  {results[j.name] && (
                    <span className="text-padma-dark" aria-live="polite">
                      {' '}
                      · Last run: {results[j.name]}
                    </span>
                  )}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                loading={busy === j.name}
                disabled={busy !== null && busy !== j.name}
                onClick={() => runJob(j.name)}
                aria-label={`Run "${j.label}" now`}
              >
                {busy !== j.name && <Play className="size-3.5" aria-hidden />}
                Run now
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
