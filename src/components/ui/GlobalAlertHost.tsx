import { useEffect, useRef, useState } from 'react';

interface AlertItem {
  id: number;
  message: string;
}

function GlobalAlertHost() {
  const [queue, setQueue] = useState<AlertItem[]>([]);
  const idRef = useRef(0);
  const originalAlertRef = useRef<typeof window.alert | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    originalAlertRef.current = window.alert.bind(window);

    window.alert = (message?: any) => {
      const text = message == null ? '' : String(message);
      idRef.current += 1;
      setQueue((prev) => [...prev, { id: idRef.current, message: text }]);
    };

    return () => {
      if (originalAlertRef.current) {
        window.alert = originalAlertRef.current;
      }
    };
  }, []);

  const current = queue[0] || null;

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[3000] grid place-items-center bg-black/70 p-3 backdrop-blur-[2px]">
      <div className="w-full max-w-[460px] rounded-lg border border-border bg-surface p-4 text-text shadow-[var(--shadow-3)]">
        <h3 className="text-base font-semibold text-text">Atenção</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{current.message}</p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setQueue((prev) => prev.slice(1))}
            className="h-10 rounded-md border border-white/15 bg-gradient-to-r from-accent to-accent-strong px-4 text-sm font-semibold text-[#04131e]"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

export default GlobalAlertHost;
