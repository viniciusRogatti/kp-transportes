import { IImportResult, IImportSummary, IUploadImportReportResponse } from '../types/upload';
import { hasDuplicateInvoiceWarning } from './importErrorPresentation';

export function calculateImportSummary(
  selected: number,
  results: IImportResult[],
  newProducts: IUploadImportReportResponse['newProducts'],
  updatedProducts: IUploadImportReportResponse['updatedProducts'],
): IImportSummary {
  const success = results.filter((item) => item.status === 'success');
  const failed = results.filter((item) => item.status === 'error');

  const createdInvoices = success.reduce((acc, item) => acc + Number(item.meta?.createdInvoices || 0), 0);
  const ignoredInvoices = success.reduce((acc, item) => (
    acc + Number(item.meta?.ignoredInvoices || (hasDuplicateInvoiceWarning(item) ? 1 : 0))
  ), 0);
  const updatedInvoices = success.reduce((acc, item) => (
    acc + (hasDuplicateInvoiceWarning(item) ? 0 : Number(item.meta?.updatedInvoices || 0))
  ), 0);

  return {
    selected,
    processed: success.length + failed.length,
    success: success.length,
    failed: failed.length,
    newProducts: newProducts.length,
    updatedProducts: updatedProducts.length,
    createdInvoices,
    updatedInvoices,
    ignoredInvoices,
    importedInvoices: createdInvoices + updatedInvoices,
  };
}
