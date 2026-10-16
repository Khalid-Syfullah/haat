'use client';

import clsx from 'clsx';
import { LoaderCircle, Star, X } from 'lucide-react';
import {
  ButtonHTMLAttributes,
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
  useRef,
} from 'react';
import { tk } from '@/lib/format';

export { clsx };

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'deal' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-padma text-white hover:bg-padma-dark disabled:bg-padma/50',
  secondary: 'bg-padma-tint text-padma-dark hover:bg-[#d2e9de] disabled:opacity-60',
  outline: 'border border-line bg-white text-ink hover:border-ink-faint disabled:opacity-60',
  ghost: 'text-ink-soft hover:bg-black/5 hover:text-ink disabled:opacity-50',
  deal: 'bg-marigold text-ink hover:bg-[#e09d00] disabled:opacity-60',
  danger: 'bg-sindoor text-white hover:bg-[#b81f33] disabled:opacity-60',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-[15px] gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-md font-semibold transition-colors',
        buttonStyles[variant],
        sizeStyles[size],
        block && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

const fieldBase =
  'w-full rounded-md border border-line bg-white px-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-padma focus:outline-none focus:ring-2 focus:ring-padma/20 disabled:bg-paper';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx(fieldBase, 'h-10', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={clsx(fieldBase, 'min-h-24 py-2', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={clsx(fieldBase, 'h-10 pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-sindoor">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-soft">{hint}</span> : null}
    </label>
  );
}

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-px', className)} aria-label={`${value} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-line" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="text-marigold" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function Price({ price, original, size = 'md', className }: { price: number; original?: number; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const discount = original && original > price ? Math.round(((original - price) / original) * 100) : 0;
  return (
    <span className={clsx('inline-flex flex-wrap items-baseline gap-x-2', className)}>
      <span
        className={clsx(
          'font-bold text-sindoor',
          size === 'sm' && 'text-base',
          size === 'md' && 'text-lg',
          size === 'lg' && 'text-2xl',
          size === 'xl' && 'text-3xl',
        )}
      >
        {tk(price)}
      </span>
      {discount > 0 && (
        <>
          <span className={clsx('text-ink-faint line-through', size === 'sm' ? 'text-xs' : 'text-sm')}>{tk(original)}</span>
          <span className={clsx('font-semibold text-ink-soft', size === 'sm' ? 'text-xs' : 'text-sm')}>-{discount}%</span>
        </>
      )}
    </span>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue'; className?: string }) {
  const tones = {
    neutral: 'bg-black/5 text-ink-soft',
    green: 'bg-padma-tint text-padma-dark',
    amber: 'bg-marigold-tint text-marigold-dark',
    red: 'bg-sindoor-tint text-sindoor',
    blue: 'bg-[#e6eefc] text-[#2a55b5]',
  };
  return <span className={clsx('inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={clsx('size-5 animate-spin text-padma', className)} aria-label="Loading" />;
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-ink-faint">{icon}</div>}
      <p className="text-lg font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rounded-[var(--radius-card)] border border-line bg-white', className)}>{children}</div>;
}

/** Accessible dialog on desktop, bottom sheet on phones. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={clsx(
        'm-0 mt-auto w-full max-w-none rounded-t-xl bg-white p-0 text-ink backdrop:bg-black/40 sm:m-auto sm:rounded-xl',
        wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
      )}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button onClick={onClose} className="rounded p-1 text-ink-soft hover:bg-black/5" aria-label="Close">
          <X className="size-5" />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
    </dialog>
  );
}

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pages">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      {nums.map((n, i) => (
        <span key={n} className="flex items-center">
          {i > 0 && nums[i - 1] !== n - 1 && <span className="px-1 text-ink-faint">…</span>}
          <button
            onClick={() => onPage(n)}
            aria-current={n === page ? 'page' : undefined}
            className={clsx('h-8 min-w-8 rounded-md px-2 text-sm font-semibold', n === page ? 'bg-padma text-white' : 'text-ink hover:bg-black/5')}
          >
            {n}
          </button>
        </span>
      ))}
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

export function QtyStepper({ value, min = 1, max, onChange, disabled }: { value: number; min?: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex h-9 items-center rounded-md border border-line bg-white">
      <button
        type="button"
        className="h-full w-9 text-lg text-ink-soft hover:text-ink disabled:opacity-30"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="w-8 text-center text-[15px] font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="h-full w-9 text-lg text-ink-soft hover:text-ink disabled:opacity-30"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
