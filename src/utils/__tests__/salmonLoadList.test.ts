import { IDanfe, ITrip } from '../../types/types';
import { buildSalmonLoadList, calculateSalmonBoxes } from '../salmonLoadList';

const buildDanfe = (invoiceNumber: string, customerName: string, document: string, weight: number): IDanfe => ({
  customer_id: document,
  company_id: 1,
  invoice_number: invoiceNumber,
  barcode: invoiceNumber,
  invoice_date: '2026-07-13',
  departure_time: '',
  total_quantity: 1,
  gross_weight: String(weight),
  net_weight: String(weight),
  total_value: '100',
  created_at: '2026-07-13T12:00:00.000Z',
  updated_at: '2026-07-13T12:00:00.000Z',
  company: { id: 1, code: 'mar_e_rio', name: 'MAR E RIO' },
  Customer: {
    name_or_legal_entity: customerName,
    phone: null,
    address: null,
    city: 'Santos',
    cnpj_or_cpf: document,
  },
  DanfeProducts: [{
    company_id: 1,
    product_id: 'SAL-1',
    quantity: weight,
    price: '1',
    total_price: String(weight),
    type: 'KG',
    Product: {
      code: 'SAL-1',
      description: 'SALMAO EVISC RESFRIADO PREMIUM',
      price: '1',
      type: 'KG',
    },
  }],
});

const buildTrip = (id: number, driverId: number, driverName: string, invoices: string[]): ITrip => ({
  id,
  driver_id: driverId,
  car_id: 1,
  created_at: '2026-07-13T12:00:00.000Z',
  updated_at: '2026-07-13T12:00:00.000Z',
  date: '13-07-2026',
  gross_weight: 137,
  Driver: { id: driverId, name: driverName },
  Car: { id: 1, model: 'Truck', license_plate: 'ABC1D23' },
  TripNotes: invoices.map((invoiceNumber, index) => ({
    company_id: 1,
    invoice_number: invoiceNumber,
    status: 'assigned',
    order: index + 1,
    city: 'Santos',
    customer_name: 'Cliente',
    gross_weight: '10',
  })),
});

describe('salmonLoadList', () => {
  it('calcula caixas pela parte inteira de 30 kg e mantem no minimo uma caixa', () => {
    expect(calculateSalmonBoxes(137)).toBe(4);
    expect(calculateSalmonBoxes(29.9)).toBe(1);
    expect(calculateSalmonBoxes(0)).toBe(0);
  });

  it('soma o salmao do mesmo cliente por motorista antes de calcular as caixas', () => {
    const trips = [buildTrip(1, 7, 'Motorista A', ['100', '101'])];
    const danfes = [
      buildDanfe('100', 'Cliente A', '12345678000190', 70),
      buildDanfe('101', 'Cliente A', '12345678000190', 67),
    ];

    expect(buildSalmonLoadList(trips, danfes)).toEqual([{
      driverId: 7,
      driverName: 'Motorista A',
      tripIds: [1],
      rows: [{
        customerName: 'Cliente A',
        customerDocument: '12345678000190',
        weightKg: 137,
        boxQuantity: 4,
        invoiceNumbers: ['100', '101'],
      }],
    }]);
  });
});
