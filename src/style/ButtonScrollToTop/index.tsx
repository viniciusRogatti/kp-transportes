import { DetailedHTMLProps, ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface IButtonScrollToTopStyle {
  isVisible: boolean;
}

type Props = DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> & IButtonScrollToTopStyle;

export function ButtonScrollToTopStyle({ isVisible, className, ...props }: Props) {
  return (
    <button
      className={cn(
        'scroll-to-top-btn fixed right-4 z-[1185] grid h-11 w-11 place-items-center rounded-2xl border border-accent/50',
        'bg-gradient-to-b from-[#1674d8] to-[#0157a3] text-white shadow-[0_12px_24px_rgba(1,87,163,0.45)]',
        'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(1,87,163,0.5)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
        isVisible
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0',
        className,
      )}
      {...props}
    />
  );
}
