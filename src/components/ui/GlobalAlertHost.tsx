import { AlertTriangle, CircleHelp, MessageSquareText, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DialogAlertOptions,
  DialogConfirmOptions,
  DialogPromptOptions,
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

type PromptQueueItem = {
  id: number;
  type: 'prompt';
  title: string;
  message: string;
  label: string;
  placeholder: string;
  initialValue: string;
  confirmLabel: string;
  cancelLabel: string;
  required: boolean;
  resolve: (value: string | null) => void;
};

type DialogQueueItem = AlertQueueItem | ConfirmQueueItem | PromptQueueItem;

function GlobalAlertHost() {
  const [queue, setQueue] = useState<DialogQueueItem[]>([]);
  const [promptValue, setPromptValue] = useState('');
  const idRef = useRef(0);
  const originalAlertRef = useRef<typeof window.alert | null>(null);

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

  const enqueuePrompt = useCallback((message: string, options?: DialogPromptOptions) => (
    new Promise<string | null>((resolve) => {
      idRef.current += 1;
      const item: PromptQueueItem = {
        id: idRef.current,
        type: 'prompt',
        title: options?.title || 'Informação necessária',
        message,
        label: options?.label || 'Resposta',
        placeholder: options?.placeholder || '',
        initialValue: options?.initialValue || '',
        confirmLabel: options?.confirmLabel || 'Continuar',
        cancelLabel: options?.cancelLabel || 'Cancelar',
        required: options?.required ?? false,
        resolve,
      };
      setQueue((prev) => [...prev, item]);
    })
  ), []);

  const resolveCurrent = useCallback((result?: boolean | string | null) => {
    setQueue((prev) => {
      if (!prev.length) return prev;
      const [current, ...rest] = prev;
      if (current.type === 'confirm') {
        current.resolve(Boolean(result));
      } else if (current.type === 'prompt') {
        current.resolve(typeof result === 'string' ? result : null);
      } else {
        current.resolve();
      }
      return rest;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    originalAlertRef.current = window.alert.bind(window);
    window.alert = (message?: any) => {
      const text = message == null ? '' : String(message);
      void enqueueAlert(text);
    };

    registerDialogHandlers({
      alert: enqueueAlert,
      confirm: enqueueConfirm,
      prompt: enqueuePrompt,
    });

    return () => {
      if (originalAlertRef.current) {
        window.alert = originalAlertRef.current;
      }
      unregisterDialogHandlers();
    };
  }, [enqueueAlert, enqueueConfirm, enqueuePrompt]);

  const current = queue[0] || null;

  useEffect(() => {
    setPromptValue(current?.type === 'prompt' ? current.initialValue : '');
  }, [current]);

  useEffect(() => {
    if (!current) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      resolveCurrent(current.type === 'confirm' ? false : current.type === 'prompt' ? null : undefined);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, resolveCurrent]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[3000] grid place-items-center bg-slate-950/75 p-3 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby={`global-dialog-title-${current.id}`} className="w-full max-w-[480px] overflow-hidden rounded-2xl border border-border bg-surface text-text shadow-[var(--shadow-3)]">
        <div className="flex items-start gap-3 border-b border-border bg-card p-4">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${current.type === 'confirm' && current.tone === 'danger' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200' : current.type === 'prompt' ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200' : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200'}`}>
            {current.type === 'alert' ? <AlertTriangle className="h-5 w-5" /> : current.type === 'prompt' ? <MessageSquareText className="h-5 w-5" /> : <CircleHelp className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1"><h3 id={`global-dialog-title-${current.id}`} className="text-base font-black text-text">{current.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">{current.message}</p></div>
          <button type="button" onClick={() => resolveCurrent(current.type === 'confirm' ? false : current.type === 'prompt' ? null : undefined)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted/40" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        {current.type === 'prompt' ? (
          <div className="p-4 pb-0">
            <label className="text-xs font-bold uppercase tracking-wide text-muted" htmlFor={`global-dialog-input-${current.id}`}>{current.label}</label>
            <textarea id={`global-dialog-input-${current.id}`} autoFocus rows={3} value={promptValue} onChange={(event) => setPromptValue(event.target.value)} placeholder={current.placeholder} className="mt-2 w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
          </div>
        ) : null}
        <div className="flex justify-end p-4">
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
                  ? 'h-10 rounded-md border border-danger bg-danger px-4 text-sm font-semibold text-white'
                  : 'h-10 rounded-md border border-accent-strong bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong'}
              >
                {current.confirmLabel}
              </button>
            </div>
          ) : current.type === 'prompt' ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => resolveCurrent(null)} className="h-10 rounded-lg border border-border bg-surface-2 px-4 text-sm font-semibold text-text hover:bg-muted/40">{current.cancelLabel}</button>
              <button type="button" disabled={current.required && !promptValue.trim()} onClick={() => resolveCurrent(promptValue.trim())} className="h-10 rounded-lg border border-violet-700 bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">{current.confirmLabel}</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => resolveCurrent()}
              className="h-10 rounded-md border border-accent-strong bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong"
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
