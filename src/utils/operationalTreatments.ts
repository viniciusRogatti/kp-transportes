import { IOccurrence, IReceiptBacklogRow } from '../types/types';

export const TREATMENT_OVERDUE_AFTER_DAYS = 3;

export const getOccurrenceAgeDays = (occurrence: IOccurrence): number => {
  const businessAge = Number(occurrence.age_business_days);
  if (Number.isFinite(businessAge)) {
    return Math.max(0, businessAge);
  }

  const createdAt = new Date(occurrence.created_at);
  if (Number.isNaN(createdAt.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86_400_000));
};

const toSaoPauloDateKey = (value: string | number | Date): string | null => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
};

const calendarDaysBetween = (startValue: string, endValue: Date): number | null => {
  const startKey = toSaoPauloDateKey(startValue);
  const endKey = toSaoPauloDateKey(endValue);
  if (!startKey || !endKey) return null;
  const toUtcDay = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.max(0, Math.floor((toUtcDay(endKey) - toUtcDay(startKey)) / 86_400_000));
};

export const getBacklogAgeDays = (row: IReceiptBacklogRow): number => {
  if (row.age_reference_at) {
    const calculatedAge = calendarDaysBetween(row.age_reference_at, new Date(Date.now()));
    if (calculatedAge !== null) return calculatedAge;
  }
  return Math.max(0, Number(row.age_days || 0));
};

export const isTreatmentOverdue = (ageDays: number): boolean => (
  ageDays > TREATMENT_OVERDUE_AFTER_DAYS
);
