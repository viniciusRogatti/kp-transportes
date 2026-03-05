import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DialogAlertOptions,
  DialogConfirmOptions,
  registerDialogHandlers,
  unregisterDialogHandlers,
} from '../../utils/dialog';

type AlertQueueItem = {
  id: number;
  type: 'alert';
  title: string;
  message: string;
  okLabel: string;
  resolve: () => void;
};

type ConfirmQueueItem = {
  id: number;
  type: 'confirm';
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: 'default' | 'danger';
  resolve: (value: boolean) => void;
};

type DialogQueueItem = AlertQueueItem | ConfirmQueueItem;

function GlobalAlertHost() {
  const [queue, setQueue] = useState<DialogQueueItem[]>([]);
  const idRef = useRef(0);
  const originalAlertRef = useRef<typeof window.alert | null>(null);
  const originalConfirmRef = useRef<typeof window.confirm | null>(null);

  const enqueueAlert = useCallback((message: string, options?: DialogAlertOptions) => (
    new Promise<void>((resolve) => {
      idRef.current += 1;
      const item: AlertQueueItem = {
        id: idRef.current,
        type: 'alert',
        title: options?.title || 'Atenção',
        message,
        okLabel: options?.okLabel || 'Entendi',
        resolve,
      };
      setQueue((prev) => [...prev, item]);
    })
  ), []);

  const enqueueConfirm = useCallback((message: string, options?: DialogConfirmOptions) => (
    new Promise<boolean>((resolve) => {
      idRef.current += 1;
      const item: ConfirmQueueItem = {
        id: idRef.current,
        type: 'confirm',
        title: options?.title || 'Confirmação',
        message,
        confirmLabel: options?.confirmLabel || 'Confirmar',
        cancelLabel: options?.cancelLabel || 'Cancelar',
        tone: options?.tone || 'default',
        resolve,
      };
      setQueue((prev) => [...prev, item]);
    })
  ), []);

  const resolveCurrent = useCallback((result?: boolean) => {
    setQueue((prev) => {
      if (!prev.length) return prev;
      const [current, ...rest] = prev;
      if (current.type === 'confirm') {
        current.resolve(Boolean(result));
      } else {
        current.resolve();
      }
      return rest;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    originalAlertRef.current = window.alert.bind(window);
    originalConfirmRef.current = window.confirm.bind(window);

    window.alert = (message?: any) => {
      const text = message == null ? '' : String(message);
      void enqueueAlert(text);
    };

    registerDialogHandlers({
      alert: enqueueAlert,
      confirm: enqueueConfirm,
    });

    return () => {
      if (originalAlertRef.current) {
        window.alert = originalAlertRef.current;
      }
      if (originalConfirmRef.current) {
        window.confirm = originalConfirmRef.current;
      }
      unregisterDialogHandlers();
    };
  }, [enqueueAlert, enqueueConfirm]);

  const current = queue[0] || null;

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[3000] grid place-items-center bg-black/70 p-3 backdrop-blur-[2px]">
      <div className="w-full max-w-[460px] rounded-lg border border-border bg-surface p-4 text-text shadow-[var(--shadow-3)]">
        <h3 className="text-base font-semibold text-text">{current.title}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{current.message}</p>
        <div className="mt-4 flex justify-end">
          {current.type === 'confirm' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => resolveCurrent(false)}
                className="h-10 rounded-md border border-border bg-surface-2 px-4 text-sm font-semibold text-text"
              >
                {current.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => resolveCurrent(true)}
                className={current.tone === 'danger'
                  ? 'h-10 rounded-md border border-rose-600/65 bg-gradient-to-r from-rose-500 to-rose-600 px-4 text-sm font-semibold text-white'
                  : 'h-10 rounded-md border border-white/15 bg-gradient-to-r from-accent to-accent-strong px-4 text-sm font-semibold text-[#04131e]'}
              >
                {current.confirmLabel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => resolveCurrent()}
              className="h-10 rounded-md border border-white/15 bg-gradient-to-r from-accent to-accent-strong px-4 text-sm font-semibold text-[#04131e]"
            >
              {current.okLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GlobalAlertHost;
