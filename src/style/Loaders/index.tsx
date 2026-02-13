import { DetailedHTMLProps, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type DivProps = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
type SpanProps = DetailedHTMLProps<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;

export function TruckLoader({ className, ...props }: DivProps) {
  return (
    <div className={cn('mt-24 inline-flex h-[100px] w-[130px] items-center justify-center rounded-md border border-accent/40 bg-surface/70 text-4xl', className)} {...props}>
      🚚
    </div>
  );
}

export function Loading({ className, ...props }: SpanProps) {
  return <span className={cn('mt-12 inline-block animate-pulse text-4xl tracking-[6px] text-text', className)} {...props}>Loading</span>;
}

export function LoaderPrinting({ className, ...props }: SpanProps) {
  return <span className={cn('mt-24 inline-flex items-center gap-2 rounded-md border border-accent/40 bg-surface/70 px-4 py-3 text-sm', className)} {...props}>🖨️ Processando...</span>;
}

export function ProductsLoader({ className, ...props }: DivProps) {
  return <div className={cn('h-[140px] w-[200px] animate-pulse rounded-md border border-accent/40 bg-surface/70', className)} {...props} />;
}
