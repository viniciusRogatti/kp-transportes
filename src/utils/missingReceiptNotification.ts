type MissingReceiptNotification = {
  id: string | number;
  entity?: { id?: string | null } | null;
  metadata?: Record<string, unknown> | null;
};

export const getReportedInvoiceNumber = (notification: MissingReceiptNotification) => (
  String(notification.metadata?.nfNumber || notification.entity?.id || '').trim()
);

export const buildIncorrectReceiptUrl = (notification: MissingReceiptNotification) => {
  const params = new URLSearchParams({
    tab: 'pending',
    receiptCorrection: String(notification.id),
  });
  const reportedInvoice = getReportedInvoiceNumber(notification);
  if (reportedInvoice) params.set('reportedNf', reportedInvoice);
  return `/operational-pendencies?${params.toString()}`;
};
