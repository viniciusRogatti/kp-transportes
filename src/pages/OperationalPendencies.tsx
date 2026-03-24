import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import {
  RefreshCcw,
  Search,
  UploadCloud,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import Badge from '../components/ui/Badge';
import Header from '../components/Header';
import { Container } from '../style/invoices';
import verifyToken from '../utils/verifyToken';
import {
  listDriversForReceiptFilters,
  listReceiptBacklog,
  uploadReceipt,
} from '../services/receiptsService';
import {
  IDriver,
  IReceiptBacklogRow,
  IReceiptBacklogSummary,
  ReceiptBacklogQueueType,
} from '../types/types';
import {
  getOperationalStatusLabel,
  getOperationalStatusTone,
  getSemanticToneClassName,
  SemanticTone,
} from '../utils/statusStyles';

type UploadPreviewReport = {
  originalSizeKb: number;
  finalSizeKb: number;
  width: number;
  height: number;
  usedCompression: boolean;
};

type BacklogTabConfig = {
  label: string;
  summaryLabel: string;
  emptyMessage: string;
  tone: SemanticTone;
};

const MIN_WIDTH = 1000;
const MIN_AREA = 1000000;

const BACKLOG_TAB_CONFIG: Record<ReceiptBacklogQueueType, BacklogTabConfig> = {
  pending: {
    label: 'Pendentes',
    summaryLabel: 'Pendentes',
    emptyMessage: 'Nenhuma NF pendente sem fechamento de canhoto para os filtros atuais.',
    tone: 'warning',
  },
  retained: {
    label: 'Canhotos retidos',
    summaryLabel: 'Retidos',
    emptyMessage: 'Nenhum canhoto retido encontrado para os filtros atuais.',
    tone: 'warning',
  },
  returned: {
    label: 'Devolvidas',
    summaryLabel: 'Devolvidas',
    emptyMessage: 'Nenhuma NF devolvida encontrada para os filtros atuais.',
    tone: 'danger',
  },
  cancelled: {
    label: 'Canceladas',
    summaryLabel: 'Canceladas',
    emptyMessage: 'Nenhuma NF cancelada encontrada para os filtros atuais.',
    tone: 'neutral',
  },
  unassigned: {
    label: 'Sem motorista',
    summaryLabel: 'Sem motorista',
    emptyMessage: 'Nenhuma NF aberta sem motorista encontrada para os filtros atuais.',
    tone: 'info',
  },
};

const EMPTY_BACKLOG_SUMMARY: IReceiptBacklogSummary = {
  pending: 0,
  retained: 0,
  returned: 0,
  cancelled: 0,
  unassigned: 0,
  total: 0,
};

const formatDateTime = (value: string | number | null | undefined) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

const formatDateOnly = (value: string | null | undefined) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
};

const toLocalDateInput = (date: Date) => {
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60 * 1000));
  return localDate.toISOString().slice(0, 10);
};

const todayDateInput = () => toLocalDateInput(new Date());

const readImageDimensions = (file: Blob) => new Promise<{ width: number; height: number }>((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    const width = Number(image.naturalWidth || image.width || 0);
    const height = Number(image.naturalHeight || image.height || 0);
    URL.revokeObjectURL(objectUrl);

    if (!width || !height) {
      reject(new Error('Nao foi possivel ler as dimensoes da imagem.'));
      return;
    }

    resolve({ width, height });
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('Arquivo de imagem invalido.'));
  };

  image.src = objectUrl;
});

async function prepareFileForUpload(file: File): Promise<{ file: File; report: UploadPreviewReport }> {
  let finalFile: File = file;
  let usedCompression = false;

  try {
    const compressedFile = await imageCompression(file, {
      maxSizeMB: 5,
      maxWidthOrHeight: 2500,
      useWebWorker: true,
      initialQuality: 0.9,
      fileType: 'image/jpeg',
      alwaysKeepResolution: false,
    });

    if (compressedFile.size < file.size) {
      finalFile = compressedFile;
      usedCompression = true;
    }
  } catch {
    finalFile = file;
    usedCompression = false;
  }

  const finalDimensions = await readImageDimensions(finalFile);

  if (finalDimensions.width < MIN_WIDTH && (finalDimensions.width * finalDimensions.height) < MIN_AREA) {
    throw new Error('A imagem esta pequena para leitura do documento. Refaça a foto com o canhoto inteiro e maior resolucao.');
  }

  return {
    file: finalFile,
    report: {
      originalSizeKb: Number((file.size / 1024).toFixed(0)),
      finalSizeKb: Number((finalFile.size / 1024).toFixed(0)),
      width: finalDimensions.width,
      height: finalDimensions.height,
      usedCompression,
    },
  };
}

const getBacklogTabClassName = (tab: ReceiptBacklogQueueType, active: boolean) => (
  active ? getSemanticToneClassName(BACKLOG_TAB_CONFIG[tab].tone) : 'border-border bg-card text-text'
);

const getAgeBadgeTone = (row: IReceiptBacklogRow): SemanticTone => {
  if ((row.age_days || 0) <= 0) return 'info';
  if (row.queue_type === 'returned' || row.queue_type === 'cancelled') return 'neutral';
  if (row.queue_type === 'retained') return 'warning';
  return 'danger';
};

function OperationalPendencies() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ReceiptBacklogQueueType>('pending');
  const [drivers, setDrivers] = useState<IDriver[]>([]);
  const [rows, setRows] = useState<IReceiptBacklogRow[]>([]);
  const [summary, setSummary] = useState<IReceiptBacklogSummary>(EMPTY_BACKLOG_SUMMARY);
  const [cutoffDate, setCutoffDate] = useState('');
  const [nfFilter, setNfFilter] = useState('');
  const [motoristaFilter, setMotoristaFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<IReceiptBacklogRow | null>(null);
  const [uploadNfId, setUploadNfId] = useState('');
  const [uploadTripId, setUploadTripId] = useState('');
  const [uploadMotoristaId, setUploadMotoristaId] = useState('');
  const [uploadDeliveryDate, setUploadDeliveryDate] = useState(todayDateInput());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadReport, setUploadReport] = useState<UploadPreviewReport | null>(null);
  const [uploadError, setUploadError] = useState('');

  const selectedMotoristaFilterId = useMemo(() => {
    const parsed = Number(motoristaFilter);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [motoristaFilter]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const ensureToken = async () => {
      if (!token) {
        navigate('/');
        return;
      }

      const valid = await verifyToken(token);
      if (!valid) {
        navigate('/');
      }
    };

    ensureToken();
  }, [navigate]);

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const driverRows = await listDriversForReceiptFilters();
        setDrivers(Array.isArray(driverRows) ? driverRows : []);
      } catch {
        setDrivers([]);
      }
    };

    loadDrivers();
  }, []);

  useEffect(() => () => {
    if (selectedPreviewUrl) {
      URL.revokeObjectURL(selectedPreviewUrl);
    }
  }, [selectedPreviewUrl]);

  async function loadBacklog(
    tab: ReceiptBacklogQueueType = activeTab,
    overrides: {
      nf?: string;
      motoristaId?: number | null;
      startDate?: string;
      endDate?: string;
    } = {},
  ) {
    setLoading(true);
    setPageError('');

    try {
      const response = await listReceiptBacklog({
        queueType: tab,
        nf: (overrides.nf ?? nfFilter).trim() || undefined,
        motoristaId: overrides.motoristaId !== undefined ? overrides.motoristaId : selectedMotoristaFilterId,
        startDate: (overrides.startDate ?? startDate) || undefined,
        endDate: (overrides.endDate ?? endDate) || undefined,
        limit: 200,
      });

      setRows(Array.isArray(response?.rows) ? response.rows : []);
      setSummary(response?.summary || EMPTY_BACKLOG_SUMMARY);
      setCutoffDate(String(response?.cutoff_date || ''));
    } catch (error) {
      console.error(error);
      setPageError('Nao foi possivel carregar as pendencias operacionais de canhoto.');
      setRows([]);
      setSummary(EMPTY_BACKLOG_SUMMARY);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBacklog(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function handleSearch() {
    await loadBacklog(activeTab);
  }

  async function handleClearFilters() {
    setNfFilter('');
    setMotoristaFilter('');
    setStartDate('');
    setEndDate('');
    await loadBacklog(activeTab, {
      nf: '',
      motoristaId: null,
      startDate: '',
      endDate: '',
    });
  }

  function openUploadModal(row: IReceiptBacklogRow) {
    setUploadTarget(row);
    setUploadNfId(String(row.nf_id || row.invoice_number || '').trim());
    setUploadTripId(row.trip_id ? String(row.trip_id) : '');
    setUploadMotoristaId(row.motorista_id ? String(row.motorista_id) : '');
    setUploadDeliveryDate(todayDateInput());
    setSelectedFile(null);
    setUploadReport(null);
    setUploadError('');

    if (selectedPreviewUrl) {
      URL.revokeObjectURL(selectedPreviewUrl);
      setSelectedPreviewUrl('');
    }

    setIsUploadModalOpen(true);
  }

  function closeUploadModal() {
    setIsUploadModalOpen(false);
    setUploadTarget(null);
    setSelectedFile(null);
    setUploadReport(null);
    setUploadError('');

    if (selectedPreviewUrl) {
      URL.revokeObjectURL(selectedPreviewUrl);
      setSelectedPreviewUrl('');
    }
  }

  async function handleSelectFile(file: File | null) {
    setUploadError('');
    setUploadReport(null);

    if (selectedPreviewUrl) {
      URL.revokeObjectURL(selectedPreviewUrl);
      setSelectedPreviewUrl('');
    }

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!String(file.type || '').startsWith('image/')) {
      setUploadError('Selecione um arquivo de imagem valido (JPG, PNG ou WEBP).');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setSelectedPreviewUrl(URL.createObjectURL(file));
  }

  async function handleUploadSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setUploadError('Selecione uma foto do canhoto antes de enviar.');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const prepared = await prepareFileForUpload(selectedFile);
      setUploadReport(prepared.report);

      const formData = new FormData();
      formData.append('file', prepared.file);

      if (uploadNfId.trim()) formData.append('nfNumber', uploadNfId.trim());
      if (uploadTripId.trim()) formData.append('rotaId', uploadTripId.trim());
      if (uploadMotoristaId.trim()) formData.append('motoristaId', uploadMotoristaId.trim());
      if (uploadDeliveryDate.trim()) formData.append('dataEntrega', uploadDeliveryDate.trim());

      await uploadReceipt(formData);

      closeUploadModal();
      await loadBacklog(activeTab);
    } catch (error) {
      console.error(error);

      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const payload = error.response?.data;
        const errorCode = String(payload?.error || '');
        const errorMessage = String(payload?.message || '');

        if (statusCode === 422 && errorCode === 'UNREADABLE_IMAGE') {
          setUploadError(`${errorMessage || 'Imagem ilegivel.'} Dica: boa iluminacao, sem tremor e canhoto inteiro no enquadramento.`);
          return;
        }

        if (statusCode === 422 && errorCode === 'UNREADABLE_OR_WRONG_CROP') {
          setUploadError('Nao foi possivel validar o canhoto: imagem ilegivel ou recorte incorreto.');
          return;
        }

        if (statusCode === 422 && errorCode === 'MISSING_REQUIRED_FIELDS') {
          setUploadError('Campos obrigatorios nao detectados no canhoto (DATA, ASSINATURA e NF-e).');
          return;
        }

        if (statusCode === 422 && errorCode === 'NF_NOT_FOUND') {
          setUploadError('NF nao encontrada para a empresa autenticada.');
          return;
        }

        if (statusCode === 422 && errorCode === 'NF_MISMATCH') {
          setUploadError('A NF detectada no canhoto e diferente da NF informada no upload.');
          return;
        }

        if (statusCode === 422 && errorCode === 'NF_NOT_DETECTED') {
          setUploadError('Nao foi possivel extrair o numero da NF no bloco de NF-e.');
          return;
        }

        if (statusCode === 409 && errorCode === 'RECEIPT_ALREADY_EXISTS') {
          setUploadError('A NF ja possui canhoto postado.');
          return;
        }

        if (statusCode === 413) {
          setUploadError('Arquivo muito grande. Tente uma foto menor (ate 12 MB).');
          return;
        }

        if (statusCode === 415) {
          setUploadError('Formato nao suportado. Use JPG, PNG ou WEBP.');
          return;
        }

        setUploadError(errorMessage || 'Falha ao enviar canhoto.');
        return;
      }

      setUploadError(error instanceof Error ? error.message : 'Falha ao enviar canhoto.');
    } finally {
      setUploading(false);
    }
  }

  const summaryCards: ReceiptBacklogQueueType[] = ['pending', 'retained', 'returned', 'cancelled', 'unassigned'];
  const activeTabConfig = BACKLOG_TAB_CONFIG[activeTab];

  return (
    <div>
      <Header />
      <Container>
        <div className="w-full max-w-[1250px] space-y-3">
          <section className="rounded-md border border-border bg-surface/70 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text">Pendencias Operacionais</h2>
                <p className="text-sm text-muted">
                  Monitore NFs sem fechamento logistico, acompanhe canhotos retidos e mantenha visivel tudo o que ainda exige acao operacional.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-muted">
                  Base operacional desde {formatDateOnly(cutoffDate) || '-'}
                </span>
                <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${getSemanticToneClassName('info')}`}>
                  {`Total em fila: ${summary.total}`}
                </span>
                <button
                  type="button"
                  onClick={handleSearch}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface-2/80 px-3 text-sm text-text transition hover:bg-surface-2"
                >
                  <RefreshCcw className="h-4 w-4" /> Atualizar
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_170px_170px_auto_auto]">
              <label className="text-xs text-muted">
                NF
                <input
                  value={nfFilter}
                  onChange={(event) => setNfFilter(event.target.value)}
                  placeholder="Buscar por NF"
                  className="mt-1 h-10 w-full rounded-sm border border-border bg-card px-3 text-sm text-text"
                />
              </label>

              <label className="text-xs text-muted">
                Motorista
                <select
                  value={motoristaFilter}
                  onChange={(event) => setMotoristaFilter(event.target.value)}
                  className="mt-1 h-10 w-full rounded-sm border border-border bg-card px-3 text-sm text-text"
                >
                  <option value="">Todos</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>{driver.name}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-muted">
                Data inicio
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-1 h-10 w-full rounded-sm border border-border bg-card px-3 text-sm text-text"
                />
              </label>

              <label className="text-xs text-muted">
                Data fim
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-1 h-10 w-full rounded-sm border border-border bg-card px-3 text-sm text-text"
                />
              </label>

              <button
                type="button"
                onClick={handleSearch}
                className="h-10 self-end rounded-md border border-border bg-surface-2/80 px-3 text-sm text-text transition hover:bg-surface-2"
              >
                <span className="inline-flex items-center gap-2"><Search className="h-4 w-4" /> Buscar</span>
              </button>

              <button
                type="button"
                onClick={handleClearFilters}
                className="h-10 self-end rounded-md border border-border bg-card px-3 text-sm text-text transition hover:bg-surface-2"
              >
                Limpar
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {summaryCards.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${getBacklogTabClassName(tab, activeTab === tab)}`}
                >
                  {`${BACKLOG_TAB_CONFIG[tab].label.toUpperCase()} (${summary[tab] || 0})`}
                </button>
              ))}
            </div>

            {pageError ? (
              <div className="mt-3 rounded-md border semantic-panel-danger px-3 py-2 text-sm">
                {pageError}
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-border bg-surface/70 p-3">
            <div className="grid gap-2 md:grid-cols-5">
              {summaryCards.map((tab) => (
                <div key={`summary-${tab}`} className={`rounded-md border px-3 py-2 ${getSemanticToneClassName(BACKLOG_TAB_CONFIG[tab].tone, 'panel')}`}>
                  <p className="text-xs uppercase tracking-[0.18em]">{BACKLOG_TAB_CONFIG[tab].summaryLabel}</p>
                  <p className="mt-1 text-2xl font-semibold">{summary[tab] || 0}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-md border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-text">{activeTabConfig.label}</h3>
                  <p className="text-xs text-muted">
                    {activeTab === 'pending'
                      ? 'Fila das NFs abertas sem canhoto postado e sem fechamento final.'
                      : activeTab === 'retained'
                        ? 'NFs marcadas como canhoto retido para acompanhar a coleta do comprovante na proxima entrega.'
                        : activeTab === 'unassigned'
                          ? 'NFs abertas sem motorista vinculado, com risco alto de esquecimento.'
                          : 'Historico operacional recente para acompanhamento e auditoria.'}
                  </p>
                </div>
                <Badge tone={activeTabConfig.tone} className="h-auto px-2 py-1 text-[11px]">
                  {`${rows.length} NF(s) exibidas`}
                </Badge>
              </div>

              {loading ? (
                <p className="mt-3 text-sm text-muted">Carregando pendencias operacionais...</p>
              ) : !rows.length ? (
                <p className="mt-3 text-sm text-muted">{activeTabConfig.emptyMessage}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {rows.map((row) => {
                    const operationalStatus = row.latest_stop_status || row.source_status || '';
                    const ageDays = Number(row.age_days || 0);
                    const ageLabel = ageDays > 0 ? `${ageDays} dia(s) em aberto` : 'Movimento do dia';

                    return (
                      <li key={`${row.queue_type}-${row.invoice_number}-${row.trip_id || 'sem-rota'}`} className="rounded-md border border-border bg-surface/90 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-text">NF {row.invoice_number}</p>
                              <Badge tone={getOperationalStatusTone(operationalStatus)} className="h-auto px-2 py-0.5 text-[10px]">
                                {getOperationalStatusLabel(operationalStatus)}
                              </Badge>
                              <Badge tone={BACKLOG_TAB_CONFIG[row.queue_type].tone} className="h-auto px-2 py-0.5 text-[10px]">
                                {BACKLOG_TAB_CONFIG[row.queue_type].summaryLabel}
                              </Badge>
                              <Badge tone={getAgeBadgeTone(row)} className="h-auto px-2 py-0.5 text-[10px]">
                                {ageLabel}
                              </Badge>
                              {!row.motorista_name ? (
                                <Badge tone="neutral" className="h-auto px-2 py-0.5 text-[10px]">
                                  Sem motorista
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-muted">{row.customer_name || 'Cliente nao informado'} · {row.city || '-'}</p>
                            <p className="text-muted">Motorista: {row.motorista_name || '-'}</p>
                            <p className="text-muted">Data NF: {formatDateOnly(row.invoice_date)} · Data rota: {formatDateOnly(row.trip_date || null)}</p>
                            <p className="text-muted">Carga: {row.load_number || '-'} · Trip: {row.trip_id || '-'} · Rota: {row.rota_id || '-'}</p>
                            <p className="text-muted">Ultimo canhoto: {formatDateTime(row.receipt_created_at || null)}</p>
                          </div>

                          <div className="flex min-w-[180px] flex-col items-stretch gap-2">
                            {row.can_upload ? (
                              <button
                                type="button"
                                onClick={() => openUploadModal(row)}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border semantic-solid-info px-3 text-sm font-semibold transition hover:brightness-95"
                              >
                                <UploadCloud className="h-4 w-4" /> Enviar canhoto
                              </button>
                            ) : null}
                            <div className="rounded-md border border-border bg-card px-3 py-2 text-[11px] text-muted">
                              {row.can_upload
                                ? 'Ao postar a foto, a fila sera atualizada automaticamente.'
                                : row.queue_type === 'retained'
                                  ? 'Este canhoto retido sai da fila quando a foto for postada.'
                                  : 'Esta NF esta visivel para controle, sem acao direta de upload nesta etapa.'}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>

        {isUploadModalOpen ? (
          <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/65 p-3">
            <div className="w-full max-w-[720px] rounded-md border border-border bg-surface p-3 shadow-[var(--shadow-3)]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-text">Enviar canhoto</h3>
                  <p className="text-xs text-muted">NF {uploadTarget?.invoice_number || uploadNfId || '-'} · ajuste os campos e anexe a foto.</p>
                </div>
                <button type="button" onClick={closeUploadModal} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-text">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="mt-3 space-y-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="text-xs text-muted">
                    NF
                    <input
                      value={uploadNfId}
                      onChange={(event) => setUploadNfId(event.target.value)}
                      placeholder="Ex.: 123456789"
                      className="mt-1 h-10 w-full rounded-sm border border-border bg-card px-3 text-sm text-text"
                    />
                  </label>

                  <label className="text-xs text-muted">
                    Rota (tripId)
                    <input
                      value={uploadTripId}
                      onChange={(event) => setUploadTripId(event.target.value)}
                      placeholder="Opcional"
                      className="mt-1 h-10 w-full rounded-sm border border-border bg-card px-3 text-sm text-text"
                    />
                  </label>

                  <label className="text-xs text-muted">
                    Motorista
                    <select
                      value={uploadMotoristaId}
                      onChange={(event) => setUploadMotoristaId(event.target.value)}
                      className="mt-1 h-10 w-full rounded-sm border border-border bg-card px-3 text-sm text-text"
                    >
                      <option value="">Nao informado</option>
                      {drivers.map((driver) => (
                        <option key={`driver-upload-${driver.id}`} value={driver.id}>{driver.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs text-muted">
                    Data entrega
                    <input
                      type="date"
                      value={uploadDeliveryDate}
                      onChange={(event) => setUploadDeliveryDate(event.target.value)}
                      className="mt-1 h-10 w-full rounded-sm border border-border bg-card px-3 text-sm text-text"
                    />
                  </label>
                </div>

                <label className="text-xs text-muted">
                  Arquivo de imagem
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleSelectFile(event.target.files?.[0] || null)}
                    className="mt-1 block w-full rounded-sm border border-border bg-card p-2 text-sm text-text"
                  />
                </label>

                {selectedPreviewUrl ? (
                  <div className="rounded-md border border-border bg-card p-2">
                    <p className="mb-2 text-xs text-muted">Previa</p>
                    <div className="aspect-[4/3] overflow-hidden rounded-md border border-border bg-surface-2/60">
                      <img src={selectedPreviewUrl} alt="Previa do canhoto" className="h-full w-full object-contain" />
                    </div>
                  </div>
                ) : null}

                {uploadReport ? (
                  <div className="rounded-md border semantic-panel-info px-3 py-2 text-xs">
                    {`Imagem preparada: ${uploadReport.finalSizeKb} KB, ${uploadReport.width}x${uploadReport.height}px${uploadReport.usedCompression ? ' (comprimida)' : ''}.`}
                  </div>
                ) : null}

                {uploadError ? (
                  <div className="rounded-md border semantic-panel-danger px-3 py-2 text-sm">
                    {uploadError}
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={closeUploadModal} className="h-10 rounded-md border border-border bg-card px-4 text-sm text-text">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className={`inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold ${getSemanticToneClassName('info')} ${uploading ? 'cursor-not-allowed opacity-70' : 'hover:brightness-95'}`}
                  >
                    <UploadCloud className="h-4 w-4" /> {uploading ? 'Enviando...' : 'Enviar canhoto'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </Container>
    </div>
  );
}

export default OperationalPendencies;
