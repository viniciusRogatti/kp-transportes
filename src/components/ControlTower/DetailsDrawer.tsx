import { useEffect, useMemo, useState } from 'react';
import { Clock3, FileText, History, Layers3, X } from 'lucide-react';
import Button from '../ui/Button';
import { OccurrenceReason, RegisterControlTowerOccurrenceInput, ReturnBatch } from '../../types/controlTower';
import { currencyFmt, decimalFmt, formatDateTime, numberFmt } from './format';

type DrawerTab = 'summary' | 'items' | 'history' | 'actions';

interface DetailsDrawerProps {
  row: ReturnBatch | null;
  onClose: () => void;
  onAddObservation: (id: string, note: string) => void;
  onRegisterOccurrence?: (payload: RegisterControlTowerOccurrenceInput) => Promise<void> | void;
  registeringOccurrence?: boolean;
}

const tabMeta: Array<{ id: DrawerTab; label: string; icon: JSX.Element }> = [
  { id: 'summary', label: 'Resumo', icon: <FileText className="h-4 w-4" /> },
  { id: 'items', label: 'Itens', icon: <Layers3 className="h-4 w-4" /> },
  { id: 'history', label: 'Histórico', icon: <History className="h-4 w-4" /> },
  { id: 'actions', label: 'Ações', icon: <Clock3 className="h-4 w-4" /> },
];

const OCCURRENCE_REASON_OPTIONS: Array<{ value: OccurrenceReason; label: string }> = [
  { value: 'faltou_no_carregamento', label: 'Faltou no carregamento' },
  { value: 'faltou_na_carga', label: 'Faltou na carga' },
  { value: 'produto_avariado', label: 'Produto avariado' },
  { value: 'produto_invertido', label: 'Produto invertido' },
  { value: 'produto_sem_etiqueta_ou_data', label: 'Produto sem etiqueta ou data' },
  { value: 'legacy_outros', label: 'Outros' },
];

const KG_QUANTITY_MIN = 0.01;
const KG_QUANTITY_PRECISION = 1000;
const QUANTITY_EPSILON = 1e-6;

const normalizeDecimalInput = (value: string) => value.trim().replace(',', '.');
const normalizeQtyByType = (value: number, isKg: boolean) => (
  isKg ? Math.round(value * KG_QUANTITY_PRECISION) / KG_QUANTITY_PRECISION : value
);

function DetailsDrawer({ row, onClose, onAddObservation, onRegisterOccurrence, registeringOccurrence = false }: DetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('summary');
  const [note, setNote] = useState('');
  const [isOccurrenceModalOpen, setIsOccurrenceModalOpen] = useState(false);
  const [occurrenceScope, setOccurrenceScope] = useState<'invoice_total' | 'items'>('items');
  const [occurrenceReason, setOccurrenceReason] = useState<OccurrenceReason>('faltou_na_carga');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQuantityInput, setSelectedQuantityInput] = useState('1');
  const [occurrenceDescription, setOccurrenceDescription] = useState('');
  const [qualityNote, setQualityNote] = useState('');

  useEffect(() => {
    setNote('');
    setOccurrenceScope('items');
    setOccurrenceReason('faltou_na_carga');
    setSelectedProductId(row?.items[0]?.productId || '');
    setSelectedQuantityInput('1');
    setOccurrenceDescription('');
    setQualityNote('');
    setIsOccurrenceModalOpen(false);
  }, [row?.id, row?.items]);

  const totals = useMemo(() => {
    if (!row) return { quantity: 0, weight: 0, value: 0 };
    return {
      quantity: row.items.reduce((acc, item) => acc + item.quantity, 0),
      weight: row.items.reduce((acc, item) => acc + item.weightKg, 0),
      value: row.items.reduce((acc, item) => acc + item.valueAmount, 0),
    };
  }, [row]);

  const selectedItem = useMemo(() => (
    row?.items.find((item) => item.productId === selectedProductId) || null
  ), [row?.items, selectedProductId]);

  const maxSelectedQuantityRaw = selectedItem
    ? Number(normalizeDecimalInput(String(selectedItem.quantity ?? '0')))
    : 0;
  const maxSelectedQuantity = Number.isFinite(maxSelectedQuantityRaw) ? maxSelectedQuantityRaw : 0;
  const selectedItemIsKg = String(selectedItem?.productType || '').trim().toUpperCase().includes('KG');
  const selectedQuantityMin = selectedItemIsKg ? KG_QUANTITY_MIN : 1;

  const collectionWorkflowStatus = String(row?.collectionWorkflowStatus || '').toLowerCase();
  const collectionQualityStatus = String(row?.collectionQualityStatus || '').toLowerCase();
  const canRegisterOccurrenceForBatchFlow = ['enviada_em_lote', 'recebida'].includes(collectionWorkflowStatus);
  const hasOpenQualityIssue = collectionQualityStatus === 'em_tratativa' || collectionQualityStatus === 'aguardando_torre';
  const sortedHistoryEvents = useMemo(() => {
    const rawEvents = row?.events || [];

    return rawEvents
      .map((event, index) => ({
        event,
        index,
        timestamp: new Date(event.at).getTime(),
      }))
      .sort((left, right) => {
        const leftValid = Number.isFinite(left.timestamp);
        const rightValid = Number.isFinite(right.timestamp);

        if (leftValid && rightValid) {
          if (left.timestamp === right.timestamp) {
            return right.index - left.index;
          }
          return right.timestamp - left.timestamp;
        }

        if (leftValid) return -1;
        if (rightValid) return 1;
        return right.index - left.index;
      })
      .map((item) => item.event);
  }, [row?.events]);

  if (!row) return null;

  async function handleRegisterOccurrence() {
    const currentRow = row;
    if (!onRegisterOccurrence || !currentRow?.collectionRequestId) return;

    let normalizedSelectedQuantity = 0;
    if (occurrenceScope === 'items') {
      if (!selectedItem) {
        alert('Selecione um item para registrar a ocorrencia parcial.');
        return;
      }

      const rawSelectedQuantity = String(selectedQuantityInput || '').trim();
      if (!rawSelectedQuantity) {
        alert('Informe uma quantidade valida para o item.');
        return;
      }

      const parsedSelectedQuantity = Number(normalizeDecimalInput(rawSelectedQuantity));
      if (!Number.isFinite(parsedSelectedQuantity) || parsedSelectedQuantity <= 0) {
        alert('Informe uma quantidade valida para o item.');
        return;
      }

      if (!selectedItemIsKg && !Number.isInteger(parsedSelectedQuantity)) {
        alert('Para este produto, utilize quantidade inteira.');
        return;
      }

      normalizedSelectedQuantity = normalizeQtyByType(parsedSelectedQuantity, selectedItemIsKg);
      if (normalizedSelectedQuantity < selectedQuantityMin) {
        alert(`Quantidade minima permitida: ${selectedQuantityMin}.`);
        return;
      }

      if (normalizedSelectedQuantity - maxSelectedQuantity > QUANTITY_EPSILON) {
        alert(`A quantidade nao pode ser maior que ${maxSelectedQuantity} para este item.`);
        return;
      }
    }

    const payload: RegisterControlTowerOccurrenceInput = {
      collectionRequestId: currentRow.collectionRequestId,
      reason: occurrenceReason,
      scope: occurrenceScope,
      items: occurrenceScope === 'items' && selectedItem
        ? [{
          product_id: selectedItem.productId,
          product_description: selectedItem.productDescription,
          product_type: selectedItem.productType || null,
          quantity: normalizedSelectedQuantity,
        }]
        : [],
      description: occurrenceDescription.trim() || 'Divergencia identificada no recebimento da devolucao.',
      qualityNote: qualityNote.trim() || occurrenceDescription.trim(),
    };

    await Promise.resolve(onRegisterOccurrence(payload));
    setIsOccurrenceModalOpen(false);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/70" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-[520px] overflow-auto border-l border-slate-700 bg-[#0d1625] p-4 text-slate-100 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold">NF {row.invoiceNumber}</h3>
            <p className="text-xs text-slate-400">Lote {row.batchCode} | {row.customer}</p>
            {row.sourceType === 'sobra' && row.isInversion ? (
              <p className="mt-1 inline-flex rounded-full border border-amber-400/70 bg-amber-500/20 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                Sobra com inversao
              </p>
            ) : null}
          </div>
          <Button tone="secondary" className="h-8 bg-slate-800 text-slate-100" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {tabMeta.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs ${activeTab === tab.id ? 'bg-sky-900/60 text-sky-200' : 'bg-slate-800 text-slate-300'}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'summary' ? (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Status</strong><p>{row.status}</p></div>
              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Motivo</strong><p>{row.reason}</p></div>
              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Cidade/Rota</strong><p>{row.city} / {row.route}</p></div>
              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Idade</strong><p>{row.ageHours} horas</p></div>
              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Qtd Itens</strong><p>{numberFmt.format(totals.quantity)}</p></div>
              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Peso</strong><p>{decimalFmt.format(totals.weight)} kg</p></div>
              {row.loadNumber ? (
                <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Carga</strong><p>{row.loadNumber}</p></div>
              ) : null}
              {row.sourceType === 'sobra' && row.isInversion ? (
                <div className="rounded-md border border-amber-600/50 bg-amber-900/20 p-2">
                  <strong>Inversao</strong>
                  <p>NF: {row.inversionInvoiceNumber || '-'}</p>
                  <p>Produto faltante: {row.inversionMissingProductCode || '-'}</p>
                </div>
              ) : null}
            </div>
            <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Valor estimado</strong><p>{currencyFmt.format(totals.value)}</p></div>
          </div>
        ) : null}

        {activeTab === 'items' ? (
          <div className="overflow-hidden rounded-md border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300"><tr><th className="px-2 py-1 text-left">Produto</th><th className="text-left">Tipo</th><th className="text-right">Qtd</th><th className="pr-2 text-right">Kg</th></tr></thead>
              <tbody>
                {row.items.map((item, index) => (
                  <tr key={`${item.productId}-${index}`} className="border-t border-slate-800">
                    <td className="px-2 py-1">{item.productDescription}</td>
                    <td>{item.productType}</td>
                    <td className="text-right">{numberFmt.format(item.quantity)}</td>
                    <td className="pr-2 text-right">{decimalFmt.format(item.weightKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {activeTab === 'history' ? (
          <ol className="space-y-2 border-l border-slate-700 pl-3">
            {sortedHistoryEvents.map((event, index) => (
              <li key={`${event.at}-${index}`} className="relative rounded-md border border-slate-700 bg-slate-900/60 p-2 text-sm">
                <span className="absolute -left-[14px] top-3 h-2 w-2 rounded-full bg-sky-400" />
                <p className="text-xs text-slate-400">{formatDateTime(event.at)} | {event.actor}</p>
                <p>{event.action}</p>
                {event.note ? <p className="text-xs text-slate-400">{event.note}</p> : null}
              </li>
            ))}
          </ol>
        ) : null}

        {activeTab === 'actions' ? (
          <div className="space-y-2">
            <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2 text-xs text-slate-300">
              <p>
                <strong>Status da coleta:</strong> {row.collectionDisplayStatus || row.collectionWorkflowStatus || 'nao informado'}
              </p>
              {row.collectionQualityStatus ? (
                <p className="mt-1"><strong>Status da tratativa:</strong> {row.collectionQualityStatus}</p>
              ) : null}
            </div>

            {!row.collectionRequestId ? (
              <p className="rounded-md border border-slate-700 bg-slate-900/50 p-2 text-xs text-slate-400">
                Esta NF nao possui solicitacao de coleta vinculada para abrir ocorrencia nesta tela.
              </p>
            ) : !canRegisterOccurrenceForBatchFlow ? (
              <p className="rounded-md border border-slate-700 bg-slate-900/50 p-2 text-xs text-slate-400">
                Registrar ocorrência fica disponível quando a coleta estiver enviada em lote ou recebida pela Torre de Controle.
              </p>
            ) : hasOpenQualityIssue ? (
              <p className="rounded-md border border-amber-600/50 bg-amber-900/20 p-2 text-xs text-amber-200">
                Já existe ocorrência em tratativa para esta coleta.
              </p>
            ) : (
              <Button
                tone="secondary"
                className="w-full justify-center bg-amber-700/80 text-amber-50 hover:bg-amber-600"
                onClick={() => setIsOccurrenceModalOpen(true)}
              >
                Registrar ocorrência
              </Button>
            )}

            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-[96px] w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
              placeholder="Adicionar observacao operacional"
            />
            <Button
              tone="secondary"
              className="w-full justify-center bg-slate-800 text-slate-100"
              onClick={() => {
                if (!note.trim()) return;
                onAddObservation(row.id, note.trim());
                setNote('');
              }}
            >
              Salvar observacao
            </Button>
          </div>
        ) : null}
      </aside>

      {isOccurrenceModalOpen ? (
        <>
          <div className="fixed inset-0 z-[60] bg-slate-950/70" onClick={() => setIsOccurrenceModalOpen(false)} />
          <div className="fixed left-1/2 top-1/2 z-[70] w-[min(96vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-700 bg-[#0d1625] p-4 text-slate-100 shadow-[0_0_40px_rgba(0,0,0,0.55)]">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold">Registrar ocorrência da NF {row.invoiceNumber}</h4>
                <p className="text-xs text-slate-400">A ocorrência será enviada para a transportadora resolver.</p>
              </div>
              <Button tone="secondary" className="h-8 bg-slate-800 text-slate-100" onClick={() => setIsOccurrenceModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-300">Escopo</label>
                <select
                  value={occurrenceScope}
                  onChange={(event) => setOccurrenceScope(event.target.value as 'invoice_total' | 'items')}
                  className="h-10 w-full rounded-sm border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
                >
                  <option value="invoice_total">Nota total</option>
                  <option value="items">Parcial (itens)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Motivo</label>
                <select
                  value={occurrenceReason}
                  onChange={(event) => setOccurrenceReason(event.target.value as OccurrenceReason)}
                  className="h-10 w-full rounded-sm border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
                >
                  {OCCURRENCE_REASON_OPTIONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {occurrenceScope === 'items' ? (
              <div className="mt-2 grid gap-2 md:grid-cols-[2fr_1fr]">
                <div>
                  <label className="mb-1 block text-xs text-slate-300">Produto</label>
                  <select
                    value={selectedProductId}
                    onChange={(event) => setSelectedProductId(event.target.value)}
                    className="h-10 w-full rounded-sm border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
                  >
                    {!row.items.length ? <option value="">Sem itens na NF</option> : null}
                    {row.items.map((item, index) => (
                      <option key={`occ-item-${item.productId}-${index}`} value={item.productId}>
                        {item.productId} - {item.productDescription}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-300">Quantidade</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={selectedQuantityInput}
                    onChange={(event) => setSelectedQuantityInput(event.target.value)}
                    className="h-10 w-full rounded-sm border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Máx.: {maxSelectedQuantity}</p>
                </div>
              </div>
            ) : null}

            <div className="mt-2">
              <label className="mb-1 block text-xs text-slate-300">Descrição do ocorrido</label>
              <textarea
                value={occurrenceDescription}
                onChange={(event) => setOccurrenceDescription(event.target.value)}
                className="min-h-[80px] w-full rounded-sm border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
                placeholder="Descreva o problema identificado no recebimento."
              />
            </div>

            <div className="mt-2">
              <label className="mb-1 block text-xs text-slate-300">Observação para tratativa (opcional)</label>
              <textarea
                value={qualityNote}
                onChange={(event) => setQualityNote(event.target.value)}
                className="min-h-[70px] w-full rounded-sm border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
                placeholder="Informações adicionais para a transportadora."
              />
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <Button tone="secondary" className="bg-slate-800 text-slate-100" onClick={() => setIsOccurrenceModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                tone="secondary"
                className="bg-amber-700/80 text-amber-50 hover:bg-amber-600 disabled:opacity-60"
                disabled={registeringOccurrence}
                onClick={handleRegisterOccurrence}
              >
                {registeringOccurrence ? 'Registrando...' : 'Registrar ocorrência'}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

export default DetailsDrawer;
