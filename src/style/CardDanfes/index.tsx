import { DetailedHTMLProps, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type DivProps = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
type UlProps = DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>;

export function ContainerCards({ className, ...props }: DivProps) {
  return <div className={cn('mx-auto flex w-full max-w-[1200px] flex-wrap justify-center gap-s5', className)} {...props} />;
}

export function CardsDanfe({ className, ...props }: DivProps) {
  return <div className={cn('relative flex h-full min-h-0 w-full flex-col rounded-lg border border-border bg-[#0C243B] px-s3 py-s3 text-text shadow-elevated', className)} {...props} />;
}

export function DescriptionColumns({ className, ...props }: DivProps) {
  return <div className={cn('flex justify-between text-xs font-semibold uppercase tracking-wide text-muted', className)} {...props} />;
}

export function ContainerItems({ className, ...props }: DivProps) {
  return <div className={cn('scrollbar-ui mt-s2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain rounded-md border border-border bg-surface-2/65 p-s2 touch-pan-y [-webkit-overflow-scrolling:touch]', className)} {...props} />;
}

export function ListItems({ className, ...props }: UlProps) {
  return <ul className={cn('flex list-none items-center justify-between gap-1 border-b border-border/60 py-0.5 text-[12px] font-medium text-text [&>li:nth-child(1)]:min-w-[78px] [&>li:nth-child(2)]:max-w-[165px] [&>li:nth-child(2)]:overflow-hidden [&>li:nth-child(2)]:text-ellipsis [&>li:nth-child(2)]:whitespace-nowrap [&>li:nth-child(2)]:font-normal [&>li:nth-child(2)]:text-muted [&>li:nth-child(3)]:whitespace-nowrap', className)} {...props} />;
}

export function TitleCard({ className, ...props }: DivProps) {
  return <div className={cn('relative h-[44px] w-full [&_h1]:absolute [&_h1]:left-1 [&_h1]:top-1 [&_h1]:text-base [&_h1]:font-semibold [&_h4]:absolute [&_h4]:right-1 [&_h4]:top-1.5 [&_h4]:text-xs [&_h4]:font-semibold [&_h4]:text-muted', className)} {...props} />;
}

export function TotalQuantity({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'mt-2 border-t border-border pt-1.5 [&_p]:text-sm [&_p]:font-semibold [&_p]:text-text',
        className,
      )}
      {...props}
    />
  );
}
