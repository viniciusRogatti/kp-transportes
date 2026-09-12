import { DetailedHTMLProps, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type DivProps = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
type UlProps = DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>;

export function ContainerCards({ className, ...props }: DivProps) {
  return <div className={cn('mx-auto grid w-full max-w-[var(--content-max-width)] grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3', className)} {...props} />;
}

export function CardsDanfe({ className, ...props }: DivProps) {
  return <div className={cn('relative flex h-full min-h-0 w-full flex-col rounded-lg border border-border bg-card p-2.5 text-text shadow-soft', className)} {...props} />;
}

export function DescriptionColumns({ className, ...props }: DivProps) {
  return <div className={cn('grid grid-cols-[4rem_minmax(0,1fr)_auto] gap-1 text-[10px] font-semibold uppercase tracking-wide [&>span:last-child]:text-right text-muted', className)} {...props} />;
}

export function ContainerItems({ className, ...props }: DivProps) {
  return <div className={cn('mt-1.5 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden rounded-md border border-border bg-surface-2 p-1.5', className)} {...props} />;
}

export function ItemsScrollArea({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'danfe-items-scroll scrollbar-ui min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] max-[768px]:select-none',
        className,
      )}
      {...props}
    />
  );
}

export function ListItems({ className, ...props }: UlProps) {
  return <ul className={cn('touch-pan-y grid grid-cols-[4rem_minmax(0,1fr)_auto] list-none items-center gap-1 border-b border-border py-1 text-[11px] font-medium text-text [&>li]:min-w-0 [&>li:nth-child(2)]:truncate [&>li:nth-child(2)]:font-normal [&>li:nth-child(2)]:text-muted [&>li:nth-child(3)]:whitespace-nowrap [&>li:nth-child(3)]:text-right', className)} {...props} />;
}

export function TitleCard({ className, ...props }: DivProps) {
  return <div className={cn('relative h-[44px] w-full [&_h1]:absolute [&_h1]:left-1 [&_h1]:top-1 [&_h1]:text-base [&_h1]:font-semibold [&_h4]:absolute [&_h4]:right-1 [&_h4]:top-1.5 [&_h4]:text-xs [&_h4]:font-semibold [&_h4]:text-muted', className)} {...props} />;
}

export function TotalQuantity({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'mt-2 border-t border-border pt-1.5 [&_p]:text-[10px] [&_p]:font-semibold [&_p]:text-text',
        className,
      )}
      {...props}
    />
  );
}
