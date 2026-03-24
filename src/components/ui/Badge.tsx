import { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { getSemanticToneClassName, SemanticTone } from '../../utils/statusStyles';

type BadgeTone = SemanticTone;

const toneMap: Record<BadgeTone, string> = {
  neutral: getSemanticToneClassName('neutral'),
  info: getSemanticToneClassName('info'),
  success: getSemanticToneClassName('success'),
  warning: getSemanticToneClassName('warning'),
  danger: getSemanticToneClassName('danger'),
  redelivery: getSemanticToneClassName('redelivery'),
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold', toneMap[tone], className)}
      {...props}
    />
  );
}

export default Badge;
