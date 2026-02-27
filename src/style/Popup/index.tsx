import {
  DetailedHTMLProps,
  HTMLAttributes,
  LabelHTMLAttributes,
  ButtonHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';

type DivProps = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
type LabelProps = DetailedHTMLProps<LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>;
type BtnProps = DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;

export function Overlay({ className, ...props }: DivProps) {
  return <div className={cn('fixed inset-0 z-[1490] bg-black/70 backdrop-blur-[2px]', className)} {...props} />;
}

export function PopupContainer({ className, ...props }: DivProps) {
  return <div className={cn('fixed inset-0 z-[1500] grid place-items-center p-3', className)} {...props} />;
}

export function PopupContent({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'w-full max-w-[480px] rounded-lg border border-border bg-surface p-4 text-text shadow-[var(--shadow-3)]',
        '[&_h2]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text',
        className,
      )}
      {...props}
    />
  );
}

export function InputBox({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        'mb-2 flex w-full flex-col gap-1.5 text-sm text-muted',
        '[&_input]:h-10 [&_input]:w-full [&_input]:rounded-sm [&_input]:border [&_input]:border-accent/35 [&_input]:bg-surface-2/85 [&_input]:px-3 [&_input]:text-sm [&_input]:text-text [&_input]:placeholder:text-muted [&_input]:outline-none [&_input:focus]:ring-2 [&_input:focus]:ring-accent/60',
        className,
      )}
      {...props}
    />
  );
}

export function ButtonBox({ className, ...props }: DivProps) {
  return <div className={cn('mt-3 grid w-full grid-cols-2 gap-2 max-[520px]:grid-cols-1', className)} {...props} />;
}

export function PopupButton({ className, $tone, ...props }: BtnProps & { $tone?: 'primary' | 'danger' }) {
  return (
    <button
      className={cn(
        'h-10 w-full cursor-pointer rounded-md border px-3 text-sm font-semibold transition hover:-translate-y-px',
        $tone === 'danger'
          ? 'border-rose-700/70 bg-rose-950/35 text-rose-200 hover:bg-rose-900/40'
          : 'border-white/15 bg-gradient-to-r from-accent to-accent-strong text-[#04131e]',
        className,
      )}
      {...props}
    />
  );
}
