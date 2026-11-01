import { Moon, Sun } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleButtonProps {
  className?: string;
  iconOnly?: boolean;
}

function ThemeToggleButton({ className, iconOnly = false }: ThemeToggleButtonProps) {
  const { isLightTheme, toggleTheme } = useTheme();
  const actionLabel = isLightTheme ? 'Ativar tema escuro' : 'Ativar tema claro';
  const Icon = isLightTheme ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isLightTheme}
      aria-label={actionLabel}
      title={actionLabel}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text transition-colors hover:border-muted hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none',
        iconOnly ? 'h-11 w-11 sm:h-10 sm:w-10' : 'min-h-[44px] gap-2.5 px-3 text-sm font-medium',
        className,
      )}
    >
      <Icon
        size={18}
        strokeWidth={1.75}
        aria-hidden="true"
        className={cn('shrink-0', isLightTheme ? 'text-indigo-600' : 'text-amber-300')}
      />
      {!iconOnly ? <span>{actionLabel}</span> : null}
      <span className="sr-only">{isLightTheme ? 'Tema claro ativo' : 'Tema escuro ativo'}</span>
    </button>
  );
}

export default ThemeToggleButton;
