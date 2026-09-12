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

  return (
    <button
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isLightTheme}
      aria-label={actionLabel}
      title={`${actionLabel} · farol ${isLightTheme ? 'aceso' : 'apagado'}`}
      className={cn(
        'group inline-flex shrink-0 items-center justify-center gap-1 rounded-xl border border-border bg-card px-1.5 text-text transition-colors hover:border-accent hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none',
        iconOnly ? 'h-11 w-24 sm:w-[108px]' : 'h-12 min-w-[128px]',
        className,
      )}
    >
      <svg viewBox="0 0 72 40" fill="none" aria-hidden="true" className="h-10 w-[60px] sm:w-[72px] shrink-0">
        {/* A transição acompanha apenas mudanças de estado; não há animação ao montar. */}
        <g className="transition-opacity duration-300 motion-reduce:transition-none" opacity={isLightTheme ? 1 : 0}>
          <path d="M53 22L71 13V36L53 28Z" fill="#FBBF24" fillOpacity=".65" />
          <path d="M57 21L67 17M58 25H70M57 29L67 33" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M54 23L66 20V30L54 27Z" fill="#FDE68A" />
        </g>
        <path d="M5 10A3 3 0 018 7H32A3 3 0 0135 10V29H5V10Z" fill="currentColor" fillOpacity=".1" stroke="currentColor" strokeWidth="1.6" />
        <path d="M35 15H44L52 23V29H35V15Z" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M39 18H43L48 23H39V18Z" fill="currentColor" fillOpacity=".65" />
        <path d="M3 29H54M10 12H29M10 16H24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="14" cy="30" r="4" fill="var(--color-card, #152235)" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="43" cy="30" r="4" fill="var(--color-card, #152235)" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="14" cy="30" r="1.3" fill="currentColor" />
        <circle cx="43" cy="30" r="1.3" fill="currentColor" />
        <rect x="49" y="24" width="5" height="3" rx="1" stroke="currentColor" strokeWidth=".8"
          fill={isLightTheme ? '#FBBF24' : 'currentColor'}
          fillOpacity={isLightTheme ? 1 : .25}
          className="transition-colors duration-300 motion-reduce:transition-none" />
      </svg>
      <span className="grid h-5 w-5 shrink-0 place-items-center" aria-hidden="true">
        {isLightTheme ? <Sun size={17} className="text-amber-700" /> : <Moon size={17} className="text-text-accent" />}
      </span>
      <span className="sr-only">{isLightTheme ? 'Tema claro ativo, farol aceso' : 'Tema escuro ativo, farol apagado'}</span>
    </button>
  );
}

export default ThemeToggleButton;
