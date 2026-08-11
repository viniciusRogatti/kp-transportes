import { RefObject, useEffect, useState } from 'react';
import { cn } from '../lib/cn';

type ScrollHintProps = {
  scrollRef: RefObject<HTMLElement>;
  className?: string;
  label?: string;
};

/** Indica que ainda há conteúdo abaixo da área rolável informada. */
export function ScrollHint({
  scrollRef,
  className,
  label = 'Há mais conteúdo abaixo. Role para continuar.',
}: ScrollHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;

    const updateVisibility = () => {
      const remaining = element.scrollHeight - element.clientHeight - element.scrollTop;
      setVisible(remaining > 12);
    };

    updateVisibility();
    element.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility);
    const observer = new ResizeObserver(updateVisibility);
    observer.observe(element);

    return () => {
      element.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('resize', updateVisibility);
      observer.disconnect();
    };
  }, [scrollRef]);

  if (!visible) return null;

  return (
    <div className={cn('scroll-hint fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-sky-200 bg-surface/95 px-3 py-2 text-xs font-bold text-sky-800 shadow-lg backdrop-blur dark:border-sky-800 dark:text-sky-200', className)} role="status">
      <span className="scroll-hint__mouse" aria-hidden="true" />
      <span className="hidden sm:inline">Role para ver mais</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
