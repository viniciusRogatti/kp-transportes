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
      className={cn(
        'mb-s6 grid w-full grid-cols-[repeat(auto-fit,minmax(200px,1fr))] items-end gap-s3 text-text max-[768px]:grid-cols-2 max-[768px]:gap-s2',
        '[&_input]:h-10 [&_input]:w-full [&_input]:rounded-sm [&_input]:border [&_input]:border-accent/35 [&_input]:bg-surface-2/85 [&_input]:px-3 [&_input]:text-text [&_input:focus]:outline-none [&_input:focus]:ring-2 [&_input:focus]:ring-accent/60',
        '[&_select]:h-10 [&_select]:w-full [&_select]:rounded-sm [&_select]:border [&_select]:border-accent/35 [&_select]:bg-surface-2/85 [&_select]:px-3 [&_select]:text-text [&_select:focus]:outline-none [&_select:focus]:ring-2 [&_select:focus]:ring-accent/60',
        '[&_button]:w-full [&_button]:rounded-md [&_button]:bg-gradient-to-r [&_button]:from-accent [&_button]:to-accent-strong [&_button]:px-3 [&_button]:py-2 [&_button]:font-semibold [&_button]:text-[#04131e]',
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
  return <span className={cn('m-s3 text-[clamp(1rem,1.8vw,1.4rem)] font-semibold text-text', className)} {...props} />;
}
