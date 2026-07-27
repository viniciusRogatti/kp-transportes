import { DetailedHTMLProps, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type DivProps = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
type SectionProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
type UlProps = DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>;

export function HomeStyle({ className, ...props }: DivProps) {
  return <div className={cn('relative flex min-h-screen w-full flex-col items-center justify-start bg-transparent', className)} {...props} />;
}

export function HomeContent({ className, ...props }: DivProps) {
  return <div className={cn('w-full max-w-[1100px] px-s5 pb-s7 pt-[calc(var(--header-height)+var(--space-5))]', className)} {...props} />;
}

export function OccurrenceCard({ className, ...props }: SectionProps) {
  return <section className={cn('rounded-lg border border-border bg-surface p-s4 shadow-soft', className)} {...props} />;
}

export function OccurrenceList({ className, ...props }: UlProps) {
  return (
    <ul
      className={cn(
        'flex list-none flex-col gap-s2',
        '[&_li]:flex [&_li]:items-center [&_li]:justify-between [&_li]:gap-s3 [&_li]:rounded-sm [&_li]:border [&_li]:border-border [&_li]:bg-surface-2 [&_li]:px-s3 [&_li]:py-s2',
        '[&_small]:text-muted [&_button]:rounded-sm [&_button]:border [&_button]:border-accent-strong [&_button]:bg-accent [&_button]:px-3 [&_button]:py-2 [&_button]:font-semibold [&_button]:text-white [&_button:hover]:bg-accent-strong',
        'max-[768px]:[&_li]:flex-col max-[768px]:[&_li]:items-start',
        className,
      )}
      {...props}
    />
  );
}
