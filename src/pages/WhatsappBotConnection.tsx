import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { API_URL } from '../data';
import Header from '../components/Header';
import { Container } from '../style/invoices';
import { formatDateTimeBR } from '../utils/dateDisplay';

type ConnectionState = {
  status?: string;
  qr?: string | null;
  reason?: string | null;
  message?: string | null;
  updatedAt?: string | null;
  heartbeatAt?: string | null;
  whatsappState?: string | null;
  lastMessageReceivedAt?: string | null;
  lastMessageProcessedAt?: string | null;
  lastIgnoredMessageAt?: string | null;
  lastIgnoredReason?: string | null;
  lastMessageErrorAt?: string | null;
  lastMessageError?: string | null;
};

type BotStatusResponse = {
  status?: string;
  serviceStatus?: string;
  ready?: boolean;
  connectionState?: ConnectionState | null;
};

const STATUS_LABELS: Record<string, string> = {
  starting: 'Iniciando o bot na VPS...',
  authenticated: 'WhatsApp autenticado. Finalizando a conexão...',
  qr_required: 'Leia o QR Code para conectar a sessão da VPS.',
  ready: 'Bot conectado e pronto.',
  auth_failure: 'O WhatsApp recusou a autenticação. Aguarde um novo QR Code.',
  disconnected: 'A sessão foi desconectada. Tentando recuperar...',
  stopped: 'O serviço está parado.',
  error: 'O bot encontrou uma falha durante a inicialização.',
  timeout: 'A recuperação demorou mais que o esperado.',
  stale: 'O processo está ativo, mas o bot não confirmou atividade recente.',
  unknown: 'Consultando o estado do bot...',
};

function WhatsappBotConnection() {
  const [statusData, setStatusData] = useState<BotStatusResponse | null>(null);
  const [requestError, setRequestError] = useState('');

  const loadStatus = async () => {
    try {
      const { data } = await axios.get<BotStatusResponse>(
        `${API_URL}/users/sessions/whatsapp-bot/status`,
      );
      setStatusData(data);
      setRequestError('');
    } catch (error: any) {
      setRequestError(
        error?.response?.data?.message || 'Não foi possível consultar o bot na VPS.',
      );
    }
  };

  useEffect(() => {
    loadStatus();
    const timer = window.setInterval(loadStatus, 2500);
    return () => window.clearInterval(timer);
  }, []);

  const runtimeStatus = String(
    statusData?.status || statusData?.connectionState?.status || 'unknown',
  ).trim().toLowerCase();
  const qrValue = runtimeStatus === 'qr_required'
    ? String(statusData?.connectionState?.qr || '').trim()
    : '';
  const isReady = Boolean(statusData?.ready) && runtimeStatus === 'ready';
  const statusLabel = useMemo(
    () => STATUS_LABELS[runtimeStatus] || STATUS_LABELS.unknown,
    [runtimeStatus],
  );

  return (
    <div>
      <Header />
      <Container>
      <section className="w-full max-w-xl rounded-lg border border-border bg-surface p-6 text-text shadow-elevated">
        <p className="border-l-4 border-accent pl-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-accent">
          Integrações
        </p>
        <h1 className="mt-3 block text-2xl font-semibold">Conexão do bot do WhatsApp</h1>
        <p className="mt-2 text-sm text-muted">
          Esta página acompanha a sessão executada na VPS. Você poderá fechá-la assim que o bot estiver pronto.
        </p>

        <div className={`mt-5 rounded-lg border p-4 ${isReady ? 'semantic-panel-success' : 'semantic-panel-warning'}`}>
          <p className="font-semibold">
            {statusLabel}
          </p>
          <p className="mt-1 text-xs text-muted">
            Serviço da VPS: {statusData?.serviceStatus || 'consultando'}
          </p>
        </div>

        {statusData?.connectionState?.lastMessageReceivedAt ? (
          <p className="mt-3 text-xs text-muted">
            Última mensagem recebida: {formatDateTimeBR(statusData.connectionState.lastMessageReceivedAt)}
          </p>
        ) : null}
        {statusData?.connectionState?.lastIgnoredReason ? (
          <p className="mt-1 text-xs text-amber-400">
            Última mensagem ignorada: {statusData.connectionState.lastIgnoredReason}
          </p>
        ) : null}

        {qrValue ? (
          <div className="mt-6 flex flex-col items-center">
            <div className="rounded-lg border border-border bg-white p-4 shadow-soft">
              <QRCodeSVG
                value={qrValue}
                size={320}
                level="M"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <ol className="mt-5 w-full list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>Abra o WhatsApp no celular.</li>
              <li>Acesse Aparelhos conectados e escolha Conectar aparelho.</li>
              <li>Leia este QR Code e aguarde a confirmação automática.</li>
            </ol>
          </div>
        ) : null}

        {isReady ? (
          <div className="mt-5 rounded-lg border semantic-panel-success p-4 text-sm">
            A sessão está rodando no servidor. Fechar esta página não desconecta o bot.
          </div>
        ) : null}

        {requestError ? (
          <div className="mt-5 rounded-lg border semantic-panel-danger p-4 text-sm">
            {requestError}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={loadStatus}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-surface-2"
          >
            Atualizar agora
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            className="rounded-md border border-accent-strong bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            Fechar
          </button>
        </div>
      </section>
      </Container>
    </div>
  );
}

export default WhatsappBotConnection;
