import { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        'rounded-lg border border-border bg-surface p-4 shadow-soft',
        className,
      )}
      {...props}
    />
  );
}

export default Card;
