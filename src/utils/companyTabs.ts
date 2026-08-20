import { IDanfe, ICustomer, IProduct } from '../types/types';

export const COMPANY_TAB_ORDER = [
  'mar_e_rio',
  'brazilian_fish',
  'vitalmar',
  'pronto',
  'piracanjuba',
  'grupo_horeca',
] as const;

export const COMPANY_LABELS: Record<string, string> = {
  all: 'Todas',
  mar_e_rio: 'MAR E RIO',
  brazilian_fish: 'BRASFISH',
  vitalmar: 'VITALMAR',
  pronto: 'PRONTO',
  piracanjuba: 'PIRACANJUBA',
  grupo_horeca: 'GRUPO HORECA',
  // Compatibilidade durante a transicao do codigo antigo no backend.
  bacio_di_latte: 'GRUPO HORECA',
};

export const resolveDanfeCompanyCode = (danfe: IDanfe) => String(danfe.company?.code || '').trim().toLowerCase();
export const resolveProductCompanyCode = (product: IProduct) => String(product.company?.code || '').trim().toLowerCase();
export const resolveCustomerCompanyCode = (customer: ICustomer) => String(customer.company?.code || '').trim().toLowerCase();
