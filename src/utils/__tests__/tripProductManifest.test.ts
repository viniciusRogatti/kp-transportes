import { IDanfe, ITripNote } from '../../types/types';
import { buildTripProductManifest, isVariableWeightSalmon } from '../tripProductManifest';

const buildDanfe = (overrides: Partial<IDanfe>): IDanfe => ({
  customer_id: 'customer-1',
  company_id: 1,
  invoice_number: '100',
  barcode: '100',
  invoice_date: '2026-07-13',
  departure_time: '',
  total_quantity: 1,
  gross_weight: '10',
  net_weight: '9',
  total_value: '100',
  created_at: '2026-07-13T12:00:00.000Z',
  updated_at: '2026-07-13T12:00:00.000Z',
  company: { id: 1, code: 'mar_e_rio', name: 'MAR E RIO' },
  Customer: {
    name_or_legal_entity: 'Cliente A',
    phone: null,
    address: null,
    city: 'Santos',
    cnpj_or_cpf: 'customer-1',
  },
  DanfeProducts: [],
  ...overrides,
});

const buildNote = (invoiceNumber: string, companyId = 1): ITripNote => ({
  company_id: companyId,
  invoice_number: invoiceNumber,
  status: 'assigned',
  order: 1,
  city: 'Santos',
  customer_name: 'Cliente A',
  gross_weight: '10',
});

describe('tripProductManifest', () => {
  it('separa salmao e file de salmao variaveis por cliente sem incluir itens fechados em CX', () => {
    expect(isVariableWeightSalmon('SALMAO EVISC RESFRIADO PREMIUM 10/12', 'KG')).toBe(true);
    expect(isVariableWeightSalmon('FILE DE SALMAO C/PELE VAR CX 15KG', 'KG')).toBe(true);
    expect(isVariableWeightSalmon('BOLINHO DE SALMAO CX 6UN', 'CX')).toBe(false);

    const danfe = buildDanfe({
      DanfeProducts: [
        {
          company_id: 1,
          product_id: 'SAL-1',
          quantity: 12.5,
          price: '1',
          total_price: '12.5',
          type: 'KG',
          Product: { code: 'SAL-1', description: 'SALMAO EVISC RESFRIADO PREMIUM 10/12', price: '1', type: 'KG' },
        },
        {
          company_id: 1,
          product_id: 'BOL-1',
          quantity: 2,
          price: '1',
          total_price: '2',
          type: 'CX',
          Product: { code: 'BOL-1', description: 'BOLINHO DE SALMAO CX 6UN', price: '1', type: 'CX' },
        },
      ],
    });

    const manifest = buildTripProductManifest([buildNote('100')], [danfe]);
    expect(manifest.salmonSeparations).toEqual([
      expect.objectContaining({
        companyName: 'MAR E RIO',
        customerName: 'Cliente A',
        customerDocument: 'customer-1',
        code: 'SAL-1',
        quantity: 12.5,
        type: 'KG',
      }),
    ]);
    expect(manifest.products).toEqual([
      expect.objectContaining({ code: 'BOL-1', quantity: 2, type: 'CX' }),
    ]);
  });

  it('nao mistura file de salmao de empresas diferentes para o mesmo cliente', () => {
    const marERioDanfe = buildDanfe({
      invoice_number: '101',
      DanfeProducts: [{
        company_id: 1,
        product_id: 'FILE-1',
        quantity: 10,
        price: '1',
        total_price: '10',
        type: 'KG',
        Product: { code: 'FILE-1', description: 'FILE DE SALMAO C/ PELE', price: '1', type: 'KG' },
      }],
    });
    const brazilianFishDanfe = buildDanfe({
      company_id: 2,
      invoice_number: '202',
      company: { id: 2, code: 'brazilian_fish', name: 'BRAZILIAN FISH' },
      DanfeProducts: [{
        company_id: 2,
        product_id: 'FILE-1',
        quantity: 8,
        price: '1',
        total_price: '8',
        type: 'KG',
        Product: { code: 'FILE-1', description: 'FILE DE SALMAO C/ PELE', price: '1', type: 'KG' },
      }],
    });

    const manifest = buildTripProductManifest(
      [buildNote('101', 1), buildNote('202', 2)],
      [marERioDanfe, brazilianFishDanfe],
    );

    expect(manifest.salmonSeparations).toEqual([
      expect.objectContaining({ companyName: 'BRAZILIAN FISH', customerDocument: 'customer-1', quantity: 8 }),
      expect.objectContaining({ companyName: 'MAR E RIO', customerDocument: 'customer-1', quantity: 10 }),
    ]);
  });

  it('para a PRONTO lista apenas NF e quantidade de caixas do XML', () => {
    const danfe = buildDanfe({
      company_id: 3,
      invoice_number: '6678',
      total_quantity: 4,
      company: { id: 3, code: 'pronto', name: 'PRONTO' },
      DanfeProducts: [
        {
          company_id: 3,
          product_id: 'MARMITA',
          quantity: 18,
          price: '1',
          total_price: '18',
          type: 'UND',
          Product: { code: 'MARMITA', description: 'MARMITAS', price: '1', type: 'UND' },
        },
      ],
    });

    const prontoNote = { ...buildNote('6678', 3), company_code: 'pronto', box_quantity: 3 };
    const manifest = buildTripProductManifest([prontoNote], [danfe]);
    expect(manifest.prontoBoxes).toEqual([
      expect.objectContaining({ invoiceNumber: '6678', boxQuantity: 3 }),
    ]);
    expect(manifest.products).toEqual([]);
    expect(manifest.salmonSeparations).toEqual([]);
  });
});
