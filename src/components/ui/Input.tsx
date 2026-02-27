import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-10 w-full rounded-sm border border-accent/35 bg-card px-3 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/60',
      className,
    )}
    {...props}
  />
));

Input.displayName = 'Input';

export default Input;
