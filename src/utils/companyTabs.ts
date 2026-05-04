import { IDanfe, ICustomer, IProduct } from '../types/types';

export const COMPANY_TAB_ORDER = ['mar_e_rio', 'brazilian_fish', 'pronto'] as const;

export const COMPANY_LABELS: Record<string, string> = {
  all: 'Todas',
  mar_e_rio: 'MAR E RIO',
  brazilian_fish: 'BRASFISH',
  pronto: 'PRONTO',
};

export const resolveDanfeCompanyCode = (danfe: IDanfe) => String(danfe.company?.code || '').trim().toLowerCase();
export const resolveProductCompanyCode = (product: IProduct) => String(product.company?.code || '').trim().toLowerCase();
export const resolveCustomerCompanyCode = (customer: ICustomer) => String(customer.company?.code || '').trim().toLowerCase();

