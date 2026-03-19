import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import {
  AlertTriangle,
  ImagePlus,
  RefreshCcw,
  Search,
  UploadCloud,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import Header from '../components/Header';
import { Container } from '../style/invoices';
import verifyToken from '../utils/verifyToken';
import {
  listDriversForReceiptFilters,
  listPendingReceipts,
  listWhatsappReceiptActivity,
  uploadReceipt,
} from '../services/receiptsService';
import {
  IDriver,
  IPendingReceiptRow,
  IReceiptWhatsappActivityRow,
  IReceiptWhatsappActivitySummary,
} from '../types/types';

type ReceiptsTab = 'success' | 'review' | 'error' | 'pending';

type UploadPreviewReport = {
  originalSizeKb: number;
  finalSizeKb: number;
  width: number;
  height: number;
  usedCompression: boolean;
};

const MIN_WIDTH = 1000;
const MIN_AREA = 1000000;

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

const EMPTY_WHATSAPP_SUMMARY: IReceiptWhatsappActivitySummary = {
  total: 0,
  success: 0,
  review: 0,
  error: 0,
};

const getWhatsappKindLabel = (kind: IReceiptWhatsappActivityRow['kind']) => {
  if (kind === 'success') return 'Sucesso';
  if (kind === 'review') return 'Revisar';
  return 'Erro';
};

const getWhatsappKindClasses = (kind: IReceiptWhatsappActivityRow['kind']) => {
  if (kind === 'success') {
    return 'border-emerald-500/70 bg-emerald-950/30 text-emerald-100';
  }

  if (kind === 'review') {
    return 'border-amber-500/70 bg-amber-900/25 text-amber-100';
  }

  return 'border-rose-500/70 bg-rose-900/25 text-rose-100';
};

const getWhatsappSummaryClasses = (kind: 'success' | 'review' | 'error') => {
  if (kind === 'success') return 'border-emerald-500/40 bg-emerald-950/20';
  if (kind === 'review') return 'border-amber-500/40 bg-amber-900/20';
  return 'border-rose-500/40 bg-rose-900/20';
};

const getActivityEmptyMessage = (tab: Exclude<ReceiptsTab, 'pending'>) => {
  if (tab === 'success') return 'Nenhum canhoto validado com sucesso para os filtros atuais.';
  if (tab === 'review') return 'Nenhum canhoto em revisão para os filtros atuais.';
  return 'Nenhum erro de canhoto encontrado para os filtros atuais.';
};

const buildWhatsappSenderLabel = (row: IReceiptWhatsappActivityRow) => {
  const name = String(row.sender_name || '').trim();
  const phone = String(row.sender_phone || '').trim();

  if (name && phone) return `${name} · ${phone}`;
  if (name) return name;
  if (phone) return phone;
  return '-';
};

const readImageDimensions = (file: Blob) => new Promise<{ width: number; height: number }>((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    const width = Number(image.naturalWidth || image.width || 0);
    const height = Number(image.naturalHeight || image.height || 0);
    URL.revokeObjectURL(objectUrl);

    if (!width || !height) {
      reject(new Error('Não foi possível ler as dimensões da imagem.'));
      return;
    }

    resolve({ width, height });
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('Arquivo de imagem inválido.'));
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
    throw new Error('A imagem está pequena para leitura do documento. Refaça a foto com o canhoto inteiro e maior resolução.');
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

function Receipts() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ReceiptsTab>('review');
  const [drivers, setDrivers] = useState<IDriver[]>([]);

  const [nfFilter, setNfFilter] = useState('');
  const [motoristaFilter, setMotoristaFilter] = useState('');
  const [startDate, setStartDate] = useState<string>(todayDateInput());
  const [endDate, setEndDate] = useState<string>(todayDateInput());

  const [whatsappRows, setWhatsappRows] = useState<IReceiptWhatsappActivityRow[]>([]);
  const [whatsappSummary, setWhatsappSummary] = useState<IReceiptWhatsappActivitySummary>(EMPTY_WHATSAPP_SUMMARY);
  const [pendingRows, setPendingRows] = useState<IPendingReceiptRow[]>([]);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pageError, setPageError] = useState('');

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<IPendingReceiptRow | null>(null);
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
        const rows = await listDriversForReceiptFilters();
        setDrivers(Array.isArray(rows) ? rows : []);
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

  async function refreshWhatsapp(status: Exclude<ReceiptsTab, 'pending'> = 'review') {
    setWhatsappLoading(true);
    setPageError('');
    try {
      const baseFilters = {
        nf: nfFilter.trim() || undefined,
        motoristaId: selectedMotoristaFilterId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      const [summaryResponse, rowsResponse] = await Promise.all([
        listWhatsappReceiptActivity({
          ...baseFilters,
          limit: 250,
        }),
        listWhatsappReceiptActivity({
          ...baseFilters,
          status,
          limit: 160,
        }),
      ]);

      setWhatsappRows(Array.isArray(rowsResponse?.rows) ? rowsResponse.rows : []);
      setWhatsappSummary(summaryResponse?.summary || EMPTY_WHATSAPP_SUMMARY);
    } catch (error) {
      console.error(error);
      setPageError('Não foi possível carregar a atividade do WhatsApp.');
      setWhatsappRows([]);
      setWhatsappSummary(EMPTY_WHATSAPP_SUMMARY);
    } finally {
      setWhatsappLoading(false);
    }
  }

  async function refreshPending() {
    setPendingLoading(true);
    setPageError('');
    try {
      const response = await listPendingReceipts({
        nf: nfFilter.trim() || undefined,
        motoristaId: selectedMotoristaFilterId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 120,
      });
      setPendingRows(Array.isArray(response?.rows) ? response.rows : []);
    } catch (error) {
      console.error(error);
      setPageError('Não foi possível carregar os canhotos pendentes.');
      setPendingRows([]);
    } finally {
      setPendingLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== 'pending') {
      refreshWhatsapp(activeTab);
      return;
    }

    refreshPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function handleSearch() {
    if (activeTab !== 'pending') {
      await refreshWhatsapp(activeTab);
      return;
    }

    await refreshPending();
  }

  function openUploadModal(pendingRow: IPendingReceiptRow) {
    setPendingTarget(pendingRow);
    setUploadNfId(String(pendingRow.nf_id || pendingRow.invoice_number || '').trim());
    setUploadTripId(pendingRow.trip_id ? String(pendingRow.trip_id) : '');
    setUploadMotoristaId(pendingRow.motorista_id ? String(pendingRow.motorista_id) : '');
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
    setPendingTarget(null);
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
      setUploadError('Selecione um arquivo de imagem válido (JPG, PNG ou WEBP).');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setSelectedPreviewUrl(previewUrl);
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
      await refreshPending();
    } catch (error) {
      console.error(error);

      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const payload = error.response?.data;
        const errorCode = String(payload?.error || '');
        const errorMessage = String(payload?.message || '');

        if (statusCode === 422 && errorCode === 'UNREADABLE_IMAGE') {
          setUploadError(`${errorMessage || 'Imagem ilegível.'} Dica: boa iluminação, sem tremor e canhoto inteiro no enquadramento.`);
          return;
        }

        if (statusCode === 422 && errorCode === 'UNREADABLE_OR_WRONG_CROP') {
          setUploadError('Não foi possível validar o canhoto: imagem ilegível ou recorte incorreto.');
          return;
        }

        if (statusCode === 422 && errorCode === 'MISSING_REQUIRED_FIELDS') {
          setUploadError('Campos obrigatórios não detectados no canhoto (DATA, ASSINATURA e NF-e).');
          return;
        }

        if (statusCode === 422 && errorCode === 'NF_NOT_FOUND') {
          setUploadError('NF não encontrada para a empresa autenticada.');
          return;
        }

        if (statusCode === 422 && errorCode === 'NF_MISMATCH') {
          setUploadError('A NF detectada no canhoto é diferente da NF informada no upload.');
          return;
        }

        if (statusCode === 422 && errorCode === 'NF_NOT_DETECTED') {
          setUploadError('Não foi possível extrair o número da NF no bloco de NF-e.');
          return;
        }

        if (statusCode === 409 && errorCode === 'RECEIPT_ALREADY_EXISTS') {
          setUploadError('A NF já possui canhoto postado.');
          return;
        }

        if (statusCode === 413) {
          setUploadError('Arquivo muito grande. Tente uma foto menor (até 12 MB).');
          return;
        }

        if (statusCode === 415) {
          setUploadError('Formato não suportado. Use JPG, PNG ou WEBP.');
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

  const pendingCount = pendingRows.length;
  const successCount = whatsappSummary.success || 0;
  const reviewCount = whatsappSummary.review || 0;
  const errorCount = whatsappSummary.error || 0;

  return (
    <div>
      <Header />
      <Container>
        <div className="w-full max-w-[1250px] space-y-3">
          <section className="rounded-md border border-border bg-surface/70 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-text">Canhotos</h2>
                <p className="text-sm text-muted">Acompanhe os canhotos detectados no WhatsApp por status e mantenha em pendente apenas as NFs ainda sem foto no grupo.</p>
              </div>
              <button
                type="button"
                onClick={handleSearch}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface-2/80 px-3 text-sm text-text transition hover:bg-surface-2"
              >
                <RefreshCcw className="h-4 w-4" /> Atualizar
              </button>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_170px_170px_auto]">
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
                Data início
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
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('success')}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${activeTab === 'success' ? 'border-emerald-500/70 bg-emerald-950/30 text-emerald-100' : 'border-border bg-card text-text'}`}
              >
                SUCESSO ({successCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('review')}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${activeTab === 'review' ? 'border-amber-500/70 bg-amber-900/25 text-amber-100' : 'border-border bg-card text-text'}`}
              >
                REVISÃO ({reviewCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('error')}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${activeTab === 'error' ? 'border-rose-500/70 bg-rose-900/25 text-rose-100' : 'border-border bg-card text-text'}`}
              >
                ERRO ({errorCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${activeTab === 'pending' ? 'border-sky-500/70 bg-sky-900/35 text-sky-100' : 'border-border bg-card text-text'}`}
              >
                PENDENTES ({pendingCount})
              </button>
            </div>

            {pageError ? (
              <div className="mt-3 rounded-md border border-rose-500/60 bg-rose-900/20 px-3 py-2 text-sm text-rose-100">
                {pageError}
              </div>
            ) : null}
          </section>

          {activeTab !== 'pending' ? (
            <section className="space-y-3 rounded-md border border-border bg-surface/70 p-3">
              <div className="grid gap-2 md:grid-cols-3">
                <div className={`rounded-md border px-3 py-2 ${getWhatsappSummaryClasses('success')}`}>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Sucesso</p>
                  <p className="mt-1 text-2xl font-semibold text-text">{whatsappSummary.success}</p>
                </div>
                <div className={`rounded-md border px-3 py-2 ${getWhatsappSummaryClasses('review')}`}>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Revisão</p>
                  <p className="mt-1 text-2xl font-semibold text-text">{whatsappSummary.review}</p>
                </div>
                <div className={`rounded-md border px-3 py-2 ${getWhatsappSummaryClasses('error')}`}>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Erro</p>
                  <p className="mt-1 text-2xl font-semibold text-text">{whatsappSummary.error}</p>
                </div>
              </div>

              {whatsappLoading ? (
                <p className="text-sm text-muted">Carregando atividade do WhatsApp...</p>
              ) : !whatsappRows.length ? (
                <p className="text-sm text-muted">{getActivityEmptyMessage(activeTab)}</p>
              ) : (
                <ul className="space-y-2">
                  {whatsappRows.map((row) => (
                    <li key={row.id} className="rounded-md border border-border bg-card p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-text">NF {row.invoice_number || row.danfe?.invoice_number || '-'}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getWhatsappKindClasses(row.kind)}`}>
                              {getWhatsappKindLabel(row.kind)}
                            </span>
                          </div>
                          <p className="text-muted">{row.danfe?.customer_name || 'Cliente não informado'} · {row.danfe?.city || '-'}</p>
                          <p className="text-muted">Remetente: {buildWhatsappSenderLabel(row)}</p>
                          <p className="text-muted">Motorista: {row.driver?.name || '-'}</p>
                          <p className="text-muted">Grupo: {row.group_name || row.group_id || '-'}</p>
                          <p className="text-muted">Evento: {formatDateTime(row.occurred_at)} · Backend: {row.backend_action || '-'}</p>
                          <p className="text-muted">Status atual da NF: {row.danfe?.status || '-'}</p>
                        </div>
                        <div className={`rounded-md border px-2 py-1 text-xs font-semibold ${getWhatsappKindClasses(row.kind)}`}>
                          {row.backend_mode || 'whatsapp'}
                        </div>
                      </div>

                      <div className="mt-2 rounded-md border border-border bg-surface/60 px-3 py-2">
                        <p className="text-sm font-semibold text-text">{row.title || 'Atividade do bot'}</p>
                        <p className="mt-1 text-xs text-muted">{row.message || 'Sem detalhes adicionais.'}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <section className="rounded-md border border-border bg-surface/70 p-3">
              {pendingLoading ? (
                <p className="text-sm text-muted">Carregando pendentes...</p>
              ) : !pendingRows.length ? (
                <p className="text-sm text-muted">Sem pendências de canhoto para os filtros atuais.</p>
              ) : (
                <ul className="space-y-2">
                  {pendingRows.map((row) => (
                    <li key={`pending-${row.invoice_number}`} className="rounded-md border border-border bg-card p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs">
                          <p className="font-semibold text-text">NF {row.invoice_number}</p>
                          <p className="text-muted">{row.customer_name || 'Cliente não informado'} · {row.city || '-'}</p>
                          <p className="text-muted">Motorista: {row.motorista_name || '-'}</p>
                          <p className="text-muted">Data NF: {formatDateOnly(row.invoice_date)} · Status: {row.source_status || '-'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openUploadModal(row)}
                          className="inline-flex h-10 items-center gap-2 rounded-md border border-sky-500/70 bg-sky-900/30 px-3 text-sm font-semibold text-sky-100"
                        >
                          <UploadCloud className="h-4 w-4" /> Enviar canhoto
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {isUploadModalOpen ? (
          <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/65 p-3">
            <div className="w-full max-w-[720px] rounded-md border border-border bg-surface p-3 shadow-[var(--shadow-3)]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-text">Enviar canhoto</h3>
                  <p className="text-xs text-muted">NF {pendingTarget?.invoice_number || uploadNfId || '-'} · ajuste os campos e anexe a foto.</p>
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
                      <option value="">Não informado</option>
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
                    <p className="mb-2 text-xs text-muted">Prévia</p>
                    <div className="aspect-[4/3] overflow-hidden rounded-md border border-border bg-surface-2/60">
                      <img src={selectedPreviewUrl} alt="Prévia do canhoto" className="h-full w-full object-contain" />
                    </div>
                  </div>
                ) : null}

                {uploadReport ? (
                  <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted">
                    <p>
                      Arquivo final: {uploadReport.finalSizeKb} KB ({uploadReport.width}x{uploadReport.height})
                      {uploadReport.usedCompression ? ` · comprimido de ${uploadReport.originalSizeKb} KB` : ' · sem compressão adicional'}
                    </p>
                  </div>
                ) : null}

                {uploadError ? (
                  <div className="rounded-md border border-rose-500/60 bg-rose-900/20 px-3 py-2 text-sm text-rose-100">
                    <div className="inline-flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4" />
                      <span>{uploadError}</span>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-sky-500/70 bg-sky-900/30 px-3 text-sm font-semibold text-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {uploading ? 'Enviando...' : 'Enviar canhoto'}
                  </button>
                  <button
                    type="button"
                    onClick={closeUploadModal}
                    className="inline-flex h-10 items-center rounded-md border border-border bg-card px-3 text-sm text-text"
                  >
                    Cancelar
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

export default Receipts;
