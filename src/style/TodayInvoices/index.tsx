import { DetailedHTMLProps, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type DivProps = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
type SpanProps = DetailedHTMLProps<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;

export function ContainerTodayInvoices({ className, ...props }: DivProps) {
  return <div className={cn('relative flex min-h-screen w-full flex-col', className)} {...props} />;
}

export function FilterBar({ className, ...props }: DivProps) {
  return (
    <div
      data-tutorial="page-filters"
      className={cn(
        'mb-s4 grid w-full grid-cols-[repeat(auto-fit,minmax(170px,1fr))] items-end gap-s2 text-text max-[768px]:grid-cols-2',
        '[&_input]:h-9 [&_input]:w-full [&_input]:rounded-sm [&_input]:border [&_input]:border-border [&_input]:bg-card [&_input]:px-3 [&_input]:text-sm [&_input]:text-text [&_input:focus]:border-accent [&_input:focus]:outline-none [&_input:focus]:ring-2 [&_input:focus]:ring-accent/20',
        '[&_select]:h-9 [&_select]:w-full [&_select]:rounded-sm [&_select]:border [&_select]:border-border [&_select]:bg-card [&_select]:px-3 [&_select]:text-sm [&_select]:text-text [&_select:focus]:border-accent [&_select:focus]:outline-none [&_select:focus]:ring-2 [&_select:focus]:ring-accent/20',
        '[&_button]:h-9 [&_button]:w-full [&_button]:rounded-md [&_button]:border [&_button]:border-accent-strong [&_button]:bg-accent [&_button]:px-3 [&_button]:text-sm [&_button]:font-semibold [&_button]:text-white [&_button:hover]:bg-accent-strong',
        className,
      )}
      {...props}
    />
  );
}

export function ContainerDanfes({ className, ...props }: DivProps) {
  return <div className={cn('flex w-full flex-col items-center gap-3', className)} {...props} />;
}

export function NotesFound({ className, ...props }: SpanProps) {
  return <span className={cn('mb-s1 mt-s2 text-[clamp(1rem,1.6vw,1.3rem)] font-semibold text-text', className)} {...props} />;
}
