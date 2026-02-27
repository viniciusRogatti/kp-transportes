import { DetailedHTMLProps, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type DivProps = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
type UlProps = DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>;
type LiProps = DetailedHTMLProps<HTMLAttributes<HTMLLIElement>, HTMLLIElement>;

export function ContainerTrips({ className, ...props }: DivProps) {
  return <div className={cn('mt-s5 flex w-full flex-wrap justify-center gap-s4', className)} {...props} />;
}

export function ContainerInputs({ className, ...props }: DivProps) {
  return <div className={cn('flex w-full max-w-[320px] min-w-0 flex-col items-center justify-center text-text', className)} {...props} />;
}

export function BoxSearch({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-center gap-s2',
        '[&_.react-datepicker-wrapper]:w-full [&_.react-datepicker__input-container]:w-full',
        '[&_input]:h-10 [&_input]:w-full [&_input]:rounded-sm [&_input]:border [&_input]:border-accent/35 [&_input]:bg-card [&_input]:px-3 [&_input]:text-text [&_input:focus]:outline-none [&_input:focus]:ring-2 [&_input:focus]:ring-accent/60',
        className,
      )}
      {...props}
    />
  );
}

export function CardTrips({ className, ...props }: DivProps) {
  return <div className={cn('relative flex min-h-[320px] w-full max-w-[320px] flex-col items-center rounded-lg border border-black/10 bg-card px-s4 py-s3 text-[#0b1b2a] shadow-soft', className)} {...props} />;
}

export function CardHeader({ className, ...props }: DivProps) {
  return <div className={cn('relative flex w-full items-center justify-between px-s4 py-s4', className)} {...props} />;
}

export function LeftHeader({ className, ...props }: DivProps) {
  return <div className={cn('absolute left-5 top-1.5 [&_p]:text-sm [&_p]:font-bold', className)} {...props} />;
}

export function RightHeader({ className, ...props }: DivProps) {
  return <div className={cn('absolute right-5 top-1.5 flex flex-col items-end [&_p]:text-xs', className)} {...props} />;
}

export function TripNotesContainer({ className, ...props }: DivProps) {
  return <div className={cn('absolute left-4 top-[60px] flex max-h-[200px] w-[87%] overflow-y-auto', className)} {...props} />;
}

export function TripNotesList({ className, ...props }: UlProps) {
  return <ul className={cn('flex w-full list-none flex-wrap items-start gap-2', className)} {...props} />;
}

export function TripNoteItem({ className, ...props }: LiProps) {
  return (
    <li
      className={cn(
        'relative h-[70px] w-full rounded-sm border border-black/10 p-s2',
        '[&_p]:absolute [&_p]:top-[35%] [&_p]:text-[10px]',
        '[&_h4]:absolute [&_h4]:top-[2px] [&_h4]:text-base',
        '[&_h5]:absolute [&_h5]:bottom-1 [&_h5]:right-2 [&_h5]:text-base',
        className,
      )}
      {...props}
    />
  );
}

export function BoxButton({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 flex w-full justify-between [&_button]:m-s2 [&_button]:w-[45%] [&_button]:rounded-sm [&_button]:bg-[#1d3952] [&_button]:px-s3 [&_button]:py-s2 [&_button]:text-text',
        className,
      )}
      {...props}
    />
  );
}
