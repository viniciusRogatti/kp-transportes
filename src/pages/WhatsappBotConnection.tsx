import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { API_URL } from '../data';

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
    <main className="flex min-h-screen items-center justify-center bg-[#07131d] px-4 py-8 text-white">
      <section className="w-full max-w-xl rounded-xl border border-white/15 bg-[#0d1c28] p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          KP Transportes
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Conexão do bot do WhatsApp</h1>
        <p className="mt-2 text-sm text-slate-300">
          Esta página acompanha a sessão executada na VPS. Você poderá fechá-la assim que o bot estiver pronto.
        </p>

        <div className={`mt-5 rounded-lg border p-4 ${isReady ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-amber-300/30 bg-amber-400/10'}`}>
          <p className={`font-semibold ${isReady ? 'text-emerald-300' : 'text-amber-200'}`}>
            {statusLabel}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Serviço da VPS: {statusData?.serviceStatus || 'consultando'}
          </p>
        </div>

        {statusData?.connectionState?.lastMessageReceivedAt ? (
          <p className="mt-3 text-xs text-slate-300">
            Última mensagem recebida: {new Date(statusData.connectionState.lastMessageReceivedAt).toLocaleString('pt-BR')}
          </p>
        ) : null}
        {statusData?.connectionState?.lastIgnoredReason ? (
          <p className="mt-1 text-xs text-amber-200">
            Última mensagem ignorada: {statusData.connectionState.lastIgnoredReason}
          </p>
        ) : null}

        {qrValue ? (
          <div className="mt-6 flex flex-col items-center">
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG
                value={qrValue}
                size={320}
                level="M"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <ol className="mt-5 w-full list-decimal space-y-1 pl-5 text-sm text-slate-300">
              <li>Abra o WhatsApp no celular.</li>
              <li>Acesse Aparelhos conectados e escolha Conectar aparelho.</li>
              <li>Leia este QR Code e aguarde a confirmação automática.</li>
            </ol>
          </div>
        ) : null}

        {isReady ? (
          <div className="mt-5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            A sessão está rodando no servidor. Fechar esta página não desconecta o bot.
          </div>
        ) : null}

        {requestError ? (
          <div className="mt-5 rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {requestError}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={loadStatus}
            className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/5"
          >
            Atualizar agora
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#03131d] hover:bg-cyan-400"
          >
            Fechar
          </button>
        </div>
      </section>
    </main>
  );
}

export default WhatsappBotConnection;
