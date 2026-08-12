import { useEffect, useRef } from 'react';
import darkModeButtonAnimation from '../../assets/gifs/Dark Mode Button.svg';
import { cn } from '../../lib/cn';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleButtonProps {
  className?: string;
  iconOnly?: boolean;
}

function ThemeToggleButton({ className }: ThemeToggleButtonProps) {
  const { isLightTheme, toggleTheme } = useTheme();
  const animationTimeoutRef = useRef<number | null>(null);
  const animationRef = useRef<HTMLObjectElement>(null);

  const getAnimation = () => animationRef.current?.contentDocument?.querySelector('svg') as (SVGSVGElement & {
    pauseAnimations?: () => void;
    unpauseAnimations?: () => void;
    setCurrentTime?: (seconds: number) => void;
  }) | null;

  const freezeAnimationAt = (theme: 'dark' | 'light') => {
    const animation = getAnimation();
    if (!animation) return;
    animation.setCurrentTime?.(theme === 'dark' ? 3 : 0);
    animation.pauseAnimations?.();
  };

  useEffect(() => () => {
    if (animationTimeoutRef.current) window.clearTimeout(animationTimeoutRef.current);
  }, []);

  const handleThemeToggle = () => {
    const nextTheme = isLightTheme ? 'dark' : 'light';
    const animation = getAnimation();
    if (animationTimeoutRef.current) window.clearTimeout(animationTimeoutRef.current);
    animation?.setCurrentTime?.(nextTheme === 'dark' ? 0.5 : 5);
    animation?.unpauseAnimations?.();
    animationTimeoutRef.current = window.setTimeout(() => freezeAnimationAt(nextTheme), 1800);
    toggleTheme();
  };

  return (
    <button
      type="button"
      onClick={handleThemeToggle}
      role="switch"
      aria-checked={!isLightTheme}
      className={cn(
        'inline-flex h-12 w-[108px] items-center justify-center overflow-hidden rounded-full border border-border bg-card p-1 text-sm font-semibold text-text transition-colors hover:border-muted hover:bg-surface-2',
        className,
      )}
      aria-label={isLightTheme ? 'Ativar tema escuro' : 'Ativar tema claro'}
      title={isLightTheme ? 'Ativar tema escuro' : 'Ativar tema claro'}
    >
      <object
        ref={animationRef}
        data={darkModeButtonAnimation}
        type="image/svg+xml"
        aria-hidden="true"
        tabIndex={-1}
        onLoad={() => freezeAnimationAt(isLightTheme ? 'light' : 'dark')}
        className="pointer-events-none h-full w-full"
      />
      <span className="sr-only">{isLightTheme ? 'Tema claro ativo' : 'Tema escuro ativo'}</span>
    </button>
  );
}

export default ThemeToggleButton;
