import { ButtonHTMLAttributes } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

type IconButtonVariant = 'default' | 'danger';
type IconButtonSize = 'md' | 'lg';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const variantMap: Record<IconButtonVariant, string> = {
  default: 'border-border bg-surface/85 text-text hover:bg-surface-2',
  danger: 'border-danger/55 bg-danger/15 text-danger hover:bg-danger/25',
};

const sizeMap: Record<IconButtonSize, string> = {
  md: 'h-9 w-9 min-h-9 min-w-9',
  lg: 'h-10 w-10 min-h-10 min-w-10',
};

function IconButton({
  icon: Icon,
  label,
  variant = 'default',
  size = 'md',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      data-icon-button="true"
      className={cn(
        'inline-flex items-center justify-center rounded-xl border transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        sizeMap[size],
        variantMap[variant],
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export default IconButton;
