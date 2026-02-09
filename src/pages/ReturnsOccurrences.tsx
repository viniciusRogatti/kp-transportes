import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router';
import { pdf } from '@react-pdf/renderer';

import Header from '../components/Header';
import ReturnReceiptPDF from '../components/ReturnReceiptPDF';
import { API_URL } from '../data';
import { Container } from '../style/invoices';
import {
  Actions,
  BoxDescription,
  Card,
  Grid,
  HighlightButton,
  InfoText,
  InlineText,
  List,
  ModalCard,
  ModalOverlay,
  PageContainer,
  ReturnSearchRow,
  SingleColumn,
  Tabs,
  TabsRow,
  TopActionBar,
  TwoColumns,
} from '../style/returnsOccurrences';
import { ICar, IDanfe, IDriver, IInvoiceReturnItem, IOccurrence, IReturnBatch } from '../types/types';
import verifyToken from '../utils/verifyToken';

function ReturnsOccurrences() {
  const navigate = useNavigate();
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState<'returns' | 'occurrences'>('returns');
  const [drivers, setDrivers] = useState<IDriver[]>([]);
  const [cars, setCars] = useState<ICar[]>([]);

  const [returnNf, setReturnNf] = useState('');
  const [returnDanfe, setReturnDanfe] = useState<IDanfe | null>(null);
  const [returnType, setReturnType] = useState<'total' | 'partial'>('total');
  const [partialProductCode, setPartialProductCode] = useState('');
  const [partialQuantity, setPartialQuantity] = useState<number>(1);
  const [partialItems, setPartialItems] = useState<IInvoiceReturnItem[]>([]);
  const [draftNotes, setDraftNotes] = useState<Array<{
    invoice_number: string;
    return_type: 'total' | 'partial';
    items: IInvoiceReturnItem[];
  }>>([]);
  const [returnDriverId, setReturnDriverId] = useState('');
  const [selectedCarId, setSelectedCarId] = useState('');
  const [returnDate, setReturnDate] = useState(getTodayDate());

  const [batchesDate, setBatchesDate] = useState(getTodayDate());
  const [returnBatches, setReturnBatches] = useState<IReturnBatch[]>([]);
  const [selectedBatchCode, setSelectedBatchCode] = useState('');
  const [isBatchSearchOpen, setIsBatchSearchOpen] = useState(false);

  const [occurrenceNf, setOccurrenceNf] = useState('');
  const [occurrenceDanfe, setOccurrenceDanfe] = useState<IDanfe | null>(null);
  const [occurrenceProductCode, setOccurrenceProductCode] = useState('');
  const [occurrenceQuantity, setOccurrenceQuantity] = useState<number>(1);
  const [occurrenceDescription, setOccurrenceDescription] = useState('');
  const [occurrenceDriverId, setOccurrenceDriverId] = useState('');
  const [occurrences, setOccurrences] = useState<IOccurrence[]>([]);
  const [occurrenceStatusFilter, setOccurrenceStatusFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [occurrenceNfFilter, setOccurrenceNfFilter] = useState('');
  const [occurrenceStartDate, setOccurrenceStartDate] = useState('');
  const [occurrenceEndDate, setOccurrenceEndDate] = useState('');

  const selectedBatch = useMemo(() => (
    returnBatches.find((batch) => batch.batch_code === selectedBatchCode) || null
  ), [returnBatches, selectedBatchCode]);

  const draftAggregatedItems = useMemo(() => {
    const allItems = draftNotes.flatMap((note) => note.items);

    return allItems.reduce((acc: IInvoiceReturnItem[], item) => {
      const existing = acc.find((savedItem) => savedItem.product_id === item.product_id);

      if (existing) {
        existing.quantity += Number(item.quantity);
      } else {
        acc.push({ ...item, quantity: Number(item.quantity) });
      }

      return acc;
    }, []);
  }, [draftNotes]);

  const selectedPartialDanfeProduct = useMemo(() => (
    returnDanfe?.DanfeProducts.find((item) => item.Product.code === partialProductCode) || null
  ), [returnDanfe, partialProductCode]);

  const isSelectedPartialProductKg = useMemo(() => {
    if (!selectedPartialDanfeProduct) {
      return false;
    }

    const combinedType = `${selectedPartialDanfeProduct.type || ''} ${selectedPartialDanfeProduct.Product.type || ''}`.toLowerCase();
    return combinedType.includes('kg');
  }, [selectedPartialDanfeProduct]);

  const selectedPartialMinQty = isSelectedPartialProductKg ? 0.1 : 1;
  const selectedPartialMaxQty = selectedPartialDanfeProduct ? Number(selectedPartialDanfeProduct.quantity) : 0;
  const selectedPartialAlreadyAddedQty = partialProductCode
    ? partialItems
      .filter((item) => item.product_id === partialProductCode)
      .reduce((sum, item) => sum + Number(item.quantity), 0)
    : 0;
  const selectedPartialRemainingQty = Math.max(0, selectedPartialMaxQty - selectedPartialAlreadyAddedQty);
  const selectedPartialStep = isSelectedPartialProductKg ? 0.1 : 1;

  useEffect(() => {
    const token = localStorage.getItem('token');

    const validateAndLoad = async () => {
      if (!token) {
        navigate('/');
        return;
      }

      const isValidToken = await verifyToken(token);
      if (!isValidToken) {
        navigate('/');
        return;
      }

      await Promise.all([loadDrivers(), loadCars(), loadOccurrences(), loadReturnBatches()]);
    };

    validateAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDrivers() {
    try {
      const { data } = await axios.get(`${API_URL}/drivers`);
      setDrivers(data);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
    }
  }

  async function loadCars() {
    try {
      const { data } = await axios.get(`${API_URL}/cars`);
      setCars(data);
    } catch (error) {
      console.error('Erro ao carregar veiculos:', error);
    }
  }

  async function loadReturnBatches() {
    try {
      const params = new URLSearchParams();
      if (batchesDate) {
        params.append('date', batchesDate);
      }

      const { data } = await axios.get(`${API_URL}/returns/batches/search?${params.toString()}`);
      setReturnBatches(data);

      if (selectedBatchCode) {
        const stillExists = data.some((batch: IReturnBatch) => batch.batch_code === selectedBatchCode);
        if (!stillExists) {
          setSelectedBatchCode('');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar lotes de devolucao:', error);
    }
  }

  async function loadOccurrences() {
    try {
      const params = new URLSearchParams();

      if (occurrenceStatusFilter !== 'all') {
        params.append('status', occurrenceStatusFilter);
      }

      if (occurrenceNfFilter.trim()) {
        params.append('invoice_number', occurrenceNfFilter.trim());
      }

      if (occurrenceStartDate && occurrenceEndDate) {
        params.append('startDate', occurrenceStartDate);
        params.append('endDate', occurrenceEndDate);
      }

      const { data } = await axios.get(`${API_URL}/occurrences/search?${params.toString()}`);
      setOccurrences(data);
    } catch (error) {
      console.error('Erro ao carregar ocorrencias:', error);
    }
  }

  async function findDanfeByNf(nf: string) {
    const { data } = await axios.get(`${API_URL}/danfes/nf/${nf}`);
    return data;
  }

  async function handleSearchReturnNf() {
    if (!returnNf.trim()) {
      alert('Digite a NF para buscar.');
      return;
    }

    try {
      const data = await findDanfeByNf(returnNf.trim());

      if (!data) {
        alert('NF nao encontrada.');
        return;
      }

      setReturnDanfe(data);
      setPartialItems([]);
      setPartialProductCode('');
      setPartialQuantity(1);
    } catch (error) {
      console.error(error);
      alert('Erro ao buscar NF para devolucao.');
    }
  }

  function addPartialItem() {
    if (!returnDanfe) {
      alert('Busque uma NF primeiro.');
      return;
    }

    if (!partialProductCode) {
      alert('Selecione um produto.');
      return;
    }

    if (!partialQuantity || partialQuantity <= 0) {
      alert('Digite uma quantidade valida.');
      return;
    }

    const foundProduct = returnDanfe.DanfeProducts.find((item) => item.Product.code === partialProductCode);
    if (!foundProduct) {
      alert('Produto nao encontrado na NF.');
      return;
    }

    const isKg = `${foundProduct.type || ''} ${foundProduct.Product.type || ''}`.toLowerCase().includes('kg');
    const minAllowed = isKg ? 0.1 : 1;
    const maxAllowed = Number(foundProduct.quantity);
    const existingQty = partialItems
      .filter((item) => item.product_id === foundProduct.Product.code)
      .reduce((sum, item) => sum + Number(item.quantity), 0);

    if (!isKg && !Number.isInteger(partialQuantity)) {
      alert('Para este produto, use apenas quantidades inteiras.');
      return;
    }

    const normalizedQuantity = isKg
      ? Math.round(Number(partialQuantity) * 10) / 10
      : Number(partialQuantity);

    if (normalizedQuantity < minAllowed) {
      alert(`Quantidade minima permitida para este produto: ${minAllowed}.`);
      return;
    }

    if (normalizedQuantity + existingQty > maxAllowed) {
      const remaining = Math.max(0, maxAllowed - existingQty);
      alert(`Quantidade excede o limite da NF, de: ${remaining}.`);
      return;
    }

    setPartialItems((previous) => {
      const existingItem = previous.find((item) => item.product_id === foundProduct.Product.code);
      if (!existingItem) {
        return [
          ...previous,
          {
            product_id: foundProduct.Product.code,
            product_description: foundProduct.Product.description,
            quantity: normalizedQuantity,
          },
        ];
      }

      return previous.map((item) => (
        item.product_id === foundProduct.Product.code
          ? { ...item, quantity: Number(item.quantity) + normalizedQuantity }
          : item
      ));
    });

    setPartialQuantity(minAllowed);
  }

  function removePartialItem(productId: string) {
    setPartialItems((previous) => previous.filter((item) => item.product_id !== productId));
  }

  function getCurrentNoteItems() {
    if (!returnDanfe) {
      return [];
    }

    if (returnType === 'total') {
      return returnDanfe.DanfeProducts.map((item) => ({
        product_id: item.Product.code,
        product_description: item.Product.description,
        quantity: Number(item.quantity),
      }));
    }

    return partialItems.reduce((acc: IInvoiceReturnItem[], item) => {
      const existing = acc.find((savedItem) => savedItem.product_id === item.product_id);

      if (existing) {
        existing.quantity += Number(item.quantity);
      } else {
        acc.push({ ...item, quantity: Number(item.quantity) });
      }

      return acc;
    }, []);
  }

  async function handleAddNf() {
    if (!returnDanfe) {
      alert('Busque uma NF para adicionar na lista.');
      return;
    }

    const noteItems = getCurrentNoteItems();
    if (!noteItems.length) {
      alert('Adicione ao menos um item na devolucao parcial.');
      return;
    }

    if (selectedBatch) {
      const existsInBatch = selectedBatch.notes.some((note) => note.invoice_number === returnDanfe.invoice_number);
      if (existsInBatch) {
        alert('Essa NF ja existe no lote selecionado.');
        return;
      }

      try {
        await axios.post(`${API_URL}/returns/batches/${selectedBatch.batch_code}/add-note`, {
          invoice_number: returnDanfe.invoice_number,
          return_type: returnType,
          items: noteItems,
        });

        alert('NF adicionada no lote com sucesso.');
        await loadReturnBatches();
        clearNfBuilder();
      } catch (error) {
        console.error(error);
        alert('Erro ao adicionar NF no lote.');
      }

      return;
    }

    const existsInDraft = draftNotes.some((note) => note.invoice_number === returnDanfe.invoice_number);
    if (existsInDraft) {
      alert('Essa NF ja esta na lista atual.');
      return;
    }

    setDraftNotes((previous) => ([
      ...previous,
      {
        invoice_number: returnDanfe.invoice_number,
        return_type: returnType,
        items: noteItems,
      },
    ]));

    clearNfBuilder();
  }

  function clearNfBuilder() {
    setReturnNf('');
    setReturnDanfe(null);
    setReturnType('total');
    setPartialItems([]);
    setPartialProductCode('');
    setPartialQuantity(1);
  }

  function removeDraftNf(invoiceNumber: string) {
    setDraftNotes((previous) => previous.filter((note) => note.invoice_number !== invoiceNumber));
  }

  function handleCreateNewBatch() {
    setSelectedBatchCode('');
    setDraftNotes([]);
    clearNfBuilder();
    setReturnDriverId('');
    setSelectedCarId('');
    setReturnDate(getTodayDate());
  }

  async function handleConcludeBatch() {
    if (!draftNotes.length) {
      alert('Adicione ao menos uma NF na lista para concluir.');
      return;
    }

    if (!returnDriverId) {
      alert('Selecione o motorista.');
      return;
    }

    if (!selectedCarId) {
      alert('Selecione o veiculo.');
      return;
    }

    if (!returnDate) {
      alert('Informe a data da subida da devolucao.');
      return;
    }

    const selectedCar = cars.find((car) => String(car.id) === String(selectedCarId));
    if (!selectedCar) {
      alert('Selecione um veiculo valido.');
      return;
    }

    try {
      let batchCodeForPdf = `RET-${returnDate.replace(/-/g, '')}`;
      let createdWithLegacyRoute = false;

      try {
        const { data } = await axios.post(`${API_URL}/returns/batches/create`, {
          driver_id: Number(returnDriverId),
          vehicle_plate: selectedCar.license_plate,
          return_date: returnDate,
          notes: draftNotes,
        });
        batchCodeForPdf = data?.batch_code || batchCodeForPdf;
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          throw error;
        }

        // Compatibilidade com backend antigo em producao (sem rotas de lote)
        await Promise.all(draftNotes.map((note) => (
          axios.post(`${API_URL}/returns/create`, {
            invoice_number: note.invoice_number,
            return_type: note.return_type,
            driver_id: Number(returnDriverId),
            vehicle_plate: selectedCar.license_plate,
            return_date: returnDate,
            items: note.items,
          })
        )));
        createdWithLegacyRoute = true;
      }

      const driverName = drivers.find((driver) => String(driver.id) === String(returnDriverId))?.name || 'Motorista';

      const pdfBlob = await pdf(
        <ReturnReceiptPDF
          batchCode={batchCodeForPdf}
          driverName={driverName}
          vehiclePlate={selectedCar.license_plate}
          returnDate={returnDate}
          notes={draftNotes.map((note) => ({
            invoice_number: note.invoice_number,
            return_type: note.return_type,
          }))}
          items={draftAggregatedItems}
        />
      ).toBlob();

      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      if (createdWithLegacyRoute) {
        alert('Devolucao concluida com sucesso. Observacao: backend em modo legado (sem lote).');
      } else {
        alert('Devolucao concluida com sucesso.');
      }
      handleCreateNewBatch();
      await loadReturnBatches();
    } catch (error) {
      console.error(error);
      alert('Erro ao concluir devolucao.');
    }
  }

  async function handleRemoveNoteFromBatch(noteId: number) {
    try {
      await axios.delete(`${API_URL}/returns/notes/${noteId}`);
      await loadReturnBatches();
    } catch (error) {
      console.error(error);
      alert('Erro ao remover NF do lote.');
    }
  }

  async function handleSearchOccurrenceNf() {
    if (!occurrenceNf.trim()) {
      alert('Digite a NF para buscar.');
      return;
    }

    try {
      const data = await findDanfeByNf(occurrenceNf.trim());

      if (!data) {
        alert('NF nao encontrada.');
        return;
      }

      setOccurrenceDanfe(data);
      setOccurrenceProductCode('');
      setOccurrenceQuantity(1);
    } catch (error) {
      console.error(error);
      alert('Erro ao buscar NF para ocorrencia.');
    }
  }

  async function handleCreateOccurrence() {
    if (!occurrenceDanfe) {
      alert('Busque uma NF para ocorrencia.');
      return;
    }

    if (!occurrenceDescription.trim()) {
      alert('Descreva a ocorrencia.');
      return;
    }

    const selectedProduct = occurrenceDanfe.DanfeProducts.find((item) => item.Product.code === occurrenceProductCode);

    try {
      await axios.post(`${API_URL}/occurrences/create`, {
        invoice_number: occurrenceDanfe.invoice_number,
        product_id: selectedProduct?.Product.code || null,
        product_description: selectedProduct?.Product.description || null,
        quantity: selectedProduct ? Number(occurrenceQuantity) : null,
        description: occurrenceDescription.trim(),
        reported_by_driver_id: occurrenceDriverId ? Number(occurrenceDriverId) : null,
      });

      alert('Ocorrencia registrada com sucesso.');
      setOccurrenceDescription('');
      setOccurrenceQuantity(1);
      setOccurrenceProductCode('');
      await loadOccurrences();
    } catch (error) {
      console.error(error);
      alert('Erro ao registrar ocorrencia.');
    }
  }

  async function handleResolveOccurrence(id: number) {
    try {
      await axios.put(`${API_URL}/occurrences/status/${id}`, { status: 'resolved' });
      await loadOccurrences();
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar status da ocorrencia.');
    }
  }

  async function handleOpenBatchPdf(batch: IReturnBatch) {
    try {
      const aggregatedItems = batch.aggregated_items?.length
        ? batch.aggregated_items
        : batch.notes
          .flatMap((note) => note.items || [])
          .reduce((acc: IInvoiceReturnItem[], item) => {
            const existing = acc.find((savedItem) => savedItem.product_id === item.product_id);

            if (existing) {
              existing.quantity += Number(item.quantity);
            } else {
              acc.push({ ...item, quantity: Number(item.quantity) });
            }

            return acc;
          }, []);

      const driverName = batch.Driver?.name
        || drivers.find((driver) => String(driver.id) === String(batch.driver_id))?.name
        || 'Motorista';

      const pdfBlob = await pdf(
        <ReturnReceiptPDF
          batchCode={batch.batch_code}
          driverName={driverName}
          vehiclePlate={batch.vehicle_plate}
          returnDate={batch.return_date}
          notes={batch.notes.map((note) => ({
            invoice_number: note.invoice_number,
            return_type: note.return_type,
          }))}
          items={aggregatedItems}
        />
      ).toBlob();

      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      console.error(error);
      alert('Erro ao abrir PDF do lote.');
    }
  }

  return (
    <div>
      <Header />
      <Container>
        <PageContainer>
          <TabsRow>
            <Tabs>
              <button
                className={activeTab === 'returns' ? 'active' : ''}
                onClick={() => setActiveTab('returns')}
                type="button"
              >
                Devolucoes
              </button>
              <button
                className={activeTab === 'occurrences' ? 'active' : ''}
                onClick={() => setActiveTab('occurrences')}
                type="button"
              >
                Ocorrencias
              </button>
            </Tabs>
            {activeTab === 'returns' && (
              <HighlightButton type="button" onClick={() => setIsBatchSearchOpen(true)}>
                Buscar devolucao por data
              </HighlightButton>
            )}
          </TabsRow>

          {activeTab === 'returns' && (
            <SingleColumn>
              {selectedBatch && (
                <TopActionBar>
                  <button className="secondary" onClick={handleCreateNewBatch} type="button">
                    Criar novo lote
                  </button>
                  <button className="secondary" onClick={() => handleOpenBatchPdf(selectedBatch)} type="button">
                    Abrir PDF
                  </button>
                </TopActionBar>
              )}

              <Card>
                <BoxDescription>
                  <h2>{selectedBatch ? `Editando lote ${selectedBatch.batch_code}` : 'Nova devolucao (lista de NFs)'}</h2>
                  {selectedBatch ? (
                    <InlineText>
                      Motorista: {selectedBatch.Driver?.name || selectedBatch.driver_id} | Placa: {selectedBatch.vehicle_plate} | Data: {selectedBatch.return_date}
                    </InlineText>
                  ) : (
                    <InlineText>Busque NF, escolha total/parcial e adicione na lista.</InlineText>
                  )}

                </BoxDescription>
                <InlineText style={{ margin: '10px 0 6px 0' }}>NF + tipo de devolucao</InlineText>
                <ReturnSearchRow>

                  <input
                    type="number"
                    value={returnNf}
                    onChange={(event) => setReturnNf(event.target.value)}
                    placeholder="Digite a NF"
                  />

                  <label>
                    <input
                      type="checkbox"
                      checked={returnType === 'total'}
                      onChange={() => setReturnType('total')}
                    />
                    Total
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={returnType === 'partial'}
                      onChange={() => setReturnType('partial')}
                    />
                    Parcial
                  </label>
                  <button onClick={handleSearchReturnNf} type="button">Buscar NF</button>
                </ReturnSearchRow>

                {returnDanfe && (
                  <>
                    <InfoText style={{ marginTop: '12px' }}>
                      NF carregada: {returnDanfe.invoice_number} | Cliente: {returnDanfe.Customer.name_or_legal_entity}
                    </InfoText>

                    {returnType === 'partial' && (
                      <>
                        <Grid style={{ marginTop: '12px' }}>
                          <div>
                            <InlineText>Produto</InlineText>
                            <select
                              value={partialProductCode}
                              onChange={(event) => {
                                const nextProductCode = event.target.value;
                                setPartialProductCode(nextProductCode);

                                if (!returnDanfe || !nextProductCode) {
                                  setPartialQuantity(1);
                                  return;
                                }

                                const nextProduct = returnDanfe.DanfeProducts.find((item) => item.Product.code === nextProductCode);
                                const nextIsKg = `${nextProduct?.type || ''} ${nextProduct?.Product.type || ''}`.toLowerCase().includes('kg');
                                setPartialQuantity(nextIsKg ? 0.1 : 1);
                              }}
                            >
                              <option value="">Selecione</option>
                              {returnDanfe.DanfeProducts.map((item) => (
                                <option key={item.Product.code} value={item.Product.code}>
                                  {item.Product.code} - {item.Product.description}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <InlineText>Quantidade</InlineText>
                            <input
                              type="number"
                              min={selectedPartialMinQty}
                              max={selectedPartialRemainingQty || undefined}
                              step={selectedPartialStep}
                              value={partialQuantity}
                              onChange={(event) => setPartialQuantity(Number(event.target.value))}
                            />
                            {!!partialProductCode && (
                              <InfoText>
                                Limite da NF: {selectedPartialMaxQty} | Restante para adicionar: {selectedPartialRemainingQty}
                              </InfoText>
                            )}
                          </div>
                        </Grid>
                        <Actions style={{ marginTop: '12px' }}>
                          <button
                            className="secondary"
                            onClick={addPartialItem}
                            disabled={!partialProductCode || selectedPartialRemainingQty <= 0}
                            type="button"
                          >
                            Adicionar item parcial
                          </button>
                        </Actions>
                      </>
                    )}

                    {!!partialItems.length && returnType === 'partial' && (
                      <List>
                        {partialItems.map((item, index) => (
                          <li key={`${item.product_id}-${index}`}>
                            <span>
                              <strong>{item.product_id}</strong> - {item.product_description} | Qtd: {item.quantity}
                            </span>
                            <Actions>
                              <button className="danger" onClick={() => removePartialItem(item.product_id)} type="button">Remover</button>
                            </Actions>
                          </li>
                        ))}
                      </List>
                    )}

                    <Actions style={{ marginTop: '12px' }}>
                      <button className="primary" onClick={handleAddNf} type="button">
                        {selectedBatch ? 'Adicionar NF no lote' : 'Adicionar NF na lista'}
                      </button>
                    </Actions>
                  </>
                )}

                <h2 style={{ marginTop: '18px' }}>Lista de NFs</h2>
                {selectedBatch ? (
                  !selectedBatch.notes.length ? (
                    <InlineText>Nenhuma NF no lote selecionado.</InlineText>
                  ) : (
                    <List>
                      {selectedBatch.notes.map((note) => (
                        <li key={note.id}>
                          <span>
                            <strong>NF {note.invoice_number}</strong>
                            {` | Tipo: ${note.return_type === 'total' ? 'Total' : 'Parcial'}`}
                            {` | Itens: ${note.items?.length || 0}`}
                          </span>
                          <Actions>
                            <button className="danger" onClick={() => handleRemoveNoteFromBatch(note.id)} type="button">
                              Remover NF
                            </button>
                          </Actions>
                        </li>
                      ))}
                    </List>
                  )
                ) : (
                  !draftNotes.length ? (
                    <InlineText>Nenhuma NF adicionada ainda.</InlineText>
                  ) : (
                    <List>
                      {draftNotes.map((note) => (
                        <li key={note.invoice_number}>
                          <span>
                            <strong>NF {note.invoice_number}</strong>
                            {` | Tipo: ${note.return_type === 'total' ? 'Total' : 'Parcial'}`}
                            {` | Itens: ${note.items.length}`}
                          </span>
                          <Actions>
                            <button className="danger" onClick={() => removeDraftNf(note.invoice_number)} type="button">
                              Remover NF
                            </button>
                          </Actions>
                        </li>
                      ))}
                    </List>
                  )
                )}

                {selectedBatch && !!selectedBatch.aggregated_items?.length && (
                  <>
                    <InlineText style={{ marginTop: '12px' }}>
                      Pre-visualizacao dos produtos consolidados do lote:
                    </InlineText>
                    <List>
                      {selectedBatch.aggregated_items.map((item) => (
                        <li key={`batch-item-${item.product_id}`}>
                          <span>
                            <strong>{item.product_id}</strong> - {item.product_description} | Qtd total: {item.quantity}
                          </span>
                        </li>
                      ))}
                    </List>
                  </>
                )}

                {!selectedBatch && (
                  <>
                    <Grid style={{ marginTop: '12px' }}>
                      <div>
                        <InlineText>Motorista</InlineText>
                        <select value={returnDriverId} onChange={(event) => setReturnDriverId(event.target.value)}>
                          <option value="">Selecione</option>
                          {drivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>{driver.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <InlineText>Veiculo / Placa</InlineText>
                        <select value={selectedCarId} onChange={(event) => setSelectedCarId(event.target.value)}>
                          <option value="">Selecione</option>
                          {cars.map((car) => (
                            <option key={car.id} value={car.id}>
                              {car.model} - {car.license_plate}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <InlineText>Data da devolucao</InlineText>
                        <input
                          type="date"
                          value={returnDate}
                          onChange={(event) => setReturnDate(event.target.value)}
                        />
                      </div>
                    </Grid>

                    {!!draftAggregatedItems.length && (
                      <>
                        <InlineText style={{ marginTop: '12px' }}>
                          Pre-visualizacao dos produtos consolidados: {draftAggregatedItems.length}
                        </InlineText>
                        <List>
                          {draftAggregatedItems.map((item) => (
                            <li key={`draft-item-${item.product_id}`}>
                              <span>
                                <strong>{item.product_id}</strong> - {item.product_description} | Qtd total: {item.quantity}
                              </span>
                            </li>
                          ))}
                        </List>
                      </>
                    )}

                    <Actions style={{ marginTop: '12px' }}>
                      <button className="primary" onClick={handleConcludeBatch} disabled={draftNotes.length === 0} type="button">
                        Concluir devolucao
                      </button>
                    </Actions>
                  </>
                )}
              </Card>

              {!!returnBatches.length && (
                <Card>
                  <h2>Lotes encontrados ({returnBatches.length})</h2>
                  <List>
                    {returnBatches.map((batch) => (
                      <li key={batch.batch_code}>
                        <span>
                          <strong>{batch.batch_code}</strong>
                          {` | Motorista: ${batch.Driver?.name || batch.driver_id}`}
                          {` | Placa: ${batch.vehicle_plate}`}
                          {` | Data: ${batch.return_date}`}
                          {` | NFs: ${batch.notes.length}`}
                        </span>
                        <Actions>
                          <button className="secondary" onClick={() => handleOpenBatchPdf(batch)} type="button">
                            Abrir PDF
                          </button>
                          <button className="primary" onClick={() => setSelectedBatchCode(batch.batch_code)} type="button">
                            Editar lote
                          </button>
                        </Actions>
                      </li>
                    ))}
                  </List>
                </Card>
              )}

              {isBatchSearchOpen && (
                <>
                  <ModalOverlay onClick={() => setIsBatchSearchOpen(false)} />
                  <ModalCard>
                    <h3>Buscar lote por data</h3>
                    <input
                      type="date"
                      value={batchesDate}
                      onChange={(event) => setBatchesDate(event.target.value)}
                    />
                    <Actions>
                      <button
                        className="primary"
                        onClick={async () => {
                          await loadReturnBatches();
                          setIsBatchSearchOpen(false);
                        }}
                        type="button"
                      >
                        Buscar
                      </button>
                      <button className="secondary" onClick={() => setIsBatchSearchOpen(false)} type="button">
                        Fechar
                      </button>
                    </Actions>
                  </ModalCard>
                </>
              )}
            </SingleColumn>
          )}

          {activeTab === 'occurrences' && (
            <TwoColumns>
              <Card>
                <h2>Registrar Ocorrencia</h2>
                <Grid>
                  <div>
                    <InlineText>NF</InlineText>
                    <input
                      type="number"
                      value={occurrenceNf}
                      onChange={(event) => setOccurrenceNf(event.target.value)}
                      placeholder="Digite a NF"
                    />
                  </div>
                  <div>
                    <InlineText>Motorista</InlineText>
                    <select
                      value={occurrenceDriverId}
                      onChange={(event) => setOccurrenceDriverId(event.target.value)}
                    >
                      <option value="">Nao informado</option>
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>{driver.name}</option>
                      ))}
                    </select>
                  </div>
                </Grid>

                <Actions style={{ marginTop: '12px' }}>
                  <button className="secondary" onClick={handleSearchOccurrenceNf} type="button">Buscar NF</button>
                </Actions>

                {occurrenceDanfe && (
                  <>
                    <InlineText style={{ marginTop: '12px' }}>
                      NF selecionada: {occurrenceDanfe.invoice_number} | Cliente: {occurrenceDanfe.Customer.name_or_legal_entity}
                    </InlineText>

                    <Grid style={{ marginTop: '12px' }}>
                      <div>
                        <InlineText>Produto (opcional)</InlineText>
                        <select
                          value={occurrenceProductCode}
                          onChange={(event) => setOccurrenceProductCode(event.target.value)}
                        >
                          <option value="">Selecione</option>
                          {occurrenceDanfe.DanfeProducts.map((item) => (
                            <option key={item.Product.code} value={item.Product.code}>
                              {item.Product.code} - {item.Product.description}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <InlineText>Quantidade</InlineText>
                        <input
                          type="number"
                          min={1}
                          value={occurrenceQuantity}
                          onChange={(event) => setOccurrenceQuantity(Number(event.target.value))}
                          disabled={!occurrenceProductCode}
                        />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <InlineText>Descricao da ocorrencia</InlineText>
                        <textarea
                          value={occurrenceDescription}
                          onChange={(event) => setOccurrenceDescription(event.target.value)}
                          placeholder="Ex.: falta de 2 unidades do item X"
                        />
                      </div>
                    </Grid>

                    <Actions style={{ marginTop: '12px' }}>
                      <button className="primary" onClick={handleCreateOccurrence} type="button">
                        Registrar ocorrencia
                      </button>
                    </Actions>
                  </>
                )}
              </Card>

              <Card>
                <h2>Ocorrencias Cadastradas</h2>
                <Grid>
                  <div>
                    <InlineText>Status</InlineText>
                    <select
                      value={occurrenceStatusFilter}
                      onChange={(event) => setOccurrenceStatusFilter(event.target.value as 'all' | 'pending' | 'resolved')}
                    >
                      <option value="pending">Pendentes</option>
                      <option value="resolved">Resolvidas</option>
                      <option value="all">Todas</option>
                    </select>
                  </div>
                  <div>
                    <InlineText>Filtro por NF</InlineText>
                    <input
                      value={occurrenceNfFilter}
                      onChange={(event) => setOccurrenceNfFilter(event.target.value)}
                      placeholder="Ex.: 12345"
                    />
                  </div>
                  <div>
                    <InlineText>Data inicial</InlineText>
                    <input
                      type="date"
                      value={occurrenceStartDate}
                      onChange={(event) => setOccurrenceStartDate(event.target.value)}
                    />
                  </div>
                  <div>
                    <InlineText>Data final</InlineText>
                    <input
                      type="date"
                      value={occurrenceEndDate}
                      onChange={(event) => setOccurrenceEndDate(event.target.value)}
                    />
                  </div>
                </Grid>

                <Actions style={{ marginTop: '12px' }}>
                  <button className="secondary" onClick={loadOccurrences} type="button">Atualizar lista</button>
                </Actions>

                {!occurrences.length ? (
                  <InlineText style={{ marginTop: '12px' }}>Nenhuma ocorrencia encontrada.</InlineText>
                ) : (
                  <List>
                    {occurrences.map((occurrence) => (
                      <li key={occurrence.id}>
                        <span>
                          <strong>NF {occurrence.invoice_number}</strong> | {occurrence.product_id || 'Sem produto'}
                          {occurrence.quantity ? ` | Qtd: ${occurrence.quantity}` : ''}
                          {' | '}
                          {occurrence.description}
                          {` | Data: ${new Date(occurrence.created_at).toLocaleDateString('pt-BR')}`}
                          {' | Status: '}
                          <strong>{occurrence.status === 'pending' ? 'Pendente' : 'Resolvida'}</strong>
                        </span>
                        {occurrence.status === 'pending' && (
                          <Actions>
                            <button
                              className="primary"
                              onClick={() => handleResolveOccurrence(occurrence.id)}
                              type="button"
                            >
                              Marcar resolvida
                            </button>
                          </Actions>
                        )}
                      </li>
                    ))}
                  </List>
                )}
              </Card>
            </TwoColumns>
          )}
        </PageContainer>
      </Container>
    </div>
  );
}

export default ReturnsOccurrences;
