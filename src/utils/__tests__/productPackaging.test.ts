import { parseUnitsPerBoxFromDescription, parseKgPerBoxFromDescription } from '../productPackaging';

test.each([["FILE PCT 500G CX 20KG",20],["CX C/ 12,5 KG",12.5],["CAIXA DE 20 QUILOS",20],["CX 4X5KG",20],["CX 20X500G",10],["PCT 500G CX 20UN",null],["SALMAO KG",null],["CX 0KG",null],["CX 10KG OU CX 20KG",null]])('peso por caixa: %s', (description, expected) => {
  expect(parseKgPerBoxFromDescription(description as string)).toBe(expected);
});

describe('parseUnitsPerBoxFromDescription', () => {
  it.each([
    ['KIT PAELLA CONG PCT 400GR CX 20UN', 20],
    ['GELATO POTE 490ML CX C/ 8UN *** 16,00 POTE(S)', 8],
    ['BOMBOM SORVETE CX 8 POTES 144G', 8],
    ['PICOLE 70G CX C/ 18 *** 18,00 UNIDADE(S)', 18],
    ['BOMBOM DE SORVETE CX 12 BOXES 90 G', 12],
    ['BOMBOM DE SORVETE 12X90G', 12],
    ['LEITE SEMI PIRACANJUBA A2 12X1L EDGE', 12],
  ])('extrai %s', (description, expected) => {
    expect(parseUnitsPerBoxFromDescription(description)).toBe(expected);
  });

  it('nao inventa embalagem para produto por peso', () => {
    expect(parseUnitsPerBoxFromDescription('SALMAO EVISCERADO KG')).toBeNull();
    expect(parseUnitsPerBoxFromDescription('FILE DE TILAPIA S/PELE PCT 500G CX 15KG')).toBeNull();
  });
});
