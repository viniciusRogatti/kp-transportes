import { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const toneMap: Record<BadgeTone, string> = {
  neutral: 'border-border bg-surface-2/80 text-text',
  info: 'border-info/50 bg-info/15 text-info',
  success: 'border-success/50 bg-success/15 text-success',
  warning: 'border-warning/50 bg-warning/15 text-warning',
  danger: 'border-danger/50 bg-danger/15 text-danger',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium', toneMap[tone], className)}
      {...props}
    />
  );
}

export default Badge;
