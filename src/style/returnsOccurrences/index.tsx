import type {
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  HTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';

type DivProps = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
type SectionProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
type UlProps = DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>;
type PProps = DetailedHTMLProps<HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>;
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function PageContainer({ className, ...props }: DivProps) {
  return <div className={cn('flex w-full min-w-0 max-w-[1200px] flex-col gap-s4', className)} {...props} />;
}

export function Tabs({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'relative inline-flex items-end rounded-t-xl border border-border bg-[linear-gradient(180deg,rgba(14,24,40,0.92)_0%,rgba(10,18,32,0.95)_100%)] px-1 pt-1',
        className,
      )}
      {...props}
    />
  );
}

export function TabsRow({ className, ...props }: DivProps) {
  return <div className={cn('flex w-full flex-wrap items-center justify-between gap-s3', className)} {...props} />;
}

export function Grid({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-s3 [&_input]:w-full [&_input]:min-w-0 [&_input]:rounded-sm [&_input]:border [&_input]:border-white/10 [&_input]:bg-[rgba(11,27,42,0.6)] [&_input]:px-3 [&_input]:py-2 [&_input]:text-text [&_select]:w-full [&_select]:min-w-0 [&_select]:rounded-sm [&_select]:border [&_select]:border-white/10 [&_select]:bg-[rgba(11,27,42,0.6)] [&_select]:px-3 [&_select]:py-2 [&_select]:text-text [&_textarea]:min-h-[110px] [&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:resize-y [&_textarea]:rounded-sm [&_textarea]:border [&_textarea]:border-white/10 [&_textarea]:bg-[rgba(11,27,42,0.6)] [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:text-text',
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: SectionProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-white/10 bg-[rgba(8,21,33,0.7)] p-s4 shadow-[var(--shadow-2)] [&_h2]:mb-s3 [&_h2]:text-[1.05rem]',
        className,
      )}
      {...props}
    />
  );
}

export function BoxDescription({ className, ...props }: DivProps) {
  return <div className={cn('flex gap-s2', className)} {...props} />;
}

export function Actions({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-s2 [&_button]:cursor-pointer [&_button]:rounded-md [&_button]:border-none [&_button]:px-4 [&_button]:py-[0.65rem] [&_button]:font-semibold [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-45 [&_button.primary]:bg-[linear-gradient(135deg,var(--color-accent)_0%,var(--color-accent-strong)_100%)] [&_button.primary]:text-[#04131e] [&_button.secondary]:bg-white/15 [&_button.secondary]:text-text [&_button.danger]:bg-[#f05e5e] [&_button.danger]:text-white',
        className,
      )}
      {...props}
    />
  );
}

export function ReturnSearchRow({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-s2 [&_input[type="number"]]:w-[130px] [&_input[type="number"]]:min-w-0 [&_input[type="number"]]:rounded-sm [&_input[type="number"]]:border [&_input[type="number"]]:border-white/10 [&_input[type="number"]]:bg-[rgba(11,27,42,0.6)] [&_input[type="number"]]:px-3 [&_input[type="number"]]:py-2 [&_input[type="number"]]:text-text max-md:[&_input[type="number"]]:w-full max-md:[&_input[type="number"]]:px-[0.6rem] max-md:[&_input[type="number"]]:py-[0.55rem] [&_label]:inline-flex [&_label]:min-w-0 [&_label]:items-center [&_label]:gap-2 [&_label]:rounded-md [&_label]:px-2 [&_label]:py-1.5 [&_label]:text-[0.92rem] [&_label]:leading-none [&_label]:text-text max-md:[&_label]:flex-1 max-md:[&_label]:min-w-[calc(50%-0.25rem)] max-md:[&_label]:gap-[0.35rem] max-md:[&_label]:text-[0.85rem] [&_input[type="checkbox"]]:grid [&_input[type="checkbox"]]:h-5 [&_input[type="checkbox"]]:w-5 [&_input[type="checkbox"]]:cursor-pointer [&_input[type="checkbox"]]:place-content-center [&_input[type="checkbox"]]:appearance-none [&_input[type="checkbox"]]:rounded-full [&_input[type="checkbox"]]:border-2 [&_input[type="checkbox"]]:border-white/45 [&_input[type="checkbox"]]:bg-[rgba(11,27,42,0.6)] [&_input[type="checkbox"]:checked]:bg-[radial-gradient(circle,var(--color-accent)_0_45%,transparent_50%)]',
        className,
      )}
      {...props}
    />
  );
}

export function List({ className, ...props }: UlProps) {
  return (
    <ul
      className={cn(
        'mt-s3 flex list-none flex-col gap-s2 [&>li]:flex [&>li]:min-w-0 [&>li]:flex-wrap [&>li]:items-center [&>li]:justify-between [&>li]:gap-s3 [&>li]:rounded-sm [&>li]:border [&>li]:border-white/10 [&>li]:bg-[rgba(5,14,22,0.5)] [&>li]:px-s3 [&>li]:py-s2 max-md:[&>li]:items-start [&>li>span]:min-w-0 [&>li>span]:break-words',
        className,
      )}
      {...props}
    />
  );
}

export function OccurrenceItemContent({ className, ...props }: DivProps) {
  return <div className={cn('flex w-full flex-col gap-s2', className)} {...props} />;
}

export function OccurrenceCardFooter({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'mt-1 w-full rounded-md border border-border bg-[linear-gradient(135deg,rgba(8,21,33,0.9)_0%,rgba(12,36,59,0.95)_100%)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
        className,
      )}
      {...props}
    />
  );
}

export function OccurrenceActionsRow({ className, ...props }: DivProps) {
  return <div className={cn('flex w-full flex-nowrap items-center justify-between gap-s2', className)} {...props} />;
}

export function OccurrenceActionsLeft({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'flex flex-nowrap items-center gap-s2 [&_button]:cursor-pointer [&_button]:rounded-md [&_button]:border-none [&_button]:px-4 [&_button]:py-[0.65rem] [&_button]:font-semibold [&_button.primary]:bg-[linear-gradient(135deg,var(--color-accent)_0%,var(--color-accent-strong)_100%)] [&_button.primary]:text-[#04131e]',
        className,
      )}
      {...props}
    />
  );
}

export function OccurrenceActionsRight({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'flex flex-nowrap items-center justify-end gap-s2 [&_button]:cursor-pointer [&_button]:rounded-md [&_button]:border-none [&_button]:px-4 [&_button]:py-[0.65rem] [&_button]:font-semibold [&_button.secondary]:bg-white/15 [&_button.secondary]:text-text [&_button.danger]:bg-[#f05e5e] [&_button.danger]:text-white',
        className,
      )}
      {...props}
    />
  );
}

export function BatchItemContent({ className, ...props }: DivProps) {
  return <div className={cn('flex w-full flex-col gap-s2', className)} {...props} />;
}

export function BatchActionsRow({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-s2 [&_button]:cursor-pointer [&_button]:rounded-md [&_button]:border-none [&_button]:px-4 [&_button]:py-[0.65rem] [&_button]:font-semibold [&_button.primary]:bg-[linear-gradient(135deg,var(--color-accent)_0%,var(--color-accent-strong)_100%)] [&_button.primary]:text-[#04131e] [&_button.secondary]:bg-white/15 [&_button.secondary]:text-text',
        className,
      )}
      {...props}
    />
  );
}

export function ListHeaderRow({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'mt-[18px] flex items-end justify-between gap-s2 [&_h2]:mb-0',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeaderRow({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-s2 [&_h2]:mb-0 [&_button]:cursor-pointer [&_button]:rounded-md [&_button]:border-none [&_button]:px-4 [&_button]:py-[0.65rem] [&_button]:font-semibold [&_button.secondary]:bg-white/15 [&_button.secondary]:text-text',
        className,
      )}
      {...props}
    />
  );
}

export function SaveBatchButton({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'cursor-pointer rounded-md border-none bg-[linear-gradient(135deg,#3ecf6d_0%,#23a455_100%)] px-4 py-[0.65rem] font-semibold text-[#062611] disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
      {...props}
    />
  );
}

export function InlineText({ className, ...props }: PProps) {
  return <p className={cn('text-[0.88rem] text-muted', className)} {...props} />;
}

export function InfoText({ className, ...props }: PProps) {
  return <p className={cn('text-[0.88rem] text-text-accent', className)} {...props} />;
}

export function TwoColumns({ className, ...props }: DivProps) {
  return <div className={cn('grid min-w-0 grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-s4 max-[768px]:grid-cols-1', className)} {...props} />;
}

export function SingleColumn({ className, ...props }: DivProps) {
  return <div className={cn('flex flex-col gap-s4', className)} {...props} />;
}

export function TopActionBar({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-start gap-s2 [&_button.secondary]:cursor-pointer [&_button.secondary]:rounded-md [&_button.secondary]:border-none [&_button.secondary]:bg-white/15 [&_button.secondary]:px-4 [&_button.secondary]:py-[0.65rem] [&_button.secondary]:font-semibold [&_button.secondary]:text-text',
        className,
      )}
      {...props}
    />
  );
}

export function HighlightButton({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'cursor-pointer rounded-md border-none bg-[linear-gradient(135deg,#ffba2b_0%,#ff7a18_100%)] px-4 py-[0.7rem] font-bold text-[#1f1300]',
        className,
      )}
      {...props}
    />
  );
}

export function ModalOverlay({ className, ...props }: DivProps) {
  return <div className={cn('fixed inset-0 z-[1400] bg-black/55 backdrop-blur-[3px]', className)} {...props} />;
}

export function ModalCard({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'fixed left-1/2 top-1/2 z-[1500] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-[rgba(8,21,33,0.98)] p-s4 shadow-[var(--shadow-2)] [&_h3]:mb-s3 [&_input]:mb-s3 [&_input]:w-full [&_input]:rounded-sm [&_input]:border [&_input]:border-white/10 [&_input]:bg-[rgba(11,27,42,0.6)] [&_input]:px-3 [&_input]:py-2 [&_input]:text-text',
        className,
      )}
      {...props}
    />
  );
}
