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
  CardHeaderRow,
  BatchActionsRow,
  BatchItemContent,
  Grid,
  HighlightButton,
  InfoText,
  InlineText,
  ListHeaderRow,
  List,
  ModalCard,
  ModalOverlay,
  OccurrenceActionsLeft,
  OccurrenceActionsRight,
  OccurrenceActionsRow,
  OccurrenceItemContent,
  PageContainer,
  ReturnSearchRow,
  SaveBatchButton,
  SingleColumn,
  Tabs,
  TabsRow,
  TopActionBar,
  TwoColumns,
} from '../style/returnsOccurrences';
import { ICar, IDanfe, IDriver, IInvoiceReturn, IInvoiceReturnItem, IOccurrence, IProduct, IReturnBatch } from '../types/types';
import verifyToken from '../utils/verifyToken';

function ReturnsOccurrences() {
  const navigate = useNavigate();
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getReturnPdfFileName = (dateValue: string) => {
    const [year, month, day] = String(dateValue || '').split('-');
    if (!year || !month || !day) {
      return 'DEVOLUCAO-KP.pdf';
    }

    return `DEVOLUCAO-KP-${day}-${month}-${year}.pdf`;
  };

  const [activeTab, setActiveTab] = useState<'returns' | 'occurrences'>('returns');
  const [drivers, setDrivers] = useState<IDriver[]>([]);
  const [cars, setCars] = useState<ICar[]>([]);
  const [products, setProducts] = useState<IProduct[]>([]);

  const [returnNf, setReturnNf] = useState('');
  const [returnDanfe, setReturnDanfe] = useState<IDanfe | null>(null);
  const [returnType, setReturnType] = useState<'total' | 'partial' | 'sobra'>('total');
  const [partialProductCode, setPartialProductCode] = useState('');
  const [partialQuantity, setPartialQuantity] = useState<number>(1);
  const [partialItems, setPartialItems] = useState<IInvoiceReturnItem[]>([]);
  const [leftoverProductCode, setLeftoverProductCode] = useState('');
  const [leftoverQuantity, setLeftoverQuantity] = useState<number>(1);
  const [leftoverProductType, setLeftoverProductType] = useState('');
  const [draftNotes, setDraftNotes] = useState<Array<{
    invoice_number: string;
    return_type: 'total' | 'partial' | 'sobra';
    items: IInvoiceReturnItem[];
  }>>([]);
  const [returnDriverId, setReturnDriverId] = useState('');
  const [selectedCarId, setSelectedCarId] = useState('');
  const [returnDate, setReturnDate] = useState(getTodayDate());

  const [batchesDate, setBatchesDate] = useState(getTodayDate());
  const [returnBatches, setReturnBatches] = useState<IReturnBatch[]>([]);
  const [selectedBatchCode, setSelectedBatchCode] = useState('');
  const [batchDraftNotes, setBatchDraftNotes] = useState<IInvoiceReturn[]>([]);
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
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyModalTitle, setHistoryModalTitle] = useState('');
  const [userPermission, setUserPermission] = useState('');
  const [historyEntries, setHistoryEntries] = useState<Array<{
    id: number;
    action: string;
    actor_user_id: number | null;
    actor_username: string | null;
    created_at: string;
  }>>([]);

  const selectedBatch = useMemo(() => (
    returnBatches.find((batch) => batch.batch_code === selectedBatchCode) || null
  ), [returnBatches, selectedBatchCode]);
  const isAdminUser = userPermission === 'admin';

  useEffect(() => {
    if (!selectedBatch) {
      setBatchDraftNotes([]);
      return;
    }

    setBatchDraftNotes(selectedBatch.notes);
  }, [selectedBatch]);

  const selectedBatchHasUnsavedChanges = useMemo(() => {
    if (!selectedBatch) {
      return false;
    }

    const originalInvoices = selectedBatch.notes.map((note) => note.invoice_number).sort();
    const draftInvoices = batchDraftNotes.map((note) => note.invoice_number).sort();

    if (originalInvoices.length !== draftInvoices.length) {
      return true;
    }

    return originalInvoices.some((invoiceNumber, index) => invoiceNumber !== draftInvoices[index]);
  }, [selectedBatch, batchDraftNotes]);

  const selectedBatchAggregatedPreview = useMemo(() => {
    if (!selectedBatch) {
      return [];
    }

    return batchDraftNotes
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
  }, [selectedBatch, batchDraftNotes]);

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
  const selectedLeftoverProduct = useMemo(() => (
    products.find((product) => product.code === leftoverProductCode) || null
  ), [products, leftoverProductCode]);
  const leftoverTypeOptions = useMemo(() => {
    const productTypes = products.map((product) => String(product.type || '').trim().toUpperCase()).filter(Boolean);
    const defaults = ['KG', 'CX', 'UN', 'PCT'];
    return Array.from(new Set([...productTypes, ...defaults]));
  }, [products]);
  const getReturnTypeLabel = (value: 'total' | 'partial' | 'sobra') => {
    if (value === 'total') return 'Total';
    if (value === 'partial') return 'Parcial';
    return 'Sobra';
  };
  const getNoteDisplayLabel = (note: { invoice_number: string; return_type: 'total' | 'partial' | 'sobra' }) => {
    if (note.return_type === 'sobra') {
      return note.invoice_number.replace(/^SOBRA-/, 'Sobra ');
    }

    return `NF ${note.invoice_number}`;
  };

  useEffect(() => {
    if (!leftoverProductCode) {
      setLeftoverProductType('');
      return;
    }

    if (selectedLeftoverProduct?.type) {
      setLeftoverProductType(String(selectedLeftoverProduct.type).toUpperCase());
    }
  }, [leftoverProductCode, selectedLeftoverProduct]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedPermission = localStorage.getItem('user_permission') || '';
    setUserPermission(storedPermission);

    const validateAndLoad = async () => {
      if (!token) {
        navigate('/');
        return;
      }

      const isValidToken = await verifyToken(token);
      if (!isValidToken) {
        delete axios.defaults.headers.common.Authorization;
        navigate('/');
        return;
      }

      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      await Promise.all([loadDrivers(), loadCars(), loadProducts(), loadOccurrences(), loadReturnBatches()]);
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

  async function loadProducts() {
    try {
      const { data } = await axios.get(`${API_URL}/products`);
      setProducts(data);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
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
    if (returnType === 'sobra') {
      alert('Para sobra, informe codigo, quantidade e tipo do produto.');
      return;
    }

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
    if (returnType === 'sobra') {
      const normalizedCode = leftoverProductCode.trim().toUpperCase();
      const normalizedType = leftoverProductType.trim().toUpperCase();

      if (!normalizedCode) {
        alert('Informe o codigo do produto da sobra.');
        return [];
      }

      if (!leftoverQuantity || Number(leftoverQuantity) <= 0) {
        alert('Informe uma quantidade valida para sobra.');
        return [];
      }

      if (!normalizedType) {
        alert('Selecione o tipo do produto da sobra.');
        return [];
      }

      return [{
        product_id: normalizedCode,
        product_description: selectedLeftoverProduct?.description || `Sobra de produto ${normalizedCode}`,
        product_type: normalizedType,
        quantity: Math.round(Number(leftoverQuantity) * 1000) / 1000,
      }];
    }

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
    if (returnType !== 'sobra' && !returnDanfe) {
      alert('Busque uma NF para adicionar na lista.');
      return;
    }

    const noteItems = getCurrentNoteItems();
    if (!noteItems.length) {
      if (returnType === 'partial') {
        alert('Adicione ao menos um item na devolucao parcial.');
      }
      return;
    }

    const noteInvoiceNumber = returnType === 'sobra'
      ? `SOBRA-${noteItems[0].product_id}`
      : String(returnDanfe?.invoice_number);

    if (selectedBatch) {
      const existsInBatch = batchDraftNotes.some((note) => note.invoice_number === noteInvoiceNumber);
      if (existsInBatch) {
        alert(returnType === 'sobra'
          ? 'Essa sobra ja existe no lote selecionado.'
          : 'Essa NF ja existe no lote selecionado.');
        return;
      }

      setBatchDraftNotes((previous) => ([
        ...previous,
        {
          id: -(Date.now()),
          invoice_number: noteInvoiceNumber,
          return_type: returnType,
          driver_id: Number(selectedBatch.driver_id),
          vehicle_plate: selectedBatch.vehicle_plate,
          return_date: selectedBatch.return_date,
          batch_code: selectedBatch.batch_code,
          batch_status: selectedBatch.batch_status,
          items: noteItems,
        },
      ]));

      alert(returnType === 'sobra'
        ? 'Sobra adicionada na edicao do lote. Clique em "Salvar lote" para persistir.'
        : 'NF adicionada na edicao do lote. Clique em "Salvar lote" para persistir.');
      clearNfBuilder();
      return;
    }

    const existsInDraft = draftNotes.some((note) => note.invoice_number === noteInvoiceNumber);
    if (existsInDraft) {
      alert(returnType === 'sobra'
        ? 'Essa sobra ja esta na lista atual.'
        : 'Essa NF ja esta na lista atual.');
      return;
    }

    setDraftNotes((previous) => ([
      ...previous,
      {
        invoice_number: noteInvoiceNumber,
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
    setLeftoverProductCode('');
    setLeftoverQuantity(1);
    setLeftoverProductType('');
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

      const fileName = getReturnPdfFileName(returnDate);
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfFile);
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

  function handleRemoveNoteFromBatch(noteId: number) {
    setBatchDraftNotes((previous) => previous.filter((note) => note.id !== noteId));
  }

  async function handleSaveBatch() {
    if (!selectedBatch) {
      return;
    }

    const originalNotes = selectedBatch.notes;
    const draftInvoices = new Set(batchDraftNotes.map((note) => note.invoice_number));
    const originalInvoices = new Set(originalNotes.map((note) => note.invoice_number));

    const notesToAdd = batchDraftNotes.filter((note) => !originalInvoices.has(note.invoice_number));
    const notesToRemove = originalNotes.filter((note) => !draftInvoices.has(note.invoice_number));

    if (!notesToAdd.length && !notesToRemove.length) {
      alert('Nenhuma alteracao para salvar no lote.');
      return;
    }

    try {
      await Promise.all(notesToRemove.map((note) => axios.delete(`${API_URL}/returns/notes/${note.id}`)));
      await Promise.all(notesToAdd.map((note) => (
        axios.post(`${API_URL}/returns/batches/${selectedBatch.batch_code}/add-note`, {
          invoice_number: note.invoice_number,
          return_type: note.return_type,
          items: note.items,
        })
      )));

      alert('Lote salvo com sucesso.');
      await loadReturnBatches();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar alteracoes do lote.');
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

      const fileName = getReturnPdfFileName(batch.return_date);
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfFile);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      console.error(error);
      alert('Erro ao abrir PDF do lote.');
    }
  }

  async function handleViewOccurrenceHistory(id: number) {
    if (!isAdminUser) {
      alert('Somente usuarios admin podem visualizar o historico.');
      return;
    }

    try {
      const { data } = await axios.get(`${API_URL}/occurrences/${id}/history`);
      setHistoryModalTitle(`Historico da ocorrencia #${id}`);
      setHistoryEntries(data);
      setHistoryModalOpen(true);
    } catch (error) {
      console.error(error);
      alert('Erro ao carregar historico da ocorrencia.');
    }
  }

  async function handleDeleteOccurrence(id: number) {
    const confirmed = window.confirm('Deseja realmente excluir esta ocorrencia? O historico sera preservado.');
    if (!confirmed) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/occurrences/${id}`);
      await loadOccurrences();
      alert('Ocorrencia excluida com sucesso.');
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir ocorrencia.');
    }
  }

  async function handleViewBatchHistory(batchCode: string) {
    if (!isAdminUser) {
      alert('Somente usuarios admin podem visualizar o historico.');
      return;
    }

    try {
      const { data } = await axios.get(`${API_URL}/returns/batches/${batchCode}/history`);
      setHistoryModalTitle(`Historico do lote ${batchCode}`);
      setHistoryEntries(data);
      setHistoryModalOpen(true);
    } catch (error) {
      console.error(error);
      alert('Erro ao carregar historico do lote.');
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
                    <InlineText>Busque NF ou cadastre sobra, escolha o tipo e adicione na lista.</InlineText>
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
                  <label>
                    <input
                      type="checkbox"
                      checked={returnType === 'sobra'}
                      onChange={() => setReturnType('sobra')}
                    />
                    Sobra
                  </label>
                  <button onClick={handleSearchReturnNf} type="button">Buscar</button>
                </ReturnSearchRow>

                {(returnDanfe || returnType === 'sobra') && (
                  <>
                    {returnDanfe && returnType !== 'sobra' && (
                      <InfoText style={{ marginTop: '12px' }}>
                        NF carregada: {returnDanfe.invoice_number} | Cliente: {returnDanfe.Customer.name_or_legal_entity}
                      </InfoText>
                    )}

                    {returnType === 'partial' && returnDanfe && (
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

                    {!!partialItems.length && returnType === 'partial' && returnDanfe && (
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

                    {returnType === 'sobra' && (
                      <Grid style={{ marginTop: '12px' }}>
                        <div>
                          <InlineText>Codigo do produto</InlineText>
                          <input
                            type="text"
                            list="products-codes-list"
                            value={leftoverProductCode}
                            onChange={(event) => setLeftoverProductCode(event.target.value)}
                            placeholder="Ex.: 12345"
                          />
                          <datalist id="products-codes-list">
                            {products.map((product) => (
                              <option key={`leftover-code-${product.code}`} value={product.code}>
                                {product.description}
                              </option>
                            ))}
                          </datalist>
                        </div>
                        <div>
                          <InlineText>Quantidade</InlineText>
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={leftoverQuantity}
                            onChange={(event) => setLeftoverQuantity(Number(event.target.value))}
                          />
                        </div>
                        <div>
                          <InlineText>Tipo</InlineText>
                          <select
                            value={leftoverProductType}
                            onChange={(event) => setLeftoverProductType(event.target.value)}
                          >
                            <option value="">Selecione</option>
                            {leftoverTypeOptions.map((typeOption) => (
                              <option key={`leftover-type-${typeOption}`} value={typeOption}>
                                {typeOption}
                              </option>
                            ))}
                          </select>
                        </div>
                      </Grid>
                    )}

                    <Actions style={{ marginTop: '12px' }}>
                      <button className="primary" onClick={handleAddNf} type="button">
                        {returnType === 'sobra'
                          ? (selectedBatch ? 'Adicionar sobra no lote' : 'Adicionar sobra na lista')
                          : (selectedBatch ? 'Adicionar NF no lote' : 'Adicionar NF na lista')}
                      </button>
                    </Actions>
                  </>
                )}

                <ListHeaderRow>
                  <h2 style={{ marginTop: '18px' }}>Lista de NFs</h2>
                  {selectedBatch && (
                    <SaveBatchButton
                      onClick={handleSaveBatch}
                      disabled={!selectedBatchHasUnsavedChanges}
                      type="button"
                    >
                      Salvar lote
                    </SaveBatchButton>
                  )}
                </ListHeaderRow>
                {selectedBatch ? (
                  !batchDraftNotes.length ? (
                    <InlineText>Nenhuma NF no lote selecionado.</InlineText>
                  ) : (
                    <List>
                      {batchDraftNotes.map((note) => (
                        <li key={note.id}>
                          <span>
                            <strong>{getNoteDisplayLabel(note)}</strong>
                            {` | Tipo: ${getReturnTypeLabel(note.return_type)}`}
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
                            <strong>{getNoteDisplayLabel(note)}</strong>
                            {` | Tipo: ${getReturnTypeLabel(note.return_type)}`}
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

                {selectedBatch && !!selectedBatchAggregatedPreview.length && (
                  <>
                    <InlineText style={{ marginTop: '12px' }}>
                      Pre-visualizacao dos produtos consolidados do lote:
                    </InlineText>
                    <List>
                      {selectedBatchAggregatedPreview.map((item) => (
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
                    <Grid style={{ marginTop: '12px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
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
                      <div style={{ gridColumn: '1 / -1' }}>
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
                        <BatchItemContent>
                          <span>
                            <strong>{batch.batch_code}</strong>
                            {` | Motorista: ${batch.Driver?.name || batch.driver_id}`}
                            {` | Placa: ${batch.vehicle_plate}`}
                            {` | Data: ${batch.return_date}`}
                            {` | NFs: ${batch.notes.length}`}
                          </span>
                          <BatchActionsRow>
                            <button className="secondary" onClick={() => handleOpenBatchPdf(batch)} type="button">
                              Abrir PDF
                            </button>
                            {isAdminUser && (
                              <button className="secondary" onClick={() => handleViewBatchHistory(batch.batch_code)} type="button">
                                Historico
                              </button>
                            )}
                            <button className="primary" onClick={() => setSelectedBatchCode(batch.batch_code)} type="button">
                              Editar lote
                            </button>
                          </BatchActionsRow>
                        </BatchItemContent>
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
                <CardHeaderRow>
                  <h2>Registrar Ocorrencia</h2>
                  <button className="secondary" onClick={handleSearchOccurrenceNf} type="button">Buscar NF</button>
                </CardHeaderRow>
                <Grid style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
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
                <CardHeaderRow>
                  <h2>Ocorrencias Cadastradas</h2>
                  <button className="secondary" onClick={loadOccurrences} type="button">Atualizar lista</button>
                </CardHeaderRow>
                <Grid style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
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

                {!occurrences.length ? (
                  <InlineText style={{ marginTop: '12px' }}>Nenhuma ocorrencia encontrada.</InlineText>
                ) : (
                  <List>
                    {occurrences.map((occurrence) => (
                      <li key={occurrence.id}>
                        <OccurrenceItemContent>
                          <span>
                            <strong>NF {occurrence.invoice_number}</strong> | {occurrence.product_id || 'Sem produto'}
                            {occurrence.quantity ? ` | Qtd: ${occurrence.quantity}` : ''}
                            {' | '}
                            {occurrence.description}
                            {` | Data: ${new Date(occurrence.created_at).toLocaleDateString('pt-BR')}`}
                            {' | Status: '}
                            <strong>{occurrence.status === 'pending' ? 'Pendente' : 'Resolvida'}</strong>
                          </span>

                          <OccurrenceActionsRow>
                            <OccurrenceActionsLeft>
                              {occurrence.status === 'pending' && (
                                <button
                                  className="primary"
                                  onClick={() => handleResolveOccurrence(occurrence.id)}
                                  type="button"
                                >
                                  Marcar resolvida
                                </button>
                              )}
                            </OccurrenceActionsLeft>

                            <OccurrenceActionsRight>
                              {isAdminUser && (
                                <button
                                  className="secondary"
                                  onClick={() => handleViewOccurrenceHistory(occurrence.id)}
                                  type="button"
                                >
                                  Historico
                                </button>
                              )}
                              <button
                                className="danger"
                                onClick={() => handleDeleteOccurrence(occurrence.id)}
                                type="button"
                              >
                                Excluir
                              </button>
                            </OccurrenceActionsRight>
                          </OccurrenceActionsRow>
                        </OccurrenceItemContent>
                      </li>
                    ))}
                  </List>
                )}
              </Card>
            </TwoColumns>
          )}

          {historyModalOpen && (
            <>
              <ModalOverlay onClick={() => setHistoryModalOpen(false)} />
              <ModalCard>
                <h3>{historyModalTitle}</h3>
                {!historyEntries.length ? (
                  <InlineText>Nenhum evento de historico encontrado.</InlineText>
                ) : (
                  <List>
                    {historyEntries.map((entry) => (
                      <li key={entry.id}>
                        <span>
                          <strong>{entry.action}</strong>
                          {` | Usuario: ${entry.actor_username || entry.actor_user_id || 'nao identificado'}`}
                          {` | Data: ${new Date(entry.created_at).toLocaleString('pt-BR')}`}
                        </span>
                      </li>
                    ))}
                  </List>
                )}

                <Actions style={{ marginTop: '12px' }}>
                  <button className="secondary" onClick={() => setHistoryModalOpen(false)} type="button">
                    Fechar
                  </button>
                </Actions>
              </ModalCard>
            </>
          )}
        </PageContainer>
      </Container>
    </div>
  );
}

export default ReturnsOccurrences;
