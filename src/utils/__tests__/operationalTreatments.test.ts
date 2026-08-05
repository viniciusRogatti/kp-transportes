import {
  getBacklogAgeDays,
  getOccurrenceAgeDays,
  isTreatmentOverdue,
  TREATMENT_OVERDUE_AFTER_DAYS,
} from '../operationalTreatments';
import { IOccurrence, IReceiptBacklogRow } from '../../types/types';

describe('regras da Central de Tratativas', () => {
  it('destaca somente itens que passaram de tres dias', () => {
    expect(TREATMENT_OVERDUE_AFTER_DAYS).toBe(3);
    expect(isTreatmentOverdue(3)).toBe(false);
    expect(isTreatmentOverdue(4)).toBe(true);
  });

  it('prioriza a idade em dias uteis informada pela ocorrencia', () => {
    const occurrence = {
      created_at: '2020-01-01T00:00:00.000Z',
      age_business_days: 2,
    } as IOccurrence;

    expect(getOccurrenceAgeDays(occurrence)).toBe(2);
  });

  it('normaliza idades invalidas ou negativas do backlog', () => {
    expect(getBacklogAgeDays({ age_days: -4 } as IReceiptBacklogRow)).toBe(0);
    expect(getBacklogAgeDays({ age_days: 5 } as IReceiptBacklogRow)).toBe(5);
  });

  it('recalcula o card desde a entrada operacional mesmo com idade antiga em cache', () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-08-04T15:00:00.000Z').getTime());

    expect(getBacklogAgeDays({
      age_days: 150,
      age_reference_at: '2026-08-01T12:00:00.000Z',
    } as IReceiptBacklogRow)).toBe(3);

    jest.restoreAllMocks();
  });
});
