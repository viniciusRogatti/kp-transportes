import { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        'rounded-lg border border-border bg-surface/78 p-4 shadow-elevated backdrop-blur-[1px]',
        className,
      )}
      {...props}
    />
  );
}

export default Card;
