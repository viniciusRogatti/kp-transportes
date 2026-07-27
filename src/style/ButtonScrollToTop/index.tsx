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
        'scroll-to-top-btn fixed right-4 z-[1185] grid h-11 w-11 place-items-center rounded-md border border-accent-strong',
        'bg-accent text-white shadow-soft',
        'transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-elevated',
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
