import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Badge from '../components/ui/Badge';
import { API_URL } from '../data';
import { Container } from '../style/invoices';
import verifyToken from '../utils/verifyToken';

type CompanyOption = {
  id: number;
  code: string;
  name: string;
  tax_id: string;
};

type CteConfigPayload = {
  company: CompanyOption | null;
  configuration: Record<string, any> | null;
  active_certificate: {
    id: number;
    file_name: string;
    file_extension: string;
    valid_from: string | null;
    valid_until: string | null;
    expires_in_days: number | null;
    expires_soon: boolean;
  } | null;
};

type CtePreview = {
  company: CompanyOption | null;
  invoice: {
    company_id: number;
    invoice_number: string;
    access_key: string | null;
    freight_mode: string | null;
    customer_name: string | null;
    customer_city: string | null;
    customer_state: string | null;
    total_quantity: number;
    gross_weight: number;
    invoice_total_value: number;
    load_number: string | null;
  };
  configuration_snapshot: {
    environment: 'homologation' | 'production';
    issuer_name: string | null;
    issuer_tax_id: string | null;
    issuer_state: string | null;
    intra_state_cfop: string | null;
    inter_state_cfop: string | null;
    issuer_rntrc: string | null;
  } | null;
  certificate_summary: {
    id: number;
    file_name: string;
    valid_until: string | null;
  } | null;
  cfop: string | null;
  taker_role: string | null;
  rates: {
    freight_per_kg: number;
    ad_valorem_percent: number;
    gris_percent: number;
    toll_fee: number;
    dispatch_fee: number;
    insurance_fee: number;
  };
  components: {
    freight_per_kg_amount: number;
    ad_valorem_amount: number;
    gris_amount: number;
    toll_fee_amount: number;
    dispatch_fee_amount: number;
    insurance_amount: number;
  };
  totals: {
    total_invoice_value: number;
    total_weight: number;
    total_volumes: number;
    total_service_value: number;
  };
  warnings: string[];
};

type RecentCte = {
  id: number;
  number: number | null;
  series: string;
  status: string;
  cfop: string | null;
  taker_role: string | null;
  total_service_value: string | null;
  created_at: string;
  first_invoice: {
    invoice_number: string;
    recipient_name: string | null;
    recipient_city: string | null;
    recipient_state: string | null;
  } | null;
};

const emptyConfigForm = () => ({
  freight_per_kg: '',
  ad_valorem_percent: '',
  gris_percent: '',
  toll_fee: '',
  dispatch_fee: '',
  insurance_fee: '',
  intra_state_cfop: '',
  inter_state_cfop: '',
  issuer_name: '',
  issuer_trade_name: '',
  issuer_tax_id: '',
  issuer_state_registration: '',
  issuer_rntrc: '',
  issuer_crt: '',
  issuer_phone: '',
  issuer_email: '',
  issuer_street: '',
  issuer_number: '',
  issuer_neighborhood: '',
  issuer_city_code: '',
  issuer_city_name: '',
  issuer_state: '',
  issuer_zip_code: '',
  environment: 'homologation',
  notes: '',
});

const CONFIG_FIELDS: Array<{ key: string; label: string; className?: string }> = [
  { key: 'freight_per_kg', label: 'Frete por KG', className: 'xl:col-span-1' },
  { key: 'ad_valorem_percent', label: 'Ad valorem %', className: 'xl:col-span-1' },
  { key: 'gris_percent', label: 'GRIS %', className: 'xl:col-span-1' },
  { key: 'toll_fee', label: 'Pedágio fixo', className: 'xl:col-span-1' },
  { key: 'dispatch_fee', label: 'Taxa de despacho', className: 'xl:col-span-1' },
  { key: 'insurance_fee', label: 'Seguro fixo', className: 'xl:col-span-1' },
  { key: 'intra_state_cfop', label: 'CFOP intraestadual', className: 'xl:col-span-1' },
  { key: 'inter_state_cfop', label: 'CFOP interestadual', className: 'xl:col-span-1' },
  { key: 'issuer_name', label: 'Razão social emissora', className: 'xl:col-span-3' },
  { key: 'issuer_trade_name', label: 'Nome fantasia', className: 'xl:col-span-2' },
  { key: 'issuer_tax_id', label: 'CNPJ emissor', className: 'xl:col-span-1' },
  { key: 'issuer_state_registration', label: 'Inscrição estadual', className: 'xl:col-span-1' },
  { key: 'issuer_rntrc', label: 'RNTRC', className: 'xl:col-span-1' },
  { key: 'issuer_crt', label: 'CRT', className: 'xl:col-span-1' },
  { key: 'issuer_phone', label: 'Telefone', className: 'xl:col-span-1' },
  { key: 'issuer_email', label: 'Email', className: 'xl:col-span-2' },
  { key: 'issuer_street', label: 'Logradouro', className: 'xl:col-span-3' },
  { key: 'issuer_number', label: 'Número', className: 'xl:col-span-1' },
  { key: 'issuer_neighborhood', label: 'Bairro', className: 'xl:col-span-2' },
  { key: 'issuer_city_code', label: 'Código município IBGE', className: 'xl:col-span-1' },
  { key: 'issuer_city_name', label: 'Município', className: 'xl:col-span-2' },
  { key: 'issuer_state', label: 'UF', className: 'xl:col-span-1' },
  { key: 'issuer_zip_code', label: 'CEP', className: 'xl:col-span-1' },
];

const statusTone = (status: string) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'authorized') return 'success' as const;
  if (normalized === 'rejected' || normalized === 'failed' || normalized === 'cancelled') return 'danger' as const;
  return 'warning' as const;
};

const statusLabel = (status: string) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'authorized') return 'Autorizado';
  if (normalized === 'rejected') return 'Rejeitado';
  if (normalized === 'failed') return 'Falha';
  if (normalized === 'cancelled') return 'Cancelado';
  if (normalized === 'ready') return 'Pronto';
  if (normalized === 'draft') return 'Rascunho';
  return status || 'Sem status';
};

const money = (value: number | string | null | undefined) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number(value || 0));

function CteManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const permission = String(localStorage.getItem('user_permission') || '').trim().toLowerCase();
  const isAdminManager = ['admin', 'master'].includes(permission);

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [configForm, setConfigForm] = useState(emptyConfigForm);
  const [certificateInfo, setCertificateInfo] = useState<CteConfigPayload['active_certificate']>(null);
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [preview, setPreview] = useState<CtePreview | null>(null);
  const [recentCtes, setRecentCtes] = useState<RecentCte[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState(searchParams.get('nf') || '');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [certificateValidFrom, setCertificateValidFrom] = useState('');
  const [certificateValidUntil, setCertificateValidUntil] = useState('');
  const [certificateSubjectName, setCertificateSubjectName] = useState('');
  const [certificateIssuerName, setCertificateIssuerName] = useState('');
  const [certificateThumbprint, setCertificateThumbprint] = useState('');

  const selectedCompany = useMemo(
    () => companies.find((item) => String(item.id) === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  );

  useEffect(() => {
    const token = localStorage.getItem('token');

    const boot = async () => {
      if (!token) {
        navigate('/');
        return;
      }

      const isValidToken = await verifyToken(token);
      if (!isValidToken) {
        navigate('/');
        return;
      }

      if (!['admin', 'master', 'expedicao', 'conferente'].includes(permission)) {
        navigate('/home');
        return;
      }

      await loadCompanies();
    };

    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) return;

    loadConfiguration(selectedCompanyId);
    loadRecentCtes(selectedCompanyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  async function loadCompanies() {
    try {
      setLoading(true);
      setErrorMessage('');
      const { data } = await axios.get<CompanyOption[]>(`${API_URL}/ctes/companies`);
      const rows = Array.isArray(data) ? data : [];
      setCompanies(rows);

      const queryCompanyId = searchParams.get('company_id');
      const defaultCompanyId = queryCompanyId && rows.some((item) => String(item.id) === queryCompanyId)
        ? queryCompanyId
        : rows[0]
          ? String(rows[0].id)
          : '';
      setSelectedCompanyId(defaultCompanyId);
    } catch (error: any) {
      console.error(error);
      const status = Number(error?.response?.status || 0);
      const backendMessage = String(
        error?.response?.data?.message
        || error?.response?.data?.error
        || '',
      ).trim();

      if (status === 404) {
        setErrorMessage('O endpoint /ctes/companies não existe no backend atual. Falta subir o backend novo e reiniciar a API.');
        return;
      }

      if (status === 401) {
        setErrorMessage('Sua sessão não foi aceita pelo backend do CT-e. Faça login novamente.');
        return;
      }

      if (status === 403) {
        setErrorMessage(backendMessage || 'Seu usuário não tem permissão para acessar o módulo de CT-e.');
        return;
      }

      if (status >= 500) {
        setErrorMessage(backendMessage || 'O backend do CT-e respondeu com erro interno. Verifique deploy, restart da API e migrations.');
        return;
      }

      setErrorMessage(backendMessage || 'Não foi possível carregar as empresas do CT-e.');
    } finally {
      setLoading(false);
    }
  }

  async function loadConfiguration(companyId: string) {
    try {
      setLoading(true);
      const { data } = await axios.get<CteConfigPayload>(`${API_URL}/ctes/config`, {
        params: { company_id: companyId },
      });
      const next = {
        ...emptyConfigForm(),
        ...(data?.configuration || {}),
      };
      Object.keys(next).forEach((key) => {
        const value = (next as Record<string, any>)[key];
        (next as Record<string, any>)[key] = value === null || value === undefined ? '' : String(value);
      });
      setConfigForm(next);
      setCertificateInfo(data?.active_certificate || null);
    } catch (error) {
      console.error(error);
      setConfigForm(emptyConfigForm());
      setCertificateInfo(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecentCtes(companyId: string) {
    try {
      const { data } = await axios.get<RecentCte[]>(`${API_URL}/ctes/recent`, {
        params: { company_id: companyId, limit: 10 },
      });
      setRecentCtes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setRecentCtes([]);
    }
  }

  async function handleSaveConfig() {
    if (!selectedCompanyId) return;

    try {
      setSavingConfig(true);
      setErrorMessage('');
      setSuccessMessage('');
      await axios.put(`${API_URL}/ctes/config`, {
        company_id: selectedCompanyId,
        ...configForm,
      });
      setSuccessMessage('Configuração de CT-e salva com sucesso.');
      await loadConfiguration(selectedCompanyId);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.response?.data?.message || 'Não foi possível salvar a configuração de CT-e.');
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleUploadCertificate() {
    if (!selectedCompanyId || !certificateFile) return;

    try {
      setUploadingCertificate(true);
      setErrorMessage('');
      setSuccessMessage('');

      const formData = new FormData();
      formData.append('company_id', selectedCompanyId);
      formData.append('password', certificatePassword);
      formData.append('certificate', certificateFile);
      if (certificateValidFrom) formData.append('valid_from', certificateValidFrom);
      if (certificateValidUntil) formData.append('valid_until', certificateValidUntil);
      if (certificateSubjectName) formData.append('subject_name', certificateSubjectName);
      if (certificateIssuerName) formData.append('issuer_name', certificateIssuerName);
      if (certificateThumbprint) formData.append('thumbprint', certificateThumbprint);

      await axios.post(`${API_URL}/ctes/certificate`, formData);
      setSuccessMessage('Certificado salvo com sucesso.');
      setCertificateFile(null);
      setCertificatePassword('');
      setCertificateValidFrom('');
      setCertificateValidUntil('');
      setCertificateSubjectName('');
      setCertificateIssuerName('');
      setCertificateThumbprint('');
      await loadConfiguration(selectedCompanyId);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.response?.data?.message || 'Não foi possível salvar o certificado.');
    } finally {
      setUploadingCertificate(false);
    }
  }

  async function handleLoadPreview() {
    if (!selectedCompanyId || !invoiceNumber.trim()) return;

    try {
      setPreviewLoading(true);
      setErrorMessage('');
      const { data } = await axios.get<CtePreview>(`${API_URL}/ctes/preview/invoice/${encodeURIComponent(invoiceNumber.trim())}`, {
        params: { company_id: selectedCompanyId },
      });
      setPreview(data);
    } catch (error: any) {
      console.error(error);
      setPreview(null);
      setErrorMessage(error?.response?.data?.message || 'Não foi possível montar a prévia do CT-e.');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCreateDraft() {
    if (!selectedCompanyId || !invoiceNumber.trim()) return;

    try {
      setCreatingDraft(true);
      setErrorMessage('');
      setSuccessMessage('');
      await axios.post(`${API_URL}/ctes/drafts`, {
        company_id: selectedCompanyId,
        invoice_number: invoiceNumber.trim(),
      });
      setSuccessMessage('Rascunho de CT-e criado com sucesso.');
      await Promise.all([
        handleLoadPreview(),
        loadRecentCtes(selectedCompanyId),
      ]);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.response?.data?.message || 'Não foi possível criar o rascunho do CT-e.');
    } finally {
      setCreatingDraft(false);
    }
  }

  const explanationRows = useMemo(() => {
    if (!preview) return [];

    return [
      `Frete peso: ${preview.totals.total_weight} kg x ${money(preview.rates.freight_per_kg)} = ${money(preview.components.freight_per_kg_amount)}`,
      `Ad valorem: ${money(preview.totals.total_invoice_value)} x ${preview.rates.ad_valorem_percent}% = ${money(preview.components.ad_valorem_amount)}`,
      `GRIS: ${money(preview.totals.total_invoice_value)} x ${preview.rates.gris_percent}% = ${money(preview.components.gris_amount)}`,
      `Pedágio fixo: ${money(preview.components.toll_fee_amount)}`,
      `Despacho fixo: ${money(preview.components.dispatch_fee_amount)}`,
      `Seguro fixo: ${money(preview.components.insurance_amount)}`,
    ];
  }, [preview]);

  return (
    <div>
      <Header />
      <Container>
        <div className="w-full max-w-[1180px] space-y-4">
          <section className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold text-text">Gestão operacional de CT-e</h1>
                <p className="mt-1 max-w-[780px] text-sm text-muted">
                  Esta fase cobre configuração por empresa, certificado A1, pré-cálculo do frete e criação de rascunho.
                  A transmissão para SEFAZ e o relatório XLSX final ainda dependem da próxima etapa e do modelo real da planilha.
                </p>
              </div>
              <div className="min-w-[220px]">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Empresa</label>
                <select
                  value={selectedCompanyId}
                  onChange={(event) => setSelectedCompanyId(event.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent"
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {`${company.name} (${company.code})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedCompany ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                <span className="rounded-full border border-border bg-surface px-3 py-1">{`CNPJ base: ${selectedCompany.tax_id || '-'}`}</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1">{`Permissão: ${permission}`}</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1">
                  {isAdminManager ? 'Pode editar configuração e certificado' : 'Pode gerar prévia e rascunho'}
                </span>
              </div>
            ) : null}

            {successMessage ? <p className="mt-3 text-sm text-emerald-400">{successMessage}</p> : null}
            {errorMessage ? <p className="mt-2 text-sm text-rose-400">{errorMessage}</p> : null}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-text">Configuração fiscal e de frete</h2>
                  <p className="mt-1 text-sm text-muted">
                    Os campos em branco são tratados como zero nos componentes opcionais. O cálculo usa o valor total da NF, peso bruto e volumes importados do XML.
                  </p>
                </div>
                <Badge tone={isAdminManager ? 'info' : 'neutral'}>
                  {isAdminManager ? 'Edição liberada' : 'Somente leitura'}
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {CONFIG_FIELDS.map(({ key, label, className }) => (
                  <label key={key} className={className || 'block'}>
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
                    <input
                      type="text"
                      value={(configForm as Record<string, string>)[key]}
                      onChange={(event) => setConfigForm((prev) => ({ ...prev, [key]: event.target.value }))}
                      disabled={!isAdminManager}
                      className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-70"
                    />
                  </label>
                ))}

                <label className="xl:col-span-2">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Ambiente</span>
                  <select
                    value={configForm.environment}
                    onChange={(event) => setConfigForm((prev) => ({ ...prev, environment: event.target.value }))}
                    disabled={!isAdminManager}
                    className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="homologation">Homologação</option>
                    <option value="production">Produção</option>
                  </select>
                </label>
              </div>

              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Observações</span>
                <textarea
                  value={configForm.notes}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, notes: event.target.value }))}
                  disabled={!isAdminManager}
                  className="min-h-[96px] w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-70"
                />
              </label>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={!isAdminManager || savingConfig || !selectedCompanyId}
                  className="inline-flex h-10 items-center rounded-md border border-white/15 bg-gradient-to-r from-accent to-accent-strong px-4 text-sm font-semibold text-[#04131e] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingConfig ? 'Salvando...' : 'Salvar configuração'}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-text">Certificado A1</h2>
                    <p className="mt-1 text-sm text-muted">
                      Nesta fase o arquivo é armazenado e a validade pode ser informada manualmente para alerta. A leitura automática do conteúdo do PFX fica para a integração fiscal.
                    </p>
                  </div>
                  {certificateInfo ? (
                    <Badge tone={certificateInfo.expires_soon ? 'warning' : 'success'}>
                      {certificateInfo.expires_soon ? 'Vence em breve' : 'Ativo'}
                    </Badge>
                  ) : (
                    <Badge tone="danger">Sem certificado</Badge>
                  )}
                </div>

                <div className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm">
                  <p><strong>Atual:</strong> {certificateInfo?.file_name || 'Nenhum certificado ativo'}</p>
                  <p><strong>Validade:</strong> {certificateInfo?.valid_until || '-'}</p>
                  <p><strong>Alerta:</strong> {certificateInfo?.expires_in_days !== null && certificateInfo?.expires_in_days !== undefined ? `${certificateInfo.expires_in_days} dia(s)` : 'Sem data informada'}</p>
                </div>

                <div className="mt-3 space-y-3">
                  <input
                    type="file"
                    accept=".pfx,.p12"
                    disabled={!isAdminManager}
                    onChange={(event) => setCertificateFile(event.target.files?.[0] || null)}
                    className="block w-full text-sm text-text disabled:cursor-not-allowed disabled:opacity-70"
                  />
                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      type="password"
                      placeholder="Senha do certificado"
                      value={certificatePassword}
                      onChange={(event) => setCertificatePassword(event.target.value)}
                      disabled={!isAdminManager}
                      className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-70"
                    />
                    <input
                      type="date"
                      value={certificateValidFrom}
                      onChange={(event) => setCertificateValidFrom(event.target.value)}
                      disabled={!isAdminManager}
                      className="h-10 rounded-md border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-70"
                    />
                    <input
                      type="date"
                      value={certificateValidUntil}
                      onChange={(event) => setCertificateValidUntil(event.target.value)}
                      disabled={!isAdminManager}
                      className="h-10 rounded-md border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-70"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Thumbprint/serial (opcional)"
                      value={certificateThumbprint}
                      onChange={(event) => setCertificateThumbprint(event.target.value)}
                      disabled={!isAdminManager}
                      className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-70"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Titular do certificado (opcional)"
                      value={certificateSubjectName}
                      onChange={(event) => setCertificateSubjectName(event.target.value)}
                      disabled={!isAdminManager}
                      className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-70"
                    />
                    <input
                      type="text"
                      placeholder="Emissor/Autoridade (opcional)"
                      value={certificateIssuerName}
                      onChange={(event) => setCertificateIssuerName(event.target.value)}
                      disabled={!isAdminManager}
                      className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-70"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleUploadCertificate}
                    disabled={!isAdminManager || uploadingCertificate || !certificateFile || !certificatePassword}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface-2 px-4 text-sm font-semibold text-text transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {uploadingCertificate ? 'Enviando...' : 'Salvar certificado'}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <h2 className="text-lg font-semibold text-text">Últimos CT-es enviados/gerados</h2>
                <p className="mt-1 text-sm text-muted">
                  Verde para autorizado, vermelho para rejeitado/falha, amarelo para processamento interno/rascunho.
                </p>

                <div className="mt-3 space-y-2">
                  {!recentCtes.length ? (
                    <p className="text-sm text-muted">Nenhum CT-e encontrado para a empresa selecionada.</p>
                  ) : recentCtes.map((cte) => (
                    <div key={cte.id} className="rounded-lg border border-border bg-surface p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-text">
                            {cte.number ? `CT-e ${cte.number}/${cte.series}` : `Rascunho #${cte.id}`}
                          </p>
                          <p className="text-xs text-muted">
                            {cte.first_invoice ? `NF ${cte.first_invoice.invoice_number} • ${cte.first_invoice.recipient_name || '-'}` : 'Sem NF vinculada'}
                          </p>
                        </div>
                        <Badge tone={statusTone(cte.status)}>{statusLabel(cte.status)}</Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-muted md:grid-cols-2">
                        <p>{`CFOP: ${cte.cfop || '-'}`}</p>
                        <p>{`Tomador: ${cte.taker_role || '-'}`}</p>
                        <p>{`Frete: ${money(cte.total_service_value)}`}</p>
                        <p>{`Criado em: ${new Date(cte.created_at).toLocaleString('pt-BR')}`}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">NF para pré-emissão</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                  placeholder="Digite o número da NF"
                  className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent"
                />
              </div>
              <button
                type="button"
                onClick={handleLoadPreview}
                disabled={previewLoading || !invoiceNumber.trim() || !selectedCompanyId}
                className="inline-flex h-10 items-center rounded-md border border-border bg-surface-2 px-4 text-sm font-semibold text-text transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-70"
              >
                {previewLoading ? 'Calculando...' : 'Gerar prévia'}
              </button>
              <button
                type="button"
                onClick={handleCreateDraft}
                disabled={creatingDraft || !preview || !selectedCompanyId}
                className="inline-flex h-10 items-center rounded-md border border-white/15 bg-gradient-to-r from-accent to-accent-strong px-4 text-sm font-semibold text-[#04131e] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {creatingDraft ? 'Criando rascunho...' : 'Criar rascunho de CT-e'}
              </button>
            </div>

            {!preview ? (
              <p className="mt-4 text-sm text-muted">
                Selecione a empresa, informe a NF e gere a prévia para validar peso, valor, tomador, CFOP e cálculo do frete antes da emissão.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-surface p-4">
                    <h3 className="text-base font-semibold text-text">{`NF ${preview.invoice.invoice_number}`}</h3>
                    <div className="mt-2 grid gap-2 text-sm text-muted md:grid-cols-2">
                      <p>{`Cliente: ${preview.invoice.customer_name || '-'}`}</p>
                      <p>{`Cidade/UF: ${preview.invoice.customer_city || '-'} / ${preview.invoice.customer_state || '-'}`}</p>
                      <p>{`Peso bruto: ${preview.invoice.gross_weight} kg`}</p>
                      <p>{`Volumes: ${preview.invoice.total_quantity}`}</p>
                      <p>{`Valor total da NF: ${money(preview.invoice.invoice_total_value)}`}</p>
                      <p>{`Carga: ${preview.invoice.load_number || '-'}`}</p>
                      <p>{`Chave de acesso: ${preview.invoice.access_key || '-'}`}</p>
                      <p>{`modFrete original: ${preview.invoice.freight_mode || '-'}`}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface p-4">
                    <h3 className="text-base font-semibold text-text">Resultado sugerido</h3>
                    <div className="mt-2 grid gap-2 text-sm text-muted md:grid-cols-2">
                      <p>{`CFOP: ${preview.cfop || 'Não definido'}`}</p>
                      <p>{`Tomador: ${preview.taker_role || 'Revisão manual'}`}</p>
                      <p>{`Ambiente: ${preview.configuration_snapshot?.environment || '-'}`}</p>
                      <p>{`Certificado: ${preview.certificate_summary?.file_name || 'Ausente'}`}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-surface p-4">
                    <h3 className="text-base font-semibold text-text">Como o cálculo foi montado</h3>
                    <div className="mt-3 space-y-2 text-sm text-muted">
                      {explanationRows.map((row) => (
                        <p key={row}>{row}</p>
                      ))}
                    </div>
                    <div className="mt-4 rounded-lg border border-border bg-card px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total da prestação sugerido</p>
                      <p className="mt-1 text-2xl font-semibold text-text">{money(preview.totals.total_service_value)}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface p-4">
                    <h3 className="text-base font-semibold text-text">Alertas da prévia</h3>
                    {!preview.warnings.length ? (
                      <p className="mt-2 text-sm text-emerald-400">Nenhum alerta crítico encontrado para a fase operacional.</p>
                    ) : (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-300">
                        {preview.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold text-text">O que ainda não está nesta etapa</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>Assinatura do XML CT-e 4.00 com o certificado e transmissão para a SEFAZ.</li>
              <li>Tratamento completo de rejeições, cancelamento, substituição e complementação fiscal.</li>
              <li>Geração fiel do XLSX de canhotos com base no arquivo real `rel_globalizado_942.xlsx`.</li>
              <li>Leitura automática da validade do PFX/P12 sem apoio de biblioteca específica.</li>
            </ul>
          </section>
        </div>
      </Container>
      {loading ? <div className="fixed bottom-4 right-4 rounded-full border border-border bg-card px-4 py-2 text-xs text-muted shadow-soft">Atualizando CT-e...</div> : null}
    </div>
  );
}

export default CteManagement;
