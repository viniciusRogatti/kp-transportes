import { Moon, Sun } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleButtonProps {
  className?: string;
  iconOnly?: boolean;
}

function ThemeToggleButton({ className, iconOnly = false }: ThemeToggleButtonProps) {
  const { isLightTheme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface/80 px-3 text-sm font-semibold text-text transition hover:bg-surface-2',
        className,
      )}
      aria-label={isLightTheme ? 'Ativar tema escuro' : 'Ativar tema claro'}
      title={isLightTheme ? 'Ativar tema escuro' : 'Ativar tema claro'}
    >
      {isLightTheme ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      {!iconOnly ? (
        <span className="hidden sm:inline">
          {isLightTheme ? 'Tema escuro' : 'Tema claro'}
        </span>
      ) : null}
    </button>
  );
}

export default ThemeToggleButton;
