import {
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  HTMLAttributes,
  InputHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';

type DivProps = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
type InputProps = DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;

type ButtonProps = DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;

export function Container({ className, ...props }: DivProps) {
  return (
    <div
      data-tutorial="page-content"
      className={cn(
        'relative flex min-h-screen w-full flex-col items-center bg-transparent px-s4 pb-s7 pt-[calc(var(--header-height)+var(--space-4))] text-text max-[768px]:px-s3 max-[768px]:pb-s6 max-[768px]:pt-[calc(var(--header-height)+var(--space-3))]',
        '[&_table]:w-full [&_table]:max-w-[1200px] [&_table]:border-collapse [&_table]:text-[clamp(0.78rem,1.2vw,0.95rem)]',
        '[&_th]:border-b [&_th]:border-border [&_th]:bg-surface-2 [&_th]:px-s3 [&_th]:py-s3 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted',
        '[&_td]:border-b [&_td]:border-border [&_td]:px-s3 [&_td]:py-s3',
        className,
      )}
      {...props}
    />
  );
}

export function FilterBar({ className, ...props }: DivProps) {
  return <div data-tutorial="page-filters" className={cn('mb-s4 grid w-full max-w-[var(--content-max-width)] grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5 max-[768px]:gap-s2', className)} {...props} />;
}

export function FilterInput({ className, ...props }: InputProps) {
  return <input className={cn('h-9 w-full rounded-sm border border-border bg-card px-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20', className)} {...props} />;
}

export function SearchBar({ className, ...props }: DivProps) {
  return (
    <div
      data-tutorial="page-filters"
      className={cn(
        'mb-s5 flex w-full max-w-[1100px] flex-nowrap items-end gap-s3 max-[768px]:flex-col max-[768px]:gap-s2',
        '[&_input]:h-10 [&_input]:w-full [&_input]:rounded-sm [&_input]:border [&_input]:border-border [&_input]:bg-card [&_input]:px-3 [&_input]:text-text [&_input]:placeholder:text-muted [&_input:focus]:border-accent [&_input:focus]:outline-none [&_input:focus]:ring-2 [&_input:focus]:ring-accent/20',
        '[&_.react-datepicker-wrapper_input]:h-10',
        className,
      )}
      {...props}
    />
  );
}

export function SearchButton({ className, ...props }: ButtonProps) {
  return <button className={cn('h-10 rounded-md border border-accent-strong bg-accent px-4 font-semibold text-white shadow-soft transition-colors hover:bg-accent-strong', className)} {...props} />;
}

export function SearchRow({ className, ...props }: DivProps) {
  return <div className={cn('grid w-auto grid-cols-[minmax(150px,180px)_130px] items-stretch gap-s2 max-[768px]:w-full max-[768px]:grid-cols-[minmax(0,1fr)_108px]', className)} {...props} />;
}

export function DateRow({ className, ...props }: DivProps) {
  return <div className={cn('grid w-auto grid-cols-[1fr_130px] items-stretch gap-s2 max-[768px]:w-full max-[768px]:grid-cols-[minmax(0,1fr)_108px]', className)} {...props} />;
}

export function DateGroup({ className, ...props }: DivProps) {
  return <div className={cn('grid w-auto grid-cols-[repeat(2,minmax(150px,170px))] gap-s2 max-[768px]:w-full max-[768px]:grid-cols-2', className)} {...props} />;
}

export function DateAction({ className, ...props }: DivProps) {
  return <div className={cn('flex w-auto items-stretch max-[768px]:w-full', className)} {...props} />;
}
