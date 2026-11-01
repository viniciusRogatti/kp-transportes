import { useMemo, type CSSProperties } from 'react';

type DriverProgress = {
  driver_id: number | null;
  driver_name: string;
  color: string;
  color_order?: number | null;
  total_deliveries: number;
  completed_deliveries: number;
};

export const progressPercentage = (completed: number, total: number) => total > 0
  ? completed >= total ? 100 : Math.min(99, Math.round(completed / total * 100))
  : 0;

export function DriverProgressStrip({ drivers, selectedDriverId, onSelect }: {
  drivers: DriverProgress[];
  selectedDriverId: number | null;
  onSelect: (driverId: number) => void;
}) {
  const entries = useMemo(() => {
    const grouped = new Map<number, DriverProgress>();
    drivers.forEach(driver => {
      if (!driver.driver_id) return;
      const previous = grouped.get(driver.driver_id);
      grouped.set(driver.driver_id, previous ? { ...previous,
        total_deliveries: previous.total_deliveries + driver.total_deliveries,
        completed_deliveries: previous.completed_deliveries + driver.completed_deliveries,
      } : { ...driver });
    });
    return Array.from(grouped.values()).sort((a, b) =>
      (a.color_order ?? Number.MAX_SAFE_INTEGER) - (b.color_order ?? Number.MAX_SAFE_INTEGER)
      || Number(a.driver_id) - Number(b.driver_id));
  }, [drivers]);
  return <section aria-label="Motoristas no mapa" className="monitoring-driver-strip w-full rounded-2xl border border-border bg-surface p-2">
    <div className="monitoring-strip-heading"><h3>Motoristas <span>{entries.length}</span></h3><p>Cor identifica o motorista · anel indica finalização</p></div>
    {!entries.length ? <p className="p-2 text-sm text-muted">Nenhuma viagem com motorista neste recorte.</p> : null}
    <div className="monitoring-driver-grid" style={{ '--driver-columns': Math.min(12, Math.max(10, Math.ceil(entries.length / 2))) } as CSSProperties}>
      {entries.map(driver => {
        const total = Math.max(0, Math.floor(driver.total_deliveries));
        const completed = Math.max(0, Math.min(total, driver.completed_deliveries));
        const percentage = progressPercentage(completed, total);
        const words = driver.driver_name.trim().split(/\s+/);
        const initials = [words[0]?.[0], words.length > 1 ? words[words.length - 1]?.[0] : ''].join('').toLocaleUpperCase('pt-BR') || '?';
        const label = `${driver.driver_name} · ${percentage}% finalizado · ${completed} de ${total} NFs`;
        const finished = total > 0 && completed >= total;
        return <button key={driver.driver_id} type="button" className="monitoring-driver-button" aria-label={`Centralizar ${label}`}
          style={{ '--driver-color': driver.color } as CSSProperties}
          aria-pressed={selectedDriverId === driver.driver_id} title={label} onClick={() => onSelect(driver.driver_id!)}>
          <span className="monitoring-driver-circle">
            <svg viewBox="0 0 64 64" aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="32" cy="32" r="27" fill="none" stroke="var(--color-border)" strokeWidth="5" />
              {completed > 0 ? <circle cx="32" cy="32" r="27" fill="none" stroke={finished ? '#16a34a' : driver.color} strokeWidth="5"
                pathLength={total} strokeDasharray={`${completed} ${total}`} /> : null}
              {total > 1 ? <circle cx="32" cy="32" r="27" fill="none" stroke="var(--color-surface)" strokeWidth="6"
                pathLength={total} strokeDasharray="0.06 0.94" strokeDashoffset="0.03" /> : null}
            </svg>
            <span className="monitoring-driver-initials">{initials}</span>
            <span className="monitoring-driver-percent">{percentage}%</span>
          </span>
          <span className="monitoring-driver-caption"><span className="monitoring-driver-color" aria-hidden="true" /><span className="monitoring-driver-name">{driver.driver_name}</span></span>
        </button>;
      })}
    </div>
  </section>;
}
