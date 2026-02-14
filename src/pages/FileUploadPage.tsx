import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router';
import Header from '../components/Header';
import { API_URL } from '../data';
import verifyToken from '../utils/verifyToken';
import { Container } from '../style/invoices';
import FileDropzone from '../components/upload/FileDropzone';
import UploadQueueList, { UploadQueueItem } from '../components/upload/UploadQueueList';
import ImportSummary from '../components/upload/ImportSummary';
import ImportErrorsPanel from '../components/upload/ImportErrorsPanel';
import NewProductsPanel from '../components/upload/NewProductsPanel';
import { IImportResult, IImportSummary, IUploadImportReportResponse } from '../types/upload';

const ACCEPTED_MIME_TYPES = new Set(['text/xml', 'application/xml']);
const BATCH_SIZE = 40;
const FILE_KEY_SEPARATOR = '__KPKEY__';
const UPLOAD_FIELD_NAME = 'files';

type ResultTab = 'summary' | 'success' | 'errors' | 'products';

interface IUploadEndpointErrorResponse {
  summary?: Partial<IImportSummary>;
  results?: IImportResult[];
  newProducts?: IUploadImportReportResponse['newProducts'];
  updatedProducts?: IUploadImportReportResponse['updatedProducts'];
  error?: string;
  message?: string;
  errorCode?: string;
  errorDetail?: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
    stack?: string;
  };
}

const createEmptySummary = (selected = 0): IImportSummary => ({
  selected,
  processed: 0,
  success: 0,
  failed: 0,
  newProducts: 0,
  updatedProducts: 0,
  createdInvoices: 0,
  updatedInvoices: 0,
  importedInvoices: 0,
});

const createEmptyReport = (selected = 0): IUploadImportReportResponse => ({
  summary: createEmptySummary(selected),
  results: [],
  newProducts: [],
  updatedProducts: [],
});

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / (1024 ** power);
  return `${size.toFixed(power === 0 ? 0 : 2)} ${units[power]}`;
};

const formatRate = (rate: number) => `${rate.toFixed(2)} arq/s`;
const formatEta = (seconds: number) => `${Math.max(0, Math.ceil(seconds))}s`;

const uniqueProducts = (products: IUploadImportReportResponse['newProducts']) => {
  const map = new Map<string, IUploadImportReportResponse['newProducts'][number]>();
  for (const product of products) {
    const key = `${product.status || 'new'}::${product.code}::${product.sourceFile}`;
    map.set(key, product);
  }
  return Array.from(map.values());
};

const resultKey = (result: IImportResult) => result.fileKey || result.fileName;

const recomputeSummary = (
  selected: number,
  results: IImportResult[],
  newProducts: IUploadImportReportResponse['newProducts'],
  updatedProducts: IUploadImportReportResponse['updatedProducts'],
): IImportSummary => {
  const success = results.filter((item) => item.status === 'success');
  const failed = results.filter((item) => item.status === 'error');

  const createdInvoices = success.reduce((acc, item) => acc + Number(item.meta?.createdInvoices || 0), 0);
  const updatedInvoices = success.reduce((acc, item) => acc + Number(item.meta?.updatedInvoices || 0), 0);

  return {
    selected,
    processed: success.length + failed.length,
    success: success.length,
    failed: failed.length,
    newProducts: newProducts.length,
    updatedProducts: updatedProducts.length,
    createdInvoices,
    updatedInvoices,
    importedInvoices: createdInvoices + updatedInvoices,
  };
};

const mergeReports = (
  base: IUploadImportReportResponse,
  incoming: IUploadImportReportResponse,
  selectedCount: number,
): IUploadImportReportResponse => {
  const mergedResultMap = new Map<string, IImportResult>();
  base.results.forEach((item) => mergedResultMap.set(resultKey(item), item));
  incoming.results.forEach((item) => mergedResultMap.set(resultKey(item), item));

  const mergedResults = Array.from(mergedResultMap.values());
  const mergedNewProducts = uniqueProducts([...base.newProducts, ...incoming.newProducts]);
  const mergedUpdatedProducts = uniqueProducts([...base.updatedProducts, ...incoming.updatedProducts]);

  return {
    summary: recomputeSummary(selectedCount, mergedResults, mergedNewProducts, mergedUpdatedProducts),
    results: mergedResults,
    newProducts: mergedNewProducts,
    updatedProducts: mergedUpdatedProducts,
  };
};

const normalizeResponse = (
  payload: Partial<IUploadImportReportResponse> | null | undefined,
  selectedCount: number,
): IUploadImportReportResponse => {
  const safePayload = payload || {};
  const results = Array.isArray(safePayload.results) ? safePayload.results : [];
  const newProducts = Array.isArray(safePayload.newProducts) ? safePayload.newProducts : [];
  const updatedProducts = Array.isArray(safePayload.updatedProducts) ? safePayload.updatedProducts : [];

  return {
    summary: recomputeSummary(selectedCount, results, newProducts, updatedProducts),
    results,
    newProducts,
    updatedProducts,
  };
};

function FileUploadPage() {
  const navigate = useNavigate();

  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectionIssues, setSelectionIssues] = useState<string[]>([]);
  const [report, setReport] = useState<IUploadImportReportResponse | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>('summary');
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [progressProcessed, setProgressProcessed] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressRate, setProgressRate] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const fetchToken = async () => {
      if (token) {
        const isValidToken = await verifyToken(token);
        if (!isValidToken) {
          navigate('/');
        }
      } else {
        navigate('/');
      }
    };

    fetchToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCount = queue.length;
  const totalBytes = useMemo(() => queue.reduce((acc, item) => acc + item.file.size, 0), [queue]);
  const failedItems = useMemo(() => queue.filter((item) => item.status === 'error'), [queue]);
  const hasReadyItems = useMemo(() => queue.some((item) => item.status === 'ready'), [queue]);

  const summary = report?.summary || createEmptySummary(selectedCount);

  const processedLabel = `${progressProcessed}/${progressTotal || selectedCount}`;
  const progressPercent = progressTotal > 0 ? (progressProcessed / progressTotal) * 100 : 0;
  const rateLabel = progressRate > 0 ? formatRate(progressRate) : '';
  const etaLabel = etaSeconds !== null && Number.isFinite(etaSeconds) ? formatEta(etaSeconds) : '';

  function resetProgress() {
    setProgressProcessed(0);
    setProgressTotal(0);
    setProgressRate(0);
    setEtaSeconds(null);
  }

  function updateProgressCounters(processed: number, total: number, startedAt: number) {
    const elapsedMs = Date.now() - startedAt;
    const elapsedSec = elapsedMs > 0 ? elapsedMs / 1000 : 0;
    const rate = elapsedSec > 0 ? processed / elapsedSec : 0;
    const pending = Math.max(0, total - processed);
    const eta = rate > 0 ? pending / rate : null;

    setProgressProcessed(processed);
    setProgressTotal(total);
    setProgressRate(rate);
    setEtaSeconds(eta);
  }

  function isValidXmlFile(file: File) {
    const fileName = file.name.toLowerCase();
    const mimeType = String(file.type || '').toLowerCase();
    return fileName.endsWith('.xml') || ACCEPTED_MIME_TYPES.has(mimeType) || mimeType.includes('xml');
  }

  function addFiles(files: File[]) {
    if (!files.length) return;

    let notes: string[] = [];
    setQueue((previous) => {
      const signatures = new Set(previous.map((item) => `${item.file.name}::${item.file.size}`));
      const accepted: UploadQueueItem[] = [];
      const invalid: string[] = [];
      const duplicate: string[] = [];

      for (const file of files) {
        if (!isValidXmlFile(file)) {
          invalid.push(file.name);
          continue;
        }

        const signature = `${file.name}::${file.size}`;
        if (signatures.has(signature)) {
          duplicate.push(file.name);
          continue;
        }

        signatures.add(signature);
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}-${accepted.length}`,
          file,
          status: 'ready',
        });
      }

      notes = [
        invalid.length ? `${invalid.length} arquivo(s) ignorado(s): tipo inválido.` : '',
        duplicate.length ? `${duplicate.length} arquivo(s) ignorado(s): duplicado(s) por nome+tamanho.` : '',
      ].filter(Boolean);

      return [...previous, ...accepted];
    });

    setSelectionIssues(notes);
    setReport(null);
    setActiveTab('summary');
  }

  function removeQueueItem(id: string) {
    if (isUploading) return;
    setQueue((previous) => previous.filter((item) => item.id !== id));
    setReport(null);
  }

  function clearSelection() {
    if (isUploading) return;
    setQueue([]);
    setSelectionIssues([]);
    setReport(null);
    setActiveTab('summary');
    setIsQueueOpen(false);
    resetProgress();
  }

  async function uploadBatch(batch: UploadQueueItem[]) {
    const formData = new FormData();
    batch.forEach((item) => {
      formData.append(UPLOAD_FIELD_NAME, item.file, `${item.id}${FILE_KEY_SEPARATOR}${item.file.name}`);
    });

    const response = await axios.post<IUploadImportReportResponse>(`${API_URL}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return normalizeResponse(response.data, batch.length);
  }

  function updateQueueStatusesFromResults(results: IImportResult[]) {
    if (!results.length) return;

    const resultMap = new Map<string, IImportResult>();
    results.forEach((item) => {
      resultMap.set(item.fileKey || item.fileName, item);
    });

    setQueue((previous) => previous.map((item) => {
      const match = resultMap.get(item.id) || resultMap.get(item.file.name);
      if (!match) return item;

      if (match.status === 'success') {
        return {
          ...item,
          status: 'success',
          errorMessage: '',
          warningCount: Array.isArray(match.warnings) ? match.warnings.length : 0,
        };
      }

      return {
        ...item,
        status: 'error',
        errorMessage: match.error?.message || 'Erro ao processar arquivo.',
        warningCount: 0,
      };
    }));
  }

  function buildBatchErrorReport(batch: UploadQueueItem[], error: unknown) {
    const isAxiosFailure = axios.isAxiosError<IUploadEndpointErrorResponse>(error);
    const responsePayload = isAxiosFailure ? error.response?.data : undefined;

    if (responsePayload && Array.isArray(responsePayload.results)) {
      return normalizeResponse({
        results: responsePayload.results,
        newProducts: responsePayload.newProducts || [],
        updatedProducts: responsePayload.updatedProducts || [],
      }, batch.length);
    }

    const statusCode = isAxiosFailure ? error.response?.status : undefined;
    const defaultMessage = statusCode
      ? `Falha no servidor ao processar o lote (HTTP ${statusCode}).`
      : 'Falha de rede ao enviar lote.';
    const fallbackDetails = statusCode
      ? `Resposta HTTP ${statusCode} recebida do servidor de importação.`
      : 'Não foi possível comunicar com o servidor de importação.';

    const errorDetail = responsePayload?.errorDetail;
    const normalizedError = {
      code: errorDetail?.code || responsePayload?.errorCode || 'UNKNOWN_ERROR',
      message: errorDetail?.message || responsePayload?.error || responsePayload?.message || defaultMessage,
      details: errorDetail?.details || fallbackDetails,
      hint: errorDetail?.hint || 'Tente reenviar os arquivos com erro.',
      ...(errorDetail?.stack ? { stack: errorDetail.stack } : {}),
    };

    const results: IImportResult[] = batch.map((item) => ({
      fileName: item.file.name,
      fileKey: item.id,
      status: 'error',
      error: normalizedError,
    }));

    return normalizeResponse({
      results,
      newProducts: [],
      updatedProducts: [],
    }, batch.length);
  }

  async function processQueue(target: UploadQueueItem[], preserveExistingReport: boolean) {
    if (!target.length) return;

    const queueSelectedCount = queue.length;
    const startedAt = Date.now();
    let processed = 0;
    let workingReport = preserveExistingReport && report
      ? report
      : createEmptyReport(queueSelectedCount);

    setIsUploading(true);
    setActiveTab('summary');
    updateProgressCounters(0, target.length, startedAt);

    setQueue((previous) => previous.map((item) => (
      target.some((candidate) => candidate.id === item.id)
        ? { ...item, status: 'uploading', errorMessage: '' }
        : item
    )));

    try {
      for (let index = 0; index < target.length; index += BATCH_SIZE) {
        const batch = target.slice(index, index + BATCH_SIZE);

        try {
          const batchReport = await uploadBatch(batch);
          workingReport = mergeReports(workingReport, batchReport, queueSelectedCount);
          setReport(workingReport);
          updateQueueStatusesFromResults(batchReport.results);
        } catch (error) {
          const errorReport = buildBatchErrorReport(batch, error);
          const errorResults = errorReport.results;

          workingReport = mergeReports(workingReport, errorReport, queueSelectedCount);
          setReport(workingReport);
          updateQueueStatusesFromResults(errorResults);
        }

        processed += batch.length;
        updateProgressCounters(processed, target.length, startedAt);
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function handleUploadAll() {
    const target = queue.filter((item) => item.status === 'ready');
    if (!target.length || isUploading) return;
    await processQueue(target, false);
  }

  async function handleRetryFailed() {
    const target = queue.filter((item) => item.status === 'error');
    if (!target.length || isUploading) return;
    await processQueue(target, true);
  }

  function downloadReport() {
    if (!report) return;
    const data = JSON.stringify(report, null, 2);
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `upload-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const successResults = report?.results.filter((item) => item.status === 'success') || [];

  return (
    <div>
      <Header />
      <Container className="pb-s3 max-[768px]:pb-s3">
        <div className="w-full max-w-[1200px] space-y-3">
          <div className="rounded-xl border border-white/10 bg-[rgba(8,21,33,0.78)] p-4 shadow-[var(--shadow-1)]">
            <h2 className="text-[1.1rem] font-semibold text-text">Importação de XML</h2>
            <p className="mt-1 text-sm text-muted">Arraste arquivos, acompanhe o processamento e consulte o relatório completo.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-surface/60 p-3">
                <p className="text-[0.72rem] uppercase tracking-wide text-muted">Selecionados</p>
                <p className="mt-1 text-[1.05rem] font-semibold text-text">{selectedCount} arquivos</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-surface/60 p-3">
                <p className="text-[0.72rem] uppercase tracking-wide text-muted">Tamanho total</p>
                <p className="mt-1 text-[1.05rem] font-semibold text-text">{formatBytes(totalBytes)}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-surface/60 p-3">
                <p className="text-[0.72rem] uppercase tracking-wide text-muted">Estado</p>
                <p className="mt-1 text-[1.05rem] font-semibold text-text">{selectedCount ? 'Prontos para enviar' : 'Sem arquivos'}</p>
              </div>
            </div>
          </div>

          <FileDropzone
            disabled={isUploading}
            onSelectFiles={addFiles}
            selectedCount={selectedCount}
            totalSizeLabel={formatBytes(totalBytes)}
          />

          {!!selectionIssues.length && (
            <div className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-900/15 p-3">
              {selectionIssues.map((message) => (
                <p key={message} className="text-xs text-amber-200">{message}</p>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-[rgba(8,21,33,0.78)] p-4 shadow-[var(--shadow-1)]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleUploadAll}
                disabled={!hasReadyItems || isUploading}
                className="inline-flex h-10 items-center rounded-md border border-accent/40 bg-gradient-to-r from-accent to-accent-strong px-4 text-sm font-semibold text-[#04131e] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Processar XMLs
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={!queue.length || isUploading}
                className="inline-flex h-10 items-center rounded-md border border-white/15 bg-surface-2 px-4 text-sm font-semibold text-text disabled:cursor-not-allowed disabled:opacity-45"
              >
                Limpar seleção
              </button>
              <button
                type="button"
                onClick={handleRetryFailed}
                disabled={!failedItems.length || isUploading}
                className="inline-flex h-10 items-center rounded-md border border-rose-400/40 bg-rose-900/35 px-4 text-sm font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Reenviar apenas com erro
              </button>
              <button
                type="button"
                onClick={downloadReport}
                disabled={!report}
                className="inline-flex h-10 items-center rounded-md border border-sky-400/35 bg-sky-900/25 px-4 text-sm font-semibold text-sky-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Baixar relatório (JSON)
              </button>
            </div>

            {(isUploading || progressProcessed > 0) && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Processados: {processedLabel}</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2/80">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent-strong transition-all"
                    style={{ width: `${Math.max(2, Math.min(100, progressPercent))}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted">
                  {progressRate > 0 ? <span>{formatRate(progressRate)}</span> : null}
                  {etaSeconds !== null ? <span>ETA: {formatEta(etaSeconds)}</span> : null}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-[rgba(8,21,33,0.78)] p-3 shadow-[var(--shadow-1)]">
            <button
              type="button"
              onClick={() => setIsQueueOpen((previous) => !previous)}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-surface/60 px-3 py-2 text-left"
              aria-expanded={isQueueOpen}
            >
              <div>
                <p className="text-sm font-semibold text-text">Fila de envio</p>
                <p className="text-xs text-muted">{queue.length} arquivo(s)</p>
              </div>
              <span className="text-xs font-semibold text-text-accent">
                {isQueueOpen ? 'Ocultar detalhes' : 'Ver detalhes'}
              </span>
            </button>

            {isQueueOpen ? (
              <div className="mt-3 max-h-[42vh] overflow-hidden">
                <UploadQueueList
                  items={queue}
                  disabled={isUploading}
                  onRemove={removeQueueItem}
                />
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted">
                A fila fica recolhida por padrão para manter a tela organizada.
              </p>
            )}
          </div>

          {report && (
            <div className="rounded-xl border border-white/10 bg-[rgba(8,21,33,0.78)] p-3 shadow-[var(--shadow-1)]">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`h-9 rounded-md border px-3 text-sm font-semibold ${activeTab === 'summary' ? 'border-accent/60 bg-accent/20 text-text' : 'border-white/10 bg-surface/70 text-muted'}`}
                  onClick={() => setActiveTab('summary')}
                >
                  Resumo
                </button>
                <button
                  type="button"
                  className={`h-9 rounded-md border px-3 text-sm font-semibold ${activeTab === 'success' ? 'border-accent/60 bg-accent/20 text-text' : 'border-white/10 bg-surface/70 text-muted'}`}
                  onClick={() => setActiveTab('success')}
                >
                  Sucessos
                </button>
                <button
                  type="button"
                  className={`h-9 rounded-md border px-3 text-sm font-semibold ${activeTab === 'errors' ? 'border-accent/60 bg-accent/20 text-text' : 'border-white/10 bg-surface/70 text-muted'}`}
                  onClick={() => setActiveTab('errors')}
                >
                  Erros
                </button>
                <button
                  type="button"
                  className={`h-9 rounded-md border px-3 text-sm font-semibold ${activeTab === 'products' ? 'border-accent/60 bg-accent/20 text-text' : 'border-white/10 bg-surface/70 text-muted'}`}
                  onClick={() => setActiveTab('products')}
                >
                  Novos produtos
                </button>
              </div>

              <div className="mt-3">
                {activeTab === 'summary' && (
                  <ImportSummary
                    summary={summary}
                    progressPercent={progressPercent}
                    processedLabel={`${summary.processed}/${summary.selected || selectedCount}`}
                    rateLabel={rateLabel}
                    etaLabel={etaLabel}
                  />
                )}

                {activeTab === 'success' && (
                  <div className="space-y-2">
                    {!successResults.length ? (
                      <div className="rounded-xl border border-white/10 bg-[rgba(8,21,33,0.72)] p-4 text-sm text-muted">
                        Nenhum arquivo processado com sucesso.
                      </div>
                    ) : successResults.map((item) => (
                      <div key={`${item.fileKey || item.fileName}-success`} className="rounded-xl border border-white/10 bg-[rgba(8,21,33,0.72)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-text">{item.fileName}</p>
                          <span className="inline-flex h-7 items-center rounded-full border border-emerald-500/45 bg-emerald-900/30 px-2 text-[0.68rem] font-semibold uppercase tracking-wide text-emerald-200">
                            Sucesso
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          NF: {item.meta?.invoiceNumber || '-'} • Origem: {item.meta?.origin || '-'}
                        </p>
                        {item.warnings?.length ? (
                          <div className="mt-2 space-y-1">
                            {item.warnings.map((warning) => (
                              <p key={`${item.fileName}-${warning.code}-${warning.message}`} className="text-xs text-amber-200">
                                Atenção: {warning.message}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'errors' && <ImportErrorsPanel results={report.results} />}

                {activeTab === 'products' && (
                  <NewProductsPanel newProducts={report.newProducts} updatedProducts={report.updatedProducts} />
                )}
              </div>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}

export default FileUploadPage;
