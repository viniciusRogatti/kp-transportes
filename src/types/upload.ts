export type ImportErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'XML_PARSE_ERROR'
  | 'XML_STRUCTURE_INVALID'
  | 'XML_INVOICE_NUMBER_MISSING'
  | 'XML_ISSUER_DOCUMENT_MISSING'
  | 'XML_CUSTOMER_SECTION_MISSING'
  | 'XML_CUSTOMER_DOCUMENT_MISSING'
  | 'XML_CUSTOMER_NAME_MISSING'
  | 'XML_PRODUCTS_MISSING'
  | 'XML_PRODUCT_CODE_MISSING'
  | 'XML_PRODUCT_DESCRIPTION_MISSING'
  | 'XML_PRODUCT_QUANTITY_INVALID'
  | 'XML_ACCESS_KEY_MISSING'
  | 'XML_ISSUE_DATE_MISSING'
  | 'XML_ISSUE_DATE_INVALID'
  | 'MISSING_REQUIRED_FIELD'
  | 'DUPLICATE_INVOICE'
  | 'DB_CONSTRAINT_ERROR'
  | 'UNKNOWN_ERROR'
  | string;

export type UploadResultStatus = 'success' | 'error';

export interface IImportWarning {
  code: string;
  message: string;
}

export interface IImportErrorDetail {
  code: ImportErrorCode;
  message: string;
  details?: string;
  hint?: string;
  metadata?: Record<string, unknown>;
  stack?: string;
}

export interface IImportResultMeta {
  origin: string;
  invoiceNumber: string | null;
  createdProducts: number;
  updatedProducts: number;
  createdInvoices: number;
  updatedInvoices: number;
  ignoredInvoices: number;
}

export interface IImportResult {
  fileName: string;
  fileKey?: string | null;
  status: UploadResultStatus;
  warnings?: IImportWarning[];
  meta?: IImportResultMeta;
  error?: IImportErrorDetail;
}

export interface IImportedProduct {
  code: string;
  description: string;
  price: number;
  sourceFile: string;
  status?: 'new' | 'updated';
}

export interface IImportSummary {
  selected: number;
  processed: number;
  success: number;
  failed: number;
  newProducts: number;
  updatedProducts: number;
  createdInvoices: number;
  updatedInvoices: number;
  ignoredInvoices: number;
  importedInvoices: number;
}

export interface IUploadImportReportResponse {
  summary: IImportSummary;
  results: IImportResult[];
  newProducts: IImportedProduct[];
  updatedProducts: IImportedProduct[];
}
