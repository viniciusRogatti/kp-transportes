/** Local synthetic API for visual verification. No database, secrets or external services. */
const http = require('node:http');
const { Server } = require('../../backend/node_modules/socket.io');
const companies = ['mar_e_rio', 'pronto', 'brazilian_fish'];
const cities = ['Campinas', 'Hortolândia', 'Piracicaba', 'Santa Bárbara d’Oeste'];
const statuses = ['pending', 'assigned', 'delivered', 'redelivery', 'retained', 'returned'];
const routingPreview = process.env.UX_ROUTING === 'true';
const returnsPreview = process.env.UX_RETURNS === 'true';
const notes = Array.from({ length: 300 }, (_, index) => ({
  company_id: index % 3 + 1, company: { code: companies[index % 3] },
  customer_id: String(index + 1), invoice_number: String(10001 + Math.floor(index / 3)), barcode: `synthetic-${index}`,
  status: statuses[index % 6], load_number: `2026-${index % 4 + 1}`, invoice_date: '2026-10-02',
  departure_time: '08:00', created_at: '2026-10-03T09:00:00Z', updated_at: '2026-10-03T09:00:00Z',
  gross_weight: index % 7 ? '125.75' : null, total_quantity: 22, total_value: '1234.56', net_weight: '121',
  Customer: { name_or_legal_entity: index % 4 ? `Mercado de teste ${index + 1}` : 'Supermercado de teste com nome extenso para conferência de alimentos e distribuição regional',
    city: cities[index % 4], address: 'Rua de teste', address_number: '100', neighborhood: 'Centro', phone: '', state: 'SP', cnpj_or_cpf: '00000000000000', zip_code: '00000000' },
  DanfeProducts: Array.from({ length: index % 7 ? 3 : 20 }, (_, item) => ({
    quantity: item === 0 ? '12.750' : 2 + item, type: item === 0 ? 'KG' : 'CX', price: '10', total_price: '20',
    Product: { code: String(4577 + item), description: item === 0 ? 'Filé de tilápia congelado — embalagem para conferência' : `Produto de teste ${item} com descrição longa e identificação de embalagem`, type: item === 0 ? 'KG' : 'CX', price: '10' },
  })),
}));
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3100');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-company-id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, 'http://127.0.0.1:4317');
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const send = (data, status = 200) => { res.writeHead(status); res.end(JSON.stringify(data)); };
  if (url.pathname === '/login/verifyToken') return send({ valid: true });
  if (url.pathname === '/api/delivery-monitoring/address-diagnostics') return send({ error: 'Diagnóstico sintético indisponível' }, 503);
  if (url.pathname === '/api/delivery-monitoring') {
    const date = url.searchParams.get('date');
    if (date === '2026-01-02') return send({ error: 'Monitoramento sintético indisponível' }, 503);
    const deliveries = notes.slice(0, 60).map((note, index) => ({
      company_id: note.company_id, company: note.company, invoice_number: note.invoice_number,
      customer_name: note.Customer.name_or_legal_entity, city: note.Customer.city, state: 'SP',
      address: 'Rua de teste', address_number: '100', neighborhood: 'Centro', zip_code: '00000000',
      danfe_status: note.status, stop_status: note.status,
      stage: ['delivered', 'returned', 'retained'].includes(note.status) ? 'completed' : 'assigned',
      driver_id: Math.floor(index / 20) + 1, driver_name: `Motorista de teste ${Math.floor(index / 20) + 1}`,
      trip_id: Math.floor(index / 20) + 1, sequence: index % 20 + 1, driver_color: '#2563eb',
      geolocation: { latitude: null, longitude: null, status: 'missing', source: null, precision_level: 'none', last_geocoded_at: null },
    }));
    const drivers = [1, 2, 3].map((id) => ({ trip_id: id, driver_id: id, driver_name: `Motorista de teste ${id}`, run_number: 1,
      total_deliveries: 20, completed_deliveries: 0, progress_pct: 0, stage: 'assigned', color: '#2563eb',
      tracking_active: false, live_location: null, highlighted_stops: [], alerts: [],
      stops: deliveries.filter((row) => row.trip_id === id).map((row) => ({ note_id: id * 100 + row.sequence, company_id: row.company_id, invoice_number: row.invoice_number, sequence: row.sequence, status: row.stop_status })),
    }));
    return send({ date, generated_at: new Date().toISOString(), summary: {}, deliveries, drivers, alerts: [], alert_summary: { total: 0, critical: 0, warning: 0, info: 0 } });
  }
  if (url.pathname === '/drivers') return send(Array.from({ length: returnsPreview ? 30 : 1 }, (_, index) => ({ id: index + 1, name: index ? `Motorista teste ${String(index + 1).padStart(2, '0')}` : 'Motorista de teste' })));
  if (url.pathname === '/cars') return send(Array.from({ length: returnsPreview ? 30 : 1 }, (_, index) => ({ id: index + 1, model: 'Caminhão de teste', license_plate: `TEST${String(index).padStart(3, '0')}` })));
  if (url.pathname === '/products') return send(notes[0].DanfeProducts.map((item) => item.Product));
  if (url.pathname.startsWith('/trips/suggestions/vehicle/')) return send({ suggestion: null });
  if (url.pathname === '/returns/batches/search' || url.pathname === '/occurrences/search' || url.pathname.includes('/collection-requests')) return send([]);
  if (url.pathname.startsWith('/return-data/occurrences/by-invoice/')) return send({ occurrences: [], consolidated_status: 'not_found', latest_base_update: '2026-10-01T12:00:00Z' });
  if (url.pathname === '/return-data/occurrences/overview') return send({ latest_base_update: '2026-10-01T12:00:00Z' });
  if (url.pathname.startsWith('/danfes/nf/') && !url.pathname.includes('/journey')) return send(returnsPreview ? { ...notes[0], DanfeProducts: [{ quantity: 5, type: 'CX', price: '200', total_price: '1000', Product: { code: '4577', description: 'PEIXE CONGELADO CX 20KG', type: 'CX' } }] } : notes[0]);
  if (url.pathname === '/returns/batches/create' || url.pathname === '/occurrences/create') return send({ error: 'Falha de teste: nenhum registro foi gravado.' }, 503);
  if (url.pathname === '/danfes') {
    const date = url.searchParams.get('operationDate');
    if (date === '2026-01-01') return send([]);
    if (date === '2026-01-02') return send({ error: 'Falha sintética' }, 503);
    return send(notes);
  }
  if (url.pathname.startsWith('/trips/search/date/')) return send([{ id: 77, date: '03/10/2026', driver_id: 1, car_id: 1, run_number: 1, gross_weight: '1500', Driver: { id: 1, name: 'Motorista de teste' },
    TripNotes: routingPreview ? notes.slice(0, 30).map((note, index) => ({ id: index + 1, company_id: note.company_id, company_code: note.company.code, invoice_number: note.invoice_number, customer_name: note.Customer.name_or_legal_entity, city: note.Customer.city, order: index + 1, status: index % 4 ? 'assigned' : 'delivered', gross_weight: note.gross_weight, box_quantity: 2 })) : [],
    Car: { id: 1, model: 'Caminhão de teste', license_plate: 'TEST000' } }]);
  if (url.pathname === '/danfes/search-context') return send(Object.fromEntries((body.invoices || []).map((invoice) => {
    const row = notes.find((note) => note.company_id === invoice.company_id && note.invoice_number === invoice.invoice_number);
    return [`${invoice.company_id}::${invoice.invoice_number}`, { driver_name: row?.status === 'pending' ? null : 'Motorista de teste', trip_id: row?.status === 'pending' ? null : 77,
      occurrence_count: 0, occurrence_pending_count: 0, occurrence_resolved_count: 0, credit_letter_count: 0, credit_letter_pending_count: 0, credit_letter_completed_count: 0, return_count: 0, return_types: [], return_batches: [] }];
  })));
  if (url.pathname === '/api/route-catalog') return send({ version: 1, routes: [{ id: 'campinas', name: 'Campinas e região', cities: cities.slice(0, 2) }, { id: 'interior', name: 'Interior', cities: cities.slice(2) }] });
  if (url.pathname === '/api/notifications') return send({ notifications: [] });
  if (url.pathname === '/api/tutorial-progress/current') return send({ current_version: '1', progress: { id: 1, user_id: 1, status: 'skipped', tutorial_version: '1', completed_modules: [], skipped_steps: [] } });
  if (url.pathname.startsWith('/trips/add-note/')) return send({ error: 'Falha de teste: preenchimento deve ser preservado.' }, 409);
  if (url.pathname.includes('/journey')) return send({ error: 'Jornada não faz parte desta fixture.' }, 404);
  return send({ error: 'Endpoint não simulado' }, 404);
});
new Server(server, { cors: { origin: 'http://127.0.0.1:3100' } });
server.listen(4317, '127.0.0.1', () => console.log('Synthetic UX API: http://127.0.0.1:4317 (300 notes; Jan 1 empty; Jan 2 error)'));
