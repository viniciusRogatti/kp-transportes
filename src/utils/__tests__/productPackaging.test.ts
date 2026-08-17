import { parseUnitsPerBoxFromDescription } from '../productPackaging';

describe('parseUnitsPerBoxFromDescription', () => {
  it.each([
    ['KIT PAELLA CONG PCT 400GR CX 20UN', 20],
    ['GELATO POTE 490ML CX C/ 8UN *** 16,00 POTE(S)', 8],
    ['BOMBOM SORVETE CX 8 POTES 144G', 8],
    ['PICOLE 70G CX C/ 18 *** 18,00 UNIDADE(S)', 18],
    ['BOMBOM DE SORVETE CX 12 BOXES 90 G', 12],
    ['BOMBOM DE SORVETE 12X90G', 12],
  ])('extrai %s', (description, expected) => {
    expect(parseUnitsPerBoxFromDescription(description)).toBe(expected);
  });

  it('nao inventa embalagem para produto por peso', () => {
    expect(parseUnitsPerBoxFromDescription('SALMAO EVISCERADO KG')).toBeNull();
  });
});
