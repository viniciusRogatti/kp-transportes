import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import { API_URL } from '../data';
import verifyToken from '../utils/verifyToken';
import {
  ICollectionDashboard,
  ICollectionRequest,
  IControlTowerReturn,
  IControlTowerReturnsDashboard,
} from '../types/types';

function ControlTowerCollections() {
  const navigate = useNavigate();
  const userPermission = localStorage.getItem('user_permission') || '';
  const isInternalUser = ['admin', 'master', 'user'].includes(userPermission);

  const [dashboard, setDashboard] = useState<ICollectionDashboard | null>(null);
  const [searchRows, setSearchRows] = useState<ICollectionRequest[]>([]);

  const [returnsDashboard, setReturnsDashboard] = useState<IControlTowerReturnsDashboard | null>(null);
  const [returnRows, setReturnRows] = useState<IControlTowerReturn[]>([]);

  const [form, setForm] = useState({
    invoice_number: '',
    customer_name: '',
    city: '',
    product_id: '',
    product_description: '',
    product_type: '',
    quantity: 1,
    notes: '',
  });

  const [filters, setFilters] = useState({
    invoice_number: '',
    customer_name: '',
    city: '',
    product_term: '',
    status: 'all',
  });

  const [returnFilters, setReturnFilters] = useState({
    invoice_number: '',
    customer_name: '',
    city: '',
  });

  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [saving, setSaving] = useState(false);

  const [loadingReturnsDashboard, setLoadingReturnsDashboard] = useState(false);
  const [loadingReturnsSearch, setLoadingReturnsSearch] = useState(false);

  const topClientsMax = useMemo(() => Math.max(...(dashboard?.top_clients.map((item) => item.requests) || [1])), [dashboard]);
  const topProductsMax = useMemo(() => Math.max(...(dashboard?.top_products.map((item) => item.quantity) || [1])), [dashboard]);

  const topReturnClientsMax = useMemo(() => Math.max(...(returnsDashboard?.top_customers.map((item) => item.returns) || [1])), [returnsDashboard]);
  const topReturnedProductsMax = useMemo(() => Math.max(...(returnsDashboard?.top_products.map((item) => item.quantity) || [1])), [returnsDashboard]);

  useEffect(() => {
    const token = localStorage.getItem('token');

    const validateAndLoad = async () => {
      if (!token) {
        navigate('/');
        return;
      }

      const valid = await verifyToken(token);
      if (!valid) {
        navigate('/');
        return;
      }

      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      await Promise.all([
        loadDashboard(),
        searchCollections(),
        loadReturnsDashboard(),
        searchReturns(),
      ]);
    };

    validateAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDashboard() {
    try {
      setLoadingDashboard(true);
      const { data } = await axios.get(`${API_URL}/collection-requests/dashboard`);
      setDashboard(data);
    } catch (error) {
      console.error(error);
      alert('Erro ao carregar o painel de coletas.');
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function searchCollections() {
    try {
      setLoadingSearch(true);
      const params = new URLSearchParams();

      if (filters.invoice_number.trim()) params.append('invoice_number', filters.invoice_number.trim());
      if (filters.customer_name.trim()) params.append('customer_name', filters.customer_name.trim());
      if (filters.city.trim()) params.append('city', filters.city.trim());
      if (filters.product_term.trim()) params.append('product_term', filters.product_term.trim());
      if (filters.status !== 'all') params.append('status', filters.status);

      const { data } = await axios.get(`${API_URL}/collection-requests/search?${params.toString()}`);
      setSearchRows(data);
    } catch (error) {
      console.error(error);
      alert('Erro ao pesquisar coletas.');
    } finally {
      setLoadingSearch(false);
    }
  }

  async function loadReturnsDashboard() {
    try {
      setLoadingReturnsDashboard(true);
      const { data } = await axios.get(`${API_URL}/returns/control-tower/dashboard`);
      setReturnsDashboard(data);
    } catch (error) {
      console.error(error);
      alert('Erro ao carregar o painel de devoluções.');
    } finally {
      setLoadingReturnsDashboard(false);
    }
  }

  async function searchReturns() {
    try {
      setLoadingReturnsSearch(true);
      const params = new URLSearchParams();
      if (returnFilters.invoice_number.trim()) params.append('invoice_number', returnFilters.invoice_number.trim());
      if (returnFilters.customer_name.trim()) params.append('customer_name', returnFilters.customer_name.trim());
      if (returnFilters.city.trim()) params.append('city', returnFilters.city.trim());

      const { data } = await axios.get(`${API_URL}/returns/control-tower/search?${params.toString()}`);
      setReturnRows(data);
    } catch (error) {
      console.error(error);
      alert('Erro ao pesquisar devoluções.');
    } finally {
      setLoadingReturnsSearch(false);
    }
  }

  async function handleCreateCollection() {
    if (!form.customer_name.trim() || !form.city.trim() || !form.product_description.trim() || Number(form.quantity) <= 0) {
      alert('Preencha cliente, cidade, produto e quantidade.');
      return;
    }

    try {
      setSaving(true);
      await axios.post(`${API_URL}/collection-requests`, {
        ...form,
        quantity: Number(form.quantity),
        product_type: form.product_type.trim().toUpperCase() || null,
      });

      alert('Solicitação de coleta criada com sucesso.');
      setForm({
        invoice_number: '',
        customer_name: '',
        city: '',
        product_id: '',
        product_description: '',
        product_type: '',
        quantity: 1,
        notes: '',
      });

      await Promise.all([loadDashboard(), searchCollections()]);
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.error || 'Erro ao criar solicitação de coleta.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(id: number, status: 'pending' | 'completed' | 'cancelled') {
    try {
      await axios.patch(`${API_URL}/collection-requests/${id}/status`, { status });
      await Promise.all([loadDashboard(), searchCollections()]);
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.error || 'Erro ao atualizar status da coleta.');
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user_permission');
    delete axios.defaults.headers.common.Authorization;
    navigate('/');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(120deg, #f4f8fc 0%, #f0f6f4 100%)', padding: '18px' }}>
      <div style={{ maxWidth: 1250, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h1 style={{ margin: 0, color: '#123263' }}>Torre de Controle | MAR E RIO PESCADOS</h1>
            <p style={{ margin: '4px 0 0 0', color: '#2f4a5f' }}>
              Painel para solicitar coletas e monitorar devoluções com rastreabilidade operacional.
            </p>
          </div>
          <button type="button" onClick={logout} style={{ border: '1px solid #123263', background: '#fff', color: '#123263', borderRadius: 8, padding: '8px 12px' }}>
            Sair
          </button>
        </div>

        <h2 style={{ marginBottom: 10, color: '#123263' }}>Coletas</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #d7e3ef' }}>
            <strong>Pendentes</strong>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#123263' }}>{dashboard?.metrics.pending_count || 0}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #d7e3ef' }}>
            <strong>Total de solicitações</strong>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#123263' }}>{dashboard?.metrics.total_requests || 0}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #d7e3ef' }}>
            <strong>Concluídas</strong>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#123263' }}>{dashboard?.metrics.completed_count || 0}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #d7e3ef' }}>
            <h3 style={{ marginTop: 0 }}>Nova solicitação de coleta</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <input placeholder="NF (opcional)" value={form.invoice_number} onChange={(e) => setForm((prev) => ({ ...prev, invoice_number: e.target.value }))} />
              <input placeholder="Cliente" value={form.customer_name} onChange={(e) => setForm((prev) => ({ ...prev, customer_name: e.target.value }))} />
              <input placeholder="Cidade" value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
              <input placeholder="Código do produto (opcional)" value={form.product_id} onChange={(e) => setForm((prev) => ({ ...prev, product_id: e.target.value }))} />
              <input placeholder="Produto" value={form.product_description} onChange={(e) => setForm((prev) => ({ ...prev, product_description: e.target.value }))} />
              <input placeholder="Tipo (KG/CX/PCT/UN)" value={form.product_type} onChange={(e) => setForm((prev) => ({ ...prev, product_type: e.target.value.toUpperCase() }))} />
              <input type="number" min={0.001} step={0.001} placeholder="Quantidade" value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))} />
              <input placeholder="Observações" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
            <button type="button" onClick={handleCreateCollection} disabled={saving} style={{ marginTop: 10, background: '#123263', color: '#fff', border: 0, borderRadius: 8, padding: '10px 14px' }}>
              {saving ? 'Salvando...' : 'Solicitar coleta'}
            </button>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #d7e3ef' }}>
            <h3 style={{ marginTop: 0 }}>Coletas | Gráficos rápidos</h3>
            <p style={{ marginBottom: 6, fontWeight: 600 }}>Clientes com mais solicitações</p>
            {(dashboard?.top_clients || []).map((item) => (
              <div key={`client-${item.customer_name}`} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12 }}>{item.customer_name} ({item.requests})</div>
                <div style={{ height: 8, background: '#e4edf6', borderRadius: 6 }}>
                  <div style={{ width: `${(item.requests / topClientsMax) * 100}%`, height: 8, borderRadius: 6, background: '#123263' }} />
                </div>
              </div>
            ))}

            <p style={{ margin: '12px 0 6px 0', fontWeight: 600 }}>Produtos mais coletados (quantidade)</p>
            {(dashboard?.top_products || []).map((item) => (
              <div key={`product-${item.product_description}`} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12 }}>{item.product_description} ({item.quantity})</div>
                <div style={{ height: 8, background: '#dff2ec', borderRadius: 6 }}>
                  <div style={{ width: `${(item.quantity / topProductsMax) * 100}%`, height: 8, borderRadius: 6, background: '#19a293' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #d7e3ef', marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Pendentes e últimas 5 concluídas</h3>
          {loadingDashboard ? <p>Carregando...</p> : (
            <>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Pendentes ({dashboard?.pending?.length || 0})</p>
              <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid #edf2f7', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>NF</th>
                      <th style={{ textAlign: 'left' }}>Cliente</th>
                      <th style={{ textAlign: 'left' }}>Cidade</th>
                      <th style={{ textAlign: 'left' }}>Produto</th>
                      <th style={{ textAlign: 'left' }}>Qtd</th>
                      {isInternalUser && <th style={{ textAlign: 'left' }}>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboard?.pending || []).map((item) => (
                      <tr key={`pending-${item.id}`}>
                        <td>{item.invoice_number || '-'}</td>
                        <td>{item.customer_name}</td>
                        <td>{item.city}</td>
                        <td>{item.product_description}</td>
                        <td>{item.quantity} {item.product_type || ''}</td>
                        {isInternalUser && (
                          <td>
                            <button type="button" onClick={() => handleUpdateStatus(item.id, 'completed')}>Concluir</button>
                            <button type="button" onClick={() => handleUpdateStatus(item.id, 'cancelled')} style={{ marginLeft: 6 }}>Cancelar</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p style={{ fontWeight: 600, margin: '12px 0 6px 0' }}>Últimas 5 concluídas</p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {(dashboard?.latest_completed || []).map((item) => (
                  <li key={`latest-${item.id}`}>
                    {item.invoice_number || 'Sem NF'} | {item.customer_name} | {item.city} | {item.product_description} | {item.quantity} {item.product_type || ''}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #d7e3ef', marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Pesquisa avançada de coletas</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
            <input placeholder="NF" value={filters.invoice_number} onChange={(e) => setFilters((prev) => ({ ...prev, invoice_number: e.target.value }))} />
            <input placeholder="Cliente" value={filters.customer_name} onChange={(e) => setFilters((prev) => ({ ...prev, customer_name: e.target.value }))} />
            <input placeholder="Cidade" value={filters.city} onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))} />
            <input placeholder="Produto/código" value={filters.product_term} onChange={(e) => setFilters((prev) => ({ ...prev, product_term: e.target.value }))} />
            <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="all">Todos status</option>
              <option value="pending">Pendente</option>
              <option value="completed">Concluída</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>
          <button type="button" onClick={searchCollections} disabled={loadingSearch} style={{ marginBottom: 10 }}>
            {loadingSearch ? 'Pesquisando...' : 'Pesquisar'}
          </button>

          <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #edf2f7', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>ID</th>
                  <th style={{ textAlign: 'left' }}>NF</th>
                  <th style={{ textAlign: 'left' }}>Cliente</th>
                  <th style={{ textAlign: 'left' }}>Cidade</th>
                  <th style={{ textAlign: 'left' }}>Produto</th>
                  <th style={{ textAlign: 'left' }}>Qtd</th>
                  <th style={{ textAlign: 'left' }}>Status</th>
                  <th style={{ textAlign: 'left' }}>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {searchRows.map((item) => (
                  <tr key={`search-${item.id}`}>
                    <td>{item.id}</td>
                    <td>{item.invoice_number || '-'}</td>
                    <td>{item.customer_name}</td>
                    <td>{item.city}</td>
                    <td>{item.product_description}</td>
                    <td>{item.quantity} {item.product_type || ''}</td>
                    <td>{item.status}</td>
                    <td>{new Date(item.created_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <h2 style={{ margin: '18px 0 10px 0', color: '#123263' }}>Devoluções</h2>

        <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #d7e3ef', marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Últimas 10 devoluções</h3>
          {loadingReturnsDashboard ? <p>Carregando...</p> : (
            <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid #edf2f7', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Data</th>
                    <th style={{ textAlign: 'left' }}>NF</th>
                    <th style={{ textAlign: 'left' }}>Cliente</th>
                    <th style={{ textAlign: 'left' }}>Cidade</th>
                    <th style={{ textAlign: 'left' }}>Tipo</th>
                    <th style={{ textAlign: 'left' }}>Lote</th>
                  </tr>
                </thead>
                <tbody>
                  {(returnsDashboard?.latest_returns || []).map((row) => (
                    <tr key={`latest-return-${row.id}`}>
                      <td>{new Date(row.created_at).toLocaleString('pt-BR')}</td>
                      <td>{row.invoice_number}</td>
                      <td>{row.customer_name}</td>
                      <td>{row.city}</td>
                      <td>{row.return_type}</td>
                      <td>{row.batch_code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #d7e3ef' }}>
            <h3 style={{ marginTop: 0 }}>Clientes que mais devolvem</h3>
            {(returnsDashboard?.top_customers || []).map((item) => (
              <div key={`return-client-${item.customer_name}`} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12 }}>{item.customer_name} ({item.returns})</div>
                <div style={{ height: 8, background: '#e4edf6', borderRadius: 6 }}>
                  <div style={{ width: `${(item.returns / topReturnClientsMax) * 100}%`, height: 8, borderRadius: 6, background: '#123263' }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #d7e3ef' }}>
            <h3 style={{ marginTop: 0 }}>Produtos mais devolvidos</h3>
            {(returnsDashboard?.top_products || []).map((item) => (
              <div key={`return-product-${item.product_id}-${item.product_description}`} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12 }}>{item.product_description} ({item.quantity})</div>
                <div style={{ height: 8, background: '#dff2ec', borderRadius: 6 }}>
                  <div style={{ width: `${(item.quantity / topReturnedProductsMax) * 100}%`, height: 8, borderRadius: 6, background: '#19a293' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #d7e3ef', marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Pesquisa de devoluções</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
            <input placeholder="NF" value={returnFilters.invoice_number} onChange={(e) => setReturnFilters((prev) => ({ ...prev, invoice_number: e.target.value }))} />
            <input placeholder="Cliente" value={returnFilters.customer_name} onChange={(e) => setReturnFilters((prev) => ({ ...prev, customer_name: e.target.value }))} />
            <input placeholder="Cidade" value={returnFilters.city} onChange={(e) => setReturnFilters((prev) => ({ ...prev, city: e.target.value }))} />
          </div>
          <button type="button" onClick={searchReturns} disabled={loadingReturnsSearch} style={{ marginBottom: 10 }}>
            {loadingReturnsSearch ? 'Pesquisando...' : 'Pesquisar devoluções'}
          </button>

          <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #edf2f7', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Data</th>
                  <th style={{ textAlign: 'left' }}>NF</th>
                  <th style={{ textAlign: 'left' }}>Cliente</th>
                  <th style={{ textAlign: 'left' }}>Cidade</th>
                  <th style={{ textAlign: 'left' }}>Tipo</th>
                  <th style={{ textAlign: 'left' }}>Itens</th>
                </tr>
              </thead>
              <tbody>
                {returnRows.map((row) => (
                  <tr key={`return-search-${row.id}`}>
                    <td>{new Date(row.created_at).toLocaleString('pt-BR')}</td>
                    <td>{row.invoice_number}</td>
                    <td>{row.customer_name}</td>
                    <td>{row.city}</td>
                    <td>{row.return_type}</td>
                    <td>{row.items.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ControlTowerCollections;
