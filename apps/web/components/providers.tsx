'use client';

import clsx from 'clsx';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { Me } from '@/lib/server';

interface SessionValue {
  user: Me['user'];
  cartCount: number;
  unread: number;
  refresh: () => Promise<void>;
  setCartCount: (n: number) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function Providers({ me, children }: { me: Me; children: ReactNode }) {
  const [user, setUser] = useState(me.user);
  const [cartCount, setCartCount] = useState(me.cartCount ?? 0);
  const [unread, setUnread] = useState(me.unreadNotifications ?? 0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const fresh = await api<Me>('/auth/me');
      setUser(fresh.user);
      setCartCount(fresh.cartCount ?? 0);
      setUnread(fresh.unreadNotifications ?? 0);
    } catch {
      /* keep current state */
    }
  }, []);

  const toast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const session = useMemo(() => ({ user, cartCount, unread, refresh, setCartCount }), [user, cartCount, unread, refresh]);

  return (
    <SessionContext.Provider value={session}>
      <ToastContext.Provider value={toast}>
        {children}
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={clsx(
                'pointer-events-auto flex max-w-md items-center gap-2 rounded-lg px-4 py-3 text-[15px] font-medium text-white shadow-lg',
                t.tone === 'success' ? 'bg-ink' : 'bg-sindoor',
              )}
            >
              {t.tone === 'success' ? <CircleCheck className="size-5 shrink-0 text-marigold" /> : <TriangleAlert className="size-5 shrink-0" />}
              {t.message}
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </SessionContext.Provider>
  );
}
