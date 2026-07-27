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

export const getBacklogAgeDays = (row: IReceiptBacklogRow): number => (
  Math.max(0, Number(row.age_days || 0))
);

export const isTreatmentOverdue = (ageDays: number): boolean => (
  ageDays > TREATMENT_OVERDUE_AFTER_DAYS
);
