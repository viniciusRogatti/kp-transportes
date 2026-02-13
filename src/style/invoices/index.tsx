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
      className={cn(
        'relative flex min-h-screen w-full flex-col items-center bg-transparent px-s5 pb-s8 pt-[calc(var(--header-height)+var(--space-5))] text-text max-[768px]:px-s4 max-[768px]:pb-s6 max-[768px]:pt-[calc(var(--header-height)+var(--space-4))]',
        '[&_table]:w-full [&_table]:max-w-[1200px] [&_table]:border-collapse [&_table]:text-[clamp(0.78rem,1.2vw,0.95rem)]',
        '[&_th]:px-s3 [&_th]:py-s3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-accent',
        '[&_td]:border-b [&_td]:border-white/10 [&_td]:px-s3 [&_td]:py-s3',
        className,
      )}
      {...props}
    />
  );
}

export function FilterBar({ className, ...props }: DivProps) {
  return <div className={cn('mb-s5 grid w-full max-w-[900px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-s3 max-[768px]:gap-s2', className)} {...props} />;
}

export function FilterInput({ className, ...props }: InputProps) {
  return <input className={cn('h-10 w-full rounded-sm border border-accent/35 bg-[rgba(14,33,56,0.9)] px-3 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/60', className)} {...props} />;
}

export function SearchBar({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'mb-s5 flex w-full max-w-[1100px] flex-nowrap items-end gap-s3 max-[768px]:flex-col max-[768px]:gap-s2',
        '[&_input]:h-10 [&_input]:w-full [&_input]:rounded-sm [&_input]:border [&_input]:border-accent/35 [&_input]:bg-[rgba(14,33,56,0.9)] [&_input]:px-3 [&_input]:text-text [&_input]:placeholder:text-muted [&_input:focus]:outline-none [&_input:focus]:ring-2 [&_input:focus]:ring-accent/60',
        '[&_.react-datepicker-wrapper_input]:h-10',
        className,
      )}
      {...props}
    />
  );
}

export function SearchButton({ className, ...props }: ButtonProps) {
  return <button className={cn('h-10 rounded-md border border-white/15 bg-gradient-to-r from-accent to-accent-strong px-4 font-semibold text-[#04131e] transition hover:-translate-y-0.5', className)} {...props} />;
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
