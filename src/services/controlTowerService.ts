import {
  addDays,
  differenceInHours,
  eachDayOfInterval,
  endOfDay,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';
import {
  ActionQueueItem,
  BacklogStatus,
  ControlTowerFilters,
  DashboardCharts,
  DashboardSummary,
  EventLog,
  PaginationInput,
  PickupRequest,
  ReasonDistribution,
  ReturnBatch,
  ReturnItem,
  ReturnsTableResponse,
  SortingInput,
  TopDimension,
} from '../types/controlTower';

const STATUS_ORDER: BacklogStatus[] = ['PENDENTE', 'SOLICITADA', 'EM_ROTA', 'COLETADA', 'CANCELADA'];
const PRODUCT_TYPES = ['CX', 'UN', 'PCT', 'KG'];
const REASONS = ['Avaria', 'Temperatura', 'Produto errado', 'Validade', 'Recusa cliente', 'Falta parcial'];
const CITIES = ['Sao Paulo', 'Santos', 'Campinas', 'Guarulhos', 'Sorocaba', 'Ribeirao Preto'];
const ROUTES = ['SP-CAPITAL', 'SP-LITORAL', 'SP-INTERIOR', 'SP-METRO'];
const PRODUCTS = [
  'Camarao Rosa 30/40',
  'Salmão em Posta',
  'Tilápia Filé Premium',
  'Cream Cheese 1,5kg',
  'Gyoza Suíno 490g',
  'Lula em Anéis',
  'Atum Lombo',
  'Bacalhau Dessalgado',
  'Pescada Branca',
  'Polvo Congelado',
];
const CUSTOMERS = [
  'Mercado Atlântico',
  'Supermar Azul',
  'Distribuidora Costa Sul',
  'Emporio do Mar',
  'Rede Bom Peixe',
  'Atacado Oceano',
  'Mercantil Rota Fria',
  'Comercial Porto Norte',
  'Casa dos Pescados',
  'Varejo Mare Alta',
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pick<T>(arr: T[], seed: number) {
  return arr[Math.floor(seededRandom(seed) * arr.length) % arr.length];
}

function buildEvents(baseDate: Date, status: BacklogStatus): EventLog[] {
  const events: EventLog[] = [
    {
      at: baseDate.toISOString(),
      actor: 'Sistema',
      action: 'Devolucao confirmada',
      note: 'Lote registrado na torre de controle',
    },
  ];

  if (status !== 'PENDENTE') {
    events.push({
      at: addDays(baseDate, 0).toISOString(),
      actor: 'Torre',
      action: 'Coleta solicitada',
    });
  }

  if (status === 'EM_ROTA' || status === 'COLETADA') {
    events.push({
      at: addDays(baseDate, 1).toISOString(),
      actor: 'Expedicao',
      action: 'Marcado em rota',
    });
  }

  if (status === 'COLETADA') {
    events.push({
      at: addDays(baseDate, 2).toISOString(),
      actor: 'Conferente',
      action: 'Coleta concluida',
    });
  }

  if (status === 'CANCELADA') {
    events.push({
      at: addDays(baseDate, 1).toISOString(),
      actor: 'Torre',
      action: 'Solicitacao cancelada',
      note: 'Cliente reabastecido',
    });
  }

  return events;
}

function buildItems(seedBase: number): ReturnItem[] {
  const count = 1 + Math.floor(seededRandom(seedBase) * 4);
  const items: ReturnItem[] = [];

  for (let i = 0; i < count; i += 1) {
    const product = pick(PRODUCTS, seedBase + i * 5);
    const quantity = Math.max(1, Math.floor(seededRandom(seedBase + i * 11) * 24));
    const weightKg = Number((quantity * (0.6 + seededRandom(seedBase + i * 17) * 2.5)).toFixed(2));
    const valueAmount = Number((weightKg * (18 + seededRandom(seedBase + i * 23) * 24)).toFixed(2));
    items.push({
      productId: `PR${String(1000 + ((seedBase + i) % 9000))}`,
      productDescription: product,
      productType: pick(PRODUCT_TYPES, seedBase + i * 13),
      quantity,
      weightKg,
      valueAmount,
    });
  }

  return items;
}

function generateMockData(total = 320): ReturnBatch[] {
  const now = new Date();
  const rows: ReturnBatch[] = [];

  for (let i = 0; i < total; i += 1) {
    const dayOffset = Math.floor(seededRandom(i + 1) * 45);
    const created = subDays(now, dayOffset);
    const status = pick(STATUS_ORDER, i * 7 + 3);
    const items = buildItems(i + 31);
    const reason = pick(REASONS, i * 19 + 2);
    const customer = pick(CUSTOMERS, i * 17 + 5);
    const city = pick(CITIES, i * 29 + 9);
    const route = pick(ROUTES, i * 37 + 1);
    const pickupRequestedAt = status === 'PENDENTE' ? undefined : addDays(created, 0.2).toISOString();
    const pickupCompletedAt = status === 'COLETADA' ? addDays(created, 1.5).toISOString() : undefined;
    const ageHours = Math.max(1, differenceInHours(now, created));

    rows.push({
      id: `ret-${i + 1}`,
      batchCode: `RET-${format(created, 'yyyyMMdd')}-${String((i % 90) + 10).padStart(2, '0')}`,
      invoiceNumber: String(400000 + (i * 13) % 99999),
      customer,
      city,
      route,
      reason,
      status,
      createdAt: created.toISOString(),
      confirmedAt: addDays(created, 0.1).toISOString(),
      pickupRequestedAt,
      pickupCompletedAt,
      ageHours,
      items,
      events: buildEvents(created, status),
    });
  }

  return rows;
}

let returnsStore: ReturnBatch[] = generateMockData();

function getInterval(filters: ControlTowerFilters) {
  const now = new Date();
  const end = filters.endDate ? endOfDay(parseISO(filters.endDate)) : endOfDay(now);
  const start = filters.startDate
    ? startOfDay(parseISO(filters.startDate))
    : filters.periodPreset === 'today'
      ? startOfDay(now)
      : filters.periodPreset === '7d'
        ? startOfDay(subDays(now, 6))
        : filters.periodPreset === '30d'
          ? startOfDay(subDays(now, 29))
          : startOfDay(subDays(now, 6));

  return { start, end };
}

function applyFilters(filters: ControlTowerFilters): ReturnBatch[] {
  const { start, end } = getInterval(filters);
  const term = filters.search.trim().toLowerCase();

  return returnsStore.filter((row) => {
    const rowDate = parseISO(row.confirmedAt);
    if (!isWithinInterval(rowDate, { start, end })) return false;

    if (filters.returnStatus === 'pending' && row.status === 'COLETADA') return false;
    if (filters.returnStatus === 'confirmed' && row.status !== 'COLETADA') return false;

    if (filters.pickupStatus !== 'all' && row.status !== filters.pickupStatus) return false;
    if (filters.city && row.city !== filters.city) return false;
    if (filters.route && row.route !== filters.route) return false;
    if (filters.customer && row.customer !== filters.customer) return false;

    const hasProduct = !filters.product
      || row.items.some((item) => item.productDescription.toLowerCase().includes(filters.product.toLowerCase()));
    if (!hasProduct) return false;

    if (term) {
      const haystack = `${row.invoiceNumber} ${row.customer} ${row.city} ${row.batchCode} ${row.items.map((item) => item.productDescription).join(' ')}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    return true;
  });
}

function aggregateTop(rows: ReturnBatch[], by: 'product' | 'customer'): TopDimension[] {
  const map = new Map<string, TopDimension>();

  rows.forEach((row) => {
    if (by === 'customer') {
      const current = map.get(row.customer) || { name: row.customer, quantity: 0, weightKg: 0, valueAmount: 0 };
      current.quantity += 1;
      current.weightKg += row.items.reduce((acc, item) => acc + item.weightKg, 0);
      current.valueAmount += row.items.reduce((acc, item) => acc + item.valueAmount, 0);
      map.set(row.customer, current);
      return;
    }

    row.items.forEach((item) => {
      const key = item.productDescription;
      const current = map.get(key) || { name: key, quantity: 0, weightKg: 0, valueAmount: 0 };
      current.quantity += item.quantity;
      current.weightKg += item.weightKg;
      current.valueAmount += item.valueAmount;
      map.set(key, current);
    });
  });

  return Array.from(map.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8)
    .map((item) => ({
      ...item,
      weightKg: Number(item.weightKg.toFixed(2)),
      valueAmount: Number(item.valueAmount.toFixed(2)),
    }));
}

function reasonDistribution(rows: ReturnBatch[]): ReasonDistribution[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.reason, (counts.get(row.reason) || 0) + 1));
  return Array.from(counts.entries()).map(([reason, count]) => ({ reason, count }));
}

function toPickupStatus(status: BacklogStatus) {
  if (status === 'PENDENTE') return 'SOLICITADA' as const;
  return status;
}

export async function getControlTowerSummary(filters: ControlTowerFilters): Promise<DashboardSummary> {
  await wait(350);
  const filtered = applyFilters(filters);
  const { start, end } = getInterval(filters);
  const periodDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const prevStart = subDays(start, periodDays);
  const prevEnd = subDays(end, periodDays);

  const prevRows = returnsStore.filter((row) => {
    const d = parseISO(row.confirmedAt);
    return isWithinInterval(d, { start: prevStart, end: prevEnd });
  });

  const currentConfirmed = filtered.length;
  const currentRequested = filtered.filter((row) => row.status !== 'PENDENTE').length;
  const currentBacklog = filtered.filter((row) => ['PENDENTE', 'SOLICITADA', 'EM_ROTA'].includes(row.status)).length;
  const currentRisk = filtered.filter((row) => row.ageHours > 24 && row.status !== 'COLETADA' && row.status !== 'CANCELADA').length;

  const prevConfirmed = prevRows.length;
  const prevRequested = prevRows.filter((row) => row.status !== 'PENDENTE').length;
  const prevBacklog = prevRows.filter((row) => ['PENDENTE', 'SOLICITADA', 'EM_ROTA'].includes(row.status)).length;
  const prevRisk = prevRows.filter((row) => row.ageHours > 24 && row.status !== 'COLETADA' && row.status !== 'CANCELADA').length;

  const variation = (current: number, prev: number) => (prev === 0 ? (current > 0 ? 100 : 0) : Number((((current - prev) / prev) * 100).toFixed(1)));

  const dailyRange = eachDayOfInterval({ start, end });
  const sparkFrom = (predicate: (row: ReturnBatch) => boolean) => dailyRange.map((day) => filtered.filter((row) => format(parseISO(row.confirmedAt), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') && predicate(row)).length);

  return {
    updatedAt: new Date().toISOString(),
    metrics: [
      {
        id: 'confirmedReturns',
        label: 'Devolucoes confirmadas',
        value: currentConfirmed,
        unit: 'count',
        variationPct: variation(currentConfirmed, prevConfirmed),
        sparkline: sparkFrom(() => true),
        helpText: 'Total de lotes confirmados dentro do período filtrado. A % ao lado mostra a variação em relação ao período anterior equivalente.',
      },
      {
        id: 'requestedPickups',
        label: 'Coletas solicitadas',
        value: currentRequested,
        unit: 'count',
        variationPct: variation(currentRequested, prevRequested),
        sparkline: sparkFrom((row) => row.status !== 'PENDENTE'),
        helpText: 'Devolucoes que já possuem pedido de coleta registrado. A % ao lado mostra a variação em relação ao período anterior equivalente.',
      },
      {
        id: 'backlog',
        label: 'Aguardando coleta',
        value: currentBacklog,
        unit: 'count',
        variationPct: variation(currentBacklog, prevBacklog),
        sparkline: sparkFrom((row) => ['PENDENTE', 'SOLICITADA', 'EM_ROTA'].includes(row.status)),
        helpText: 'Fila operacional aberta: pendente, solicitada e em rota. A % ao lado mostra a variação em relação ao período anterior equivalente.',
      },
      {
        id: 'slaRisk',
        label: 'SLA em risco (>24h)',
        value: currentRisk,
        unit: 'count',
        variationPct: variation(currentRisk, prevRisk),
        sparkline: sparkFrom((row) => row.ageHours > 24 && row.status !== 'COLETADA' && row.status !== 'CANCELADA'),
        helpText: 'SLA (Acordo de Nível de Serviço): lotes sem coleta concluída em até 24h após a confirmação. A % ao lado mostra a variação em relação ao período anterior equivalente.',
      },
    ],
  };
}

export async function getControlTowerCharts(filters: ControlTowerFilters): Promise<DashboardCharts> {
  await wait(420);
  const filtered = applyFilters(filters);
  const { start, end } = getInterval(filters);
  const days = eachDayOfInterval({ start, end });

  const flowSeries = days.map((day) => {
    const key = format(day, 'yyyy-MM-dd');
    const rows = filtered.filter((row) => format(parseISO(row.confirmedAt), 'yyyy-MM-dd') === key);
    return {
      date: key,
      confirmed: rows.length,
      requested: rows.filter((row) => row.status !== 'PENDENTE').length,
      completed: rows.filter((row) => row.status === 'COLETADA').length,
    };
  });

  const backlog = STATUS_ORDER.map((status) => ({
    status,
    count: filtered.filter((row) => row.status === status).length,
  }));

  return {
    flowSeries,
    backlog,
    topProducts: aggregateTop(filtered, 'product'),
    topClients: aggregateTop(filtered, 'customer'),
    reasons: reasonDistribution(filtered),
  };
}

export async function getActionQueue(filters: ControlTowerFilters): Promise<ActionQueueItem[]> {
  await wait(280);
  const rows = applyFilters(filters);

  return rows
    .filter((row) => row.status === 'SOLICITADA' || row.status === 'EM_ROTA')
    .map<ActionQueueItem>((row) => ({
      id: row.id,
      priority: row.pickupPriority ? 'critical' : row.ageHours > 48 ? 'critical' : row.ageHours > 24 ? 'high' : 'medium',
      pickupPriority: Boolean(row.pickupPriority),
      issue:
        row.status === 'SOLICITADA'
          ? 'Coleta solicitada aguardando roteirizacao'
          : 'Coleta em rota sem baixa final',
      batchId: row.batchCode,
      invoiceNumber: row.invoiceNumber,
      customer: row.customer,
      city: row.city,
      route: row.route,
      status: row.status,
      ageHours: row.ageHours,
    }))
    .sort((a, b) => {
      if (a.pickupPriority && !b.pickupPriority) return -1;
      if (!a.pickupPriority && b.pickupPriority) return 1;
      return b.ageHours - a.ageHours;
    })
    .slice(0, 30);
}

function toTableRow(row: ReturnBatch) {
  const quantity = row.items.reduce((acc, item) => acc + item.quantity, 0);
  const weightKg = row.items.reduce((acc, item) => acc + item.weightKg, 0);
  const valueAmount = row.items.reduce((acc, item) => acc + item.valueAmount, 0);

  return {
    id: row.id,
    batchCode: row.batchCode,
    invoiceNumber: row.invoiceNumber,
    customer: row.customer,
    city: row.city,
    route: row.route,
    productCount: row.items.length,
    quantity,
    weightKg: Number(weightKg.toFixed(2)),
    valueAmount: Number(valueAmount.toFixed(2)),
    reason: row.reason,
    status: row.status,
    confirmedAt: row.confirmedAt,
    ageHours: row.ageHours,
  };
}

export async function getReturnsTable(
  filters: ControlTowerFilters,
  pagination: PaginationInput,
  sorting?: SortingInput,
): Promise<ReturnsTableResponse> {
  await wait(360);
  const rows = applyFilters(filters).map(toTableRow);

  const sorted = sorting
    ? [...rows].sort((a, b) => {
      const left = a[sorting.id];
      const right = b[sorting.id];
      if (left < right) return sorting.desc ? 1 : -1;
      if (left > right) return sorting.desc ? -1 : 1;
      return 0;
    })
    : rows;

  const start = pagination.pageIndex * pagination.pageSize;
  const end = start + pagination.pageSize;

  return {
    rows: sorted.slice(start, end),
    total: rows.length,
  };
}

export function getReturnById(id: string): ReturnBatch | null {
  return returnsStore.find((row) => row.id === id) || null;
}

export async function requestPickup(returnId: string, scheduledFor?: string, notes?: string): Promise<PickupRequest> {
  await wait(240);
  returnsStore = returnsStore.map((row) => {
    if (row.id !== returnId) return row;
    const nextStatus = toPickupStatus(row.status);
    const nowIso = new Date().toISOString();
    return {
      ...row,
      status: nextStatus,
      pickupRequestedAt: row.pickupRequestedAt || nowIso,
      events: [
        ...row.events,
        {
          at: nowIso,
          actor: 'Operador',
          action: 'Coleta solicitada manualmente',
          note: notes || undefined,
        },
      ],
    };
  });

  return {
    id: `pick-${returnId}`,
    returnId,
    status: 'SOLICITADA',
    scheduledFor,
    notes,
    updatedAt: new Date().toISOString(),
  };
}

export async function updatePickupStatus(pickupId: string, status: BacklogStatus): Promise<PickupRequest> {
  await wait(220);
  returnsStore = returnsStore.map((row) => {
    if (`pick-${row.id}` !== pickupId && row.id !== pickupId) return row;
    const nowIso = new Date().toISOString();
    return {
      ...row,
      status,
      pickupCompletedAt: status === 'COLETADA' ? nowIso : row.pickupCompletedAt,
      events: [
        ...row.events,
        {
          at: nowIso,
          actor: 'Operador',
          action: `Status da coleta atualizado para ${status}`,
        },
      ],
    };
  });

  return {
    id: pickupId.startsWith('pick-') ? pickupId : `pick-${pickupId}`,
    returnId: pickupId.replace('pick-', ''),
    status,
    updatedAt: new Date().toISOString(),
  };
}

export async function confirmReturnSubmission(batchId: string): Promise<{ ok: true }> {
  await wait(180);
  returnsStore = returnsStore.map((row) => (
    row.batchCode === batchId
      ? {
        ...row,
        events: [
          ...row.events,
          {
            at: new Date().toISOString(),
            actor: 'Torre',
            action: 'Confirmacao de submissao do lote',
          },
        ],
      }
      : row
  ));

  return { ok: true };
}

export async function addReturnObservation(returnId: string, note: string): Promise<{ ok: true }> {
  await wait(180);
  const trimmed = note.trim();
  if (!trimmed) return { ok: true };

  returnsStore = returnsStore.map((row) => (
    row.id === returnId
      ? {
        ...row,
        events: [
          ...row.events,
          {
            at: new Date().toISOString(),
            actor: 'Operador',
            action: 'Observacao adicionada',
            note: trimmed,
          },
        ],
      }
      : row
  ));

  return { ok: true };
}

export async function setPickupPriority(returnId: string, pickupPriority: boolean): Promise<{ ok: true }> {
  await wait(150);

  returnsStore = returnsStore.map((row) => (
    row.id === returnId
      ? {
        ...row,
        pickupPriority,
        events: [
          ...row.events,
          {
            at: new Date().toISOString(),
            actor: 'Operador',
            action: pickupPriority ? 'Coleta marcada como prioritária' : 'Prioridade da coleta removida',
          },
        ],
      }
      : row
  ));

  return { ok: true };
}

export function exportRowsToCsv<T extends object>(rows: T[]) {
  if (!rows.length) return '';

  const headers = Object.keys(rows[0]) as Array<keyof T>;
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csv;
}

export function getFilterOptions() {
  return {
    customers: CUSTOMERS,
    cities: CITIES,
    routes: ROUTES,
    products: PRODUCTS,
  };
}
