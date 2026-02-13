import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/cn';

type ButtonTone = 'primary' | 'secondary' | 'danger' | 'outline' | 'highlight';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
}

const toneMap: Record<ButtonTone, string> = {
  primary: 'bg-gradient-to-r from-accent to-accent-strong text-white shadow-soft hover:brightness-110',
  secondary: 'bg-surface-2/90 text-text border border-border hover:bg-surface-2',
  danger: 'bg-danger/90 text-white border border-danger/70 hover:bg-danger',
  outline: 'border border-border bg-surface/60 text-text hover:bg-surface-2',
  highlight: 'bg-gradient-to-r from-warning to-[#ff7a18] text-[#1f1300] shadow-soft hover:brightness-105',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, tone = 'primary', ...props }, ref) => (
  <button
    ref={ref}
      className={cn(
      'inline-flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
      toneMap[tone],
      className,
    )}
    {...props}
  />
));

Button.displayName = 'Button';

export default Button;
