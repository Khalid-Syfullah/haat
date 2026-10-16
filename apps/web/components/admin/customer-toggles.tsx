'use client';

import { useState } from 'react';
import { patch } from '@/lib/api';
import { Switch } from './controls';
import { useAction } from './use-action';

/** Inline switches on a customer row. Optimistic, rolled back if the API refuses. */
export function CustomerToggles({ id, name, codBlocked, isActive }: { id: string; name: string; codBlocked: boolean; isActive: boolean }) {
  const { run, busy } = useAction();
  const [cod, setCod] = useState(codBlocked);
  const [disabled, setDisabled] = useState(!isActive);

  const save = async (key: 'cod' | 'active', body: Record<string, boolean>, msg: string, rollback: () => void) => {
    const ok = await run(key, () => patch(`/admin/customers/${id}`, body), msg, { refresh: false });
    if (!ok) rollback();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Switch
        checked={cod}
        tone="red"
        disabled={busy === 'cod'}
        label="Block cash on delivery"
        onChange={(v) => {
          setCod(v);
          save('cod', { codBlocked: v }, v ? `${name} must now pay online` : `${name} can use cash on delivery again`, () => setCod(!v));
        }}
      />
      <Switch
        checked={disabled}
        tone="red"
        disabled={busy === 'active'}
        label="Disable account"
        onChange={(v) => {
          if (v && !window.confirm(`Disable ${name}'s account? They will not be able to log in or order.`)) return;
          setDisabled(v);
          save('active', { isActive: !v }, v ? `${name}'s account is disabled` : `${name}'s account is active again`, () => setDisabled(!v));
        }}
      />
    </div>
  );
}
