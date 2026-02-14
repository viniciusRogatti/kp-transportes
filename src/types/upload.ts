export type ImportErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'XML_PARSE_ERROR'
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
  stack?: string;
}

export interface IImportResultMeta {
  origin: string;
  invoiceNumber: string | null;
  createdProducts: number;
  updatedProducts: number;
  createdInvoices: number;
  updatedInvoices: number;
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
  importedInvoices: number;
}

export interface IUploadImportReportResponse {
  summary: IImportSummary;
  results: IImportResult[];
  newProducts: IImportedProduct[];
  updatedProducts: IImportedProduct[];
}
