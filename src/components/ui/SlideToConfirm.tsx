import { ArrowRight, Check, Loader2 } from 'lucide-react';
import useSlideToConfirm from '../../hooks/useSlideToConfirm';
import { cn } from '../../lib/cn';

type SlideToConfirmProps = {
  label: string;
  confirmedLabel: string;
  threshold?: number;
  onConfirm: () => Promise<void> | void;
  disabled?: boolean;
  className?: string;
  onError?: (error: unknown) => void;
  hideText?: boolean;
  persistConfirmed?: boolean;
};

function SlideToConfirm({
  label,
  confirmedLabel,
  threshold = 0.5,
  onConfirm,
  disabled = false,
  className,
  onError,
  hideText = false,
  persistConfirmed = true,
}: SlideToConfirmProps) {
  const {
    trackRef,
    progressPercent,
    thumbOffsetPx,
    shouldAnimate,
    isDragging,
    isLoading,
    isConfirmed,
    isInteractionDisabled,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleKeyDown,
  } = useSlideToConfirm({
    threshold,
    disabled,
    onConfirm,
    onError,
    persistConfirmed,
  });

  const activeLabel = isConfirmed ? confirmedLabel : label;

  const thumbTransition = shouldAnimate ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
  const fillTransition = shouldAnimate ? 'width 220ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none';

  return (
    <div className={cn('w-full', className)}>
      <div
        ref={trackRef}
        role="slider"
        aria-label={isConfirmed ? confirmedLabel : label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
        aria-valuetext={activeLabel}
        aria-disabled={isInteractionDisabled}
        tabIndex={isInteractionDisabled ? -1 : 0}
        className={cn(
          'relative h-10 w-full select-none touch-pan-y overflow-hidden rounded-xl border outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          isConfirmed
            ? 'border-emerald-400/60 bg-emerald-950/35'
            : 'border-emerald-400/50 bg-[linear-gradient(135deg,rgba(6,22,16,0.96)_0%,rgba(10,36,26,0.9)_100%)]',
          !isInteractionDisabled && 'cursor-grab active:cursor-grabbing',
          isDragging && 'ring-2 ring-accent/45',
          isInteractionDisabled && !isConfirmed && 'opacity-85',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0',
            isConfirmed
              ? 'bg-gradient-to-r from-emerald-400/45 to-emerald-300/30'
              : 'bg-gradient-to-r from-emerald-400/45 to-emerald-300/30',
          )}
          style={{ width: `${progressPercent}%`, transition: fillTransition }}
        />

        {!isConfirmed && !isLoading && (
          <div className="pointer-events-none absolute inset-y-0 right-3 z-[1] flex items-center gap-0.5 text-emerald-200/55">
            <ArrowRight className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
            <ArrowRight className="h-3.5 w-3.5 animate-pulse opacity-80 [animation-delay:140ms]" aria-hidden="true" />
            <ArrowRight className="h-3.5 w-3.5 animate-pulse opacity-65 [animation-delay:280ms]" aria-hidden="true" />
          </div>
        )}

        {!hideText && (
          <div className="pointer-events-none absolute inset-0 z-[1] flex items-center pl-11 pr-10">
            <span
              className={cn(
                'truncate text-[11px] font-semibold uppercase tracking-[0.04em]',
                isConfirmed ? 'text-emerald-100' : 'text-text-accent',
              )}
            >
              {activeLabel}
            </span>
          </div>
        )}

        <div
          className={cn(
            'absolute left-1 top-1 z-[2] grid h-8 w-8 place-items-center rounded-lg border shadow-[0_6px_14px_rgba(0,0,0,0.35)]',
            isConfirmed
              ? 'border-emerald-300/60 bg-emerald-400/25 text-emerald-100'
              : 'border-emerald-300/60 bg-emerald-400/20 text-emerald-100',
          )}
          style={{ transform: `translateX(${thumbOffsetPx}px)`, transition: thumbTransition }}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  );
}

export default SlideToConfirm;
