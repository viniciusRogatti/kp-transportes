import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/cn';

type ButtonTone = 'primary' | 'secondary' | 'danger' | 'outline' | 'highlight';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
}

const toneMap: Record<ButtonTone, string> = {
  primary: 'border border-accent-strong bg-accent text-white shadow-soft hover:bg-accent-strong',
  secondary: 'border border-border bg-surface-2 text-text hover:border-muted hover:bg-card',
  danger: 'border border-danger bg-danger text-white hover:brightness-110',
  outline: 'border border-border bg-card text-text hover:border-muted hover:bg-surface-2',
  highlight: 'border border-warning bg-warning text-white shadow-soft hover:brightness-110',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, tone = 'primary', ...props }, ref) => (
  <button
    ref={ref}
      className={cn(
      'inline-flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
      toneMap[tone],
      className,
    )}
    {...props}
  />
));

Button.displayName = 'Button';

export default Button;
