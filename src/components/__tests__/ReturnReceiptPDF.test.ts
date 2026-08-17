import { formatReturnQuantity } from '../../utils/returnPdfFormatting';

describe('ReturnReceiptPDF', () => {
  it('remove residuos de ponto flutuante das quantidades', () => {
    expect(formatReturnQuantity(54.900000000000006)).toBe('54,9');
    expect(formatReturnQuantity(113.66000000000001)).toBe('113,66');
  });

  it('preserva ate tres casas decimais significativas', () => {
    expect(formatReturnQuantity(9.43)).toBe('9,43');
    expect(formatReturnQuantity(20)).toBe('20');
    expect(formatReturnQuantity(0.125)).toBe('0,125');
  });
});
