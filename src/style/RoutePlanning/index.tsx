import type { DetailedHTMLProps, HTMLAttributes, ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';

type DivProps = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
type H1Props = DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
type ActionTone = 'primary' | 'secondary' | 'tertiary' | 'quaternary';
type ActionButtonProps = ButtonProps & { $tone: ActionTone };
type CardActionVariant = 'left' | 'right' | 'remove';
type CardActionButtonProps = ButtonProps & { $variant: CardActionVariant };

export function ContainerRoutePlanning({ className, ...props }: DivProps) {
  return <div className={cn('relative flex min-h-screen w-full flex-col', className)} {...props} />;
}

export function ContainerForm({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'flex w-[min(100%,1100px)] flex-wrap items-center justify-center gap-s5 p-s3 text-text max-md:flex-col max-md:items-stretch max-md:gap-s3',
        className,
      )}
      {...props}
    />
  );
}

export function FormColumns({ className, ...props }: DivProps) {
  return <div className={cn('grid w-full grid-cols-2 gap-s6 max-md:grid-cols-1', className)} {...props} />;
}

export function FormColumn({ className, ...props }: DivProps) {
  return <div className={cn('flex w-full flex-col gap-s3 [&_label]:text-[0.9rem]', className)} {...props} />;
}

export function BoxButton({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'mt-s3 flex w-fit flex-wrap justify-center gap-s3 max-md:order-3 max-md:w-full',
        className,
      )}
      {...props}
    />
  );
}

export function ActionButton({ className, $tone, ...props }: ActionButtonProps) {
  const toneClass =
    $tone === 'primary'
      ? 'border-transparent bg-[linear-gradient(135deg,var(--color-accent)_0%,var(--color-accent-strong)_100%)] text-[#04131e]'
      : $tone === 'tertiary'
        ? 'border border-amber-700/70 bg-amber-950/25 text-amber-200'
        : 'border-border bg-surface-2/90 text-text';

  return (
    <button
      className={cn(
        'w-2/5 cursor-pointer rounded border px-[10px] py-[6px] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55 max-md:w-full',
        toneClass,
        className,
      )}
      {...props}
    />
  );
}

export function ActionsRow({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-wrap justify-center gap-s3 [&>button]:w-[32%] max-md:[&>button]:w-full',
        className,
      )}
      {...props}
    />
  );
}

export function SubmitRow({ className, ...props }: DivProps) {
  return <div className={cn('mt-s3 flex w-full justify-center [&>button]:w-[min(100%,360px)]', className)} {...props} />;
}

export function BoxInfo({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'flex w-2/3 items-center justify-start gap-s7 p-s3 [&_p]:text-[20px] [&_p]:font-bold [&_span]:text-accent max-md:w-full max-md:flex-wrap',
        className,
      )}
      {...props}
    />
  );
}

export function TitleRoutePlanning({ className, children, ...props }: H1Props) {
  return (
    <h1 className={cn('mt-s2 text-center text-text', className)} {...props}>
      {children}
    </h1>
  );
}

export function TripsContainer({ className, ...props }: any) {
  return (
    <motion.ul
      className={cn(
        'flex w-[95%] flex-wrap items-center justify-center gap-s5 transition-all duration-500 ease-in-out',
        className,
      )}
      {...props}
    />
  );
}

export function CardsTripsNotes({ className, ...props }: any) {
  return (
    <motion.li
      className={cn(
        'relative mt-s5 flex h-[200px] max-w-[320px] flex-1 basis-[240px] flex-col items-center justify-center rounded-lg border border-[rgba(12,39,60,0.2)] bg-card text-[#0b1b2a] shadow-soft [&>h2]:absolute [&>h2]:left-[30%] [&>h2]:top-5 [&>h3]:mt-s2 [&>h3]:text-[#0b1b2a] [&>h4]:max-w-[93%] [&>h4]:overflow-hidden [&>h4]:text-center [&>h4]:text-xs [&>h5]:absolute [&>h5]:left-3 [&>h5]:top-2 [&>h5]:rounded-full [&>h5]:border [&>h5]:border-black [&>h5]:px-[14px] [&>h5]:py-2 [&>h5]:text-[22px] [&>p]:absolute [&>p]:right-3 [&>p]:top-2 [&>p]:font-bold',
        className,
      )}
      {...props}
    />
  );
}

export function CardActionButton({ className, $variant, ...props }: CardActionButtonProps) {
  const variantClass =
    $variant === 'left'
      ? 'left-3 bottom-2'
      : $variant === 'right'
        ? 'right-3 bottom-2'
        : 'bottom-2 font-bold capitalize';

  return (
    <button
      className={cn(
        'absolute h-5 w-fit cursor-pointer border-none bg-transparent [&_svg]:h-6 [&_svg]:w-6',
        variantClass,
        className,
      )}
      {...props}
    />
  );
}

export function BoxDriverVehicle({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-col items-start justify-center gap-s2 [&_select]:h-10 [&_select]:w-full [&_select]:rounded-sm [&_select]:border [&_select]:border-accent/35 [&_select]:bg-[rgba(14,33,56,0.9)] [&_select]:px-3 [&_select]:text-sm [&_select]:text-text [&_select]:outline-none [&_select:focus]:ring-2 [&_select:focus]:ring-accent/60 [&_input]:h-10 [&_input]:w-full [&_input]:rounded-sm [&_input]:border [&_input]:border-accent/35 [&_input]:bg-[rgba(14,33,56,0.9)] [&_input]:px-3 [&_input]:text-sm [&_input]:text-text [&_input]:placeholder:text-muted [&_input]:outline-none [&_input:focus]:ring-2 [&_input:focus]:ring-accent/60',
        className,
      )}
      {...props}
    />
  );
}

export function BoxSelectDanfe({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-col items-start justify-center gap-s2 [&_input]:h-10 [&_input]:w-full [&_input]:rounded-sm [&_input]:border [&_input]:border-accent/35 [&_input]:bg-[rgba(14,33,56,0.9)] [&_input]:px-3 [&_input]:text-sm [&_input]:text-text [&_input]:placeholder:text-muted [&_input]:outline-none [&_input:focus]:ring-2 [&_input:focus]:ring-accent/60',
        className,
      )}
      {...props}
    />
  );
}

export function FieldGroup({ className, ...props }: DivProps) {
  return <div className={cn('flex w-full flex-col gap-s2', className)} {...props} />;
}
