import { Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import darkModeButtonAnimation from '../../assets/gifs/Dark Mode Button.svg';
import { cn } from '../../lib/cn';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleButtonProps {
  className?: string;
  iconOnly?: boolean;
}

function ThemeToggleButton({ className, iconOnly = false }: ThemeToggleButtonProps) {
  const { isLightTheme, toggleTheme } = useTheme();
  const [animationKey, setAnimationKey] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (animationTimeoutRef.current) window.clearTimeout(animationTimeoutRef.current);
  }, []);

  const handleThemeToggle = () => {
    if (animationTimeoutRef.current) window.clearTimeout(animationTimeoutRef.current);
    setAnimationKey((current) => current + 1);
    setIsAnimating(true);
    animationTimeoutRef.current = window.setTimeout(() => setIsAnimating(false), 8200);
    toggleTheme();
  };

  return (
    <button
      type="button"
      onClick={handleThemeToggle}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-text transition-colors hover:border-muted hover:bg-surface-2',
        className,
      )}
      aria-label={isLightTheme ? 'Ativar tema escuro' : 'Ativar tema claro'}
      title={isLightTheme ? 'Ativar tema escuro' : 'Ativar tema claro'}
    >
      {isAnimating ? (
        <img
          key={animationKey}
          src={darkModeButtonAnimation}
          alt=""
          aria-hidden="true"
          className="h-6 w-10 object-contain"
        />
      ) : isLightTheme ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      {!iconOnly ? (
        <span className="hidden sm:inline">
          {isLightTheme ? 'Tema escuro' : 'Tema claro'}
        </span>
      ) : null}
    </button>
  );
}

export default ThemeToggleButton;
