import { useCallback, useEffect, useMemo, useRef, useState, KeyboardEvent } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import { pdf } from '@react-pdf/renderer';
import { FaArrowDownLong, FaArrowUpLong } from 'react-icons/fa6';
import { CarFront, ChevronDown, ChevronUp, MoreVertical, Route, Send, Truck, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useSearchParams } from 'react-router-dom';

import {
  ActionButton,
  BoxDriverVehicle,
  BoxSelectDanfe,
  ContainerForm,
  ContainerRoutePlanning,
  FieldGroup,
  FormColumn,
  FormColumns,
} from '../style/RoutePlanning';
import { Container } from '../style/invoices';
import { TruckLoader } from '../style/Loaders';
import Header from '../components/Header';
import Popup from '../components/Popup';
import ProductListPDF from '../components/ProductListPDF';
import Skeleton from '../components/ui/Skeleton';
import verifyToken from '../utils/verifyToken';
import { API_URL } from '../data';
import { ICar, IDanfe, IDriver, ITrip, ITripNote } from '../types/types';

type PlanningTab = 'routing' | 'trips';
type SwapMode = 'driver' | 'vehicle' | 'both';

interface ConflictState {
  type: 'driver' | 'vehicle';
  targetTrip: ITrip;
  nextDriver: string;
  nextCar: string;
}

function toApiDate(date: Date) {
  return format(date, 'dd-MM-yyyy');
}

function toISODate(date: string) {
  const [day, month, year] = String(date).split('-');
  return `${year}-${month}-${day}`;
}

function isTripActive(trip: ITrip) {
  return (trip.TripNotes || []).some((note) => !['returned', 'cancelled', 'delivered'].includes(String(note.status || '').toLowerCase()));
}

function RoutePlanning() {
  const [drivers, setDrivers] = useState<IDriver[]>([]);
  const [cars, setCars] = useState<ICar[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('null');
  const [selectedCar, setSelectedCar] = useState<string>('null');
  const [driverInput, setDriverInput] = useState<string>('');
  const [carInput, setCarInput] = useState<string>('');
  const [noteLookup, setNoteLookup] = useState<string>('');
  const [addedNotes, setAddedNotes] = useState<ITripNote[]>([]);
  const [todayTrips, setTodayTrips] = useState<ITrip[]>([]);
  const [displayedTrips, setDisplayedTrips] = useState<ITrip[]>([]);
  const [tripDateFilter, setTripDateFilter] = useState<Date | null>(new Date());
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [titlePopup, setTitlePopup] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTripsLoading, setIsTripsLoading] = useState<boolean>(false);
  const [countWeight, setCountWeight] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [tripToUpdate, setTripToUpdate] = useState<ITrip | null>(null);
  const [isSecondRunMode, setIsSecondRunMode] = useState<boolean>(false);
  const [assignmentWarning, setAssignmentWarning] = useState<string>('');
  const [detailsTrip, setDetailsTrip] = useState<ITrip | null>(null);
  const [editTrip, setEditTrip] = useState<ITrip | null>(null);
  const [editNotes, setEditNotes] = useState<ITripNote[]>([]);
  const [editSearch, setEditSearch] = useState<string>('');
  const [availableDanfes, setAvailableDanfes] = useState<IDanfe[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<PlanningTab>('routing');
  const [pendingConflict, setPendingConflict] = useState<ConflictState | null>(null);
  const [swapTargetTripId, setSwapTargetTripId] = useState<string>('');
  const [swapMode, setSwapMode] = useState<SwapMode>('both');
  const [isSwapModalOpen, setIsSwapModalOpen] = useState<boolean>(false);
  const [swapReason, setSwapReason] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [showAssignmentFields, setShowAssignmentFields] = useState<boolean>(true);
  const [lastScannedInvoice, setLastScannedInvoice] = useState<string>('');
  const [isMobileToolbarOpen, setIsMobileToolbarOpen] = useState<boolean>(false);
  const [isNotesNearBottom, setIsNotesNearBottom] = useState<boolean>(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState<boolean>(false);

  const navigate = useNavigate();
  const noteLookupRef = useRef<HTMLInputElement>(null);
  const previousDriverRef = useRef<string>('null');
  const previousCarRef = useRef<string>('null');
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const previousNotesCountRef = useRef<number>(0);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todayApiDate = useMemo(() => toApiDate(new Date()), []);
  const authConfig = useMemo(() => {
    const token = localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
  }, []);

  const sortedNotes = useMemo(() => addedNotes.slice().sort((a, b) => a.order - b.order), [addedNotes]);

  const sortedDisplayedTrips = useMemo(
    () => displayedTrips.slice().sort((a, b) => Number(a.run_number || 1) - Number(b.run_number || 1)),
    [displayedTrips],
  );

  const activeTodayTrips = useMemo(() => todayTrips.filter((trip) => isTripActive(trip)), [todayTrips]);

  const availableSwapTrips = useMemo(() => {
    if (!tripToUpdate) return [] as ITrip[];
    return activeTodayTrips.filter((trip) => Number(trip.id) !== Number(tripToUpdate.id));
  }, [activeTodayTrips, tripToUpdate]);

  const driverOccupancyMap = useMemo(() => {
    const map = new Map<string, ITrip>();
    activeTodayTrips.forEach((trip) => {
      if (tripToUpdate && Number(trip.id) === Number(tripToUpdate.id)) return;
      map.set(String(trip.driver_id), trip);
    });
    return map;
  }, [activeTodayTrips, tripToUpdate]);

  const carOccupancyMap = useMemo(() => {
    const map = new Map<string, ITrip>();
    activeTodayTrips.forEach((trip) => {
      if (tripToUpdate && Number(trip.id) === Number(tripToUpdate.id)) return;
      map.set(String(trip.car_id), trip);
    });
    return map;
  }, [activeTodayTrips, tripToUpdate]);

  const driverOptions = useMemo(() => {
    return drivers.map((driver) => {
      const occupiedTrip = driverOccupancyMap.get(String(driver.id));
      const statusLabel = occupiedTrip ? `Ocupado (Rota ${occupiedTrip.id})` : 'Disponível';
      return {
        id: String(driver.id),
        value: driver.name,
        label: `${driver.name} - ${statusLabel}`,
      };
    });
  }, [drivers, driverOccupancyMap]);

  const carOptions = useMemo(() => {
    return cars.map((car) => {
      const occupiedTrip = carOccupancyMap.get(String(car.id));
      const statusLabel = occupiedTrip ? `Ocupado (Rota ${occupiedTrip.id})` : 'Disponível';
      return {
        id: String(car.id),
        value: `${car.model} - ${car.license_plate}`,
        label: `${car.model} - ${car.license_plate} - ${statusLabel}`,
      };
    });
  }, [cars, carOccupancyMap]);

  const filteredAvailableDanfes = useMemo(() => {
    const term = editSearch.trim().toLowerCase();
    const alreadyInTrip = new Set(editNotes.map((note) => String(note.invoice_number)));

    return availableDanfes
      .filter((danfe) => !alreadyInTrip.has(String(danfe.invoice_number)))
      .filter((danfe) => {
        if (!term) return true;
        return String(danfe.invoice_number).includes(term)
          || String(danfe.Customer.name_or_legal_entity || '').toLowerCase().includes(term)
          || String(danfe.Customer.city || '').toLowerCase().includes(term);
      })
      .slice(0, 40);
  }, [availableDanfes, editNotes, editSearch]);

  const selectedDriverName = useMemo(() => {
    if (selectedDriver === 'null') return '';
    return drivers.find((driver) => String(driver.id) === String(selectedDriver))?.name || '';
  }, [drivers, selectedDriver]);

  const selectedVehicleLabel = useMemo(() => {
    if (selectedCar === 'null') return '';
    const car = cars.find((item) => String(item.id) === String(selectedCar));
    return car ? `${car.model} - ${car.license_plate}` : '';
  }, [cars, selectedCar]);

  useEffect(() => {
    if (selectedDriver === 'null') {
      setDriverInput('');
      return;
    }
    const option = driverOptions.find((item) => item.id === selectedDriver);
    if (option) setDriverInput(option.value);
  }, [selectedDriver, driverOptions]);

  useEffect(() => {
    if (selectedCar === 'null') {
      setCarInput('');
      return;
    }
    const option = carOptions.find((item) => item.id === selectedCar);
    if (option) setCarInput(option.value);
  }, [selectedCar, carOptions]);

  useEffect(() => {
    if (selectedDriver !== 'null' && selectedCar !== 'null') {
      setShowAssignmentFields(false);
    }
  }, [selectedDriver, selectedCar]);

  useEffect(() => {
    const current = sortedNotes.length;
    const previous = previousNotesCountRef.current;
    if (current > previous && notesContainerRef.current) {
      if (isNotesNearBottom) {
        notesContainerRef.current.scrollTop = notesContainerRef.current.scrollHeight;
        setShowJumpToLatest(false);
      } else {
        setShowJumpToLatest(true);
      }
    }
    previousNotesCountRef.current = current;
  }, [sortedNotes, isNotesNearBottom]);

  useEffect(() => {
    if (!lastScannedInvoice) return;
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setLastScannedInvoice('');
    }, 3500);
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [lastScannedInvoice]);

  const fetchTripsByDate = async (date: string) => {
    const response = await axios.get(`${API_URL}/trips/search/date/${date}`);
    return response.data as ITrip[];
  };

  const refreshTrips = useCallback(async (date?: string) => {
    const targetDate = date || todayApiDate;
    setIsTripsLoading(true);
    try {
      const trips = await fetchTripsByDate(targetDate);
      if (targetDate === todayApiDate) setTodayTrips(trips);
      setDisplayedTrips(trips);
    } finally {
      setIsTripsLoading(false);
    }
  }, [todayApiDate]);

  const jumpToLatest = () => {
    if (!notesContainerRef.current) return;
    notesContainerRef.current.scrollTop = notesContainerRef.current.scrollHeight;
    setIsNotesNearBottom(true);
    setShowJumpToLatest(false);
  };

  const setTab = useCallback((tab: PlanningTab) => {
    setActiveTab(tab);
    setIsMobileToolbarOpen(false);
    localStorage.setItem('routing_last_tab', tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadAssignmentFromTrip = useCallback((trip: ITrip | null) => {
    if (!trip) {
      setTripToUpdate(null);
      setIsUpdating(false);
      setAddedNotes([]);
      setCountWeight(0);
      previousDriverRef.current = 'null';
      previousCarRef.current = 'null';
      setShowAssignmentFields(true);
      return;
    }

    const tripNotes = (trip.TripNotes || []).filter((note) => !['returned', 'cancelled', 'delivered'].includes(String(note.status || '').toLowerCase()));
    const totalWeight = tripNotes.reduce((acc, note) => acc + Number(note.gross_weight || 0), 0);

    setTripToUpdate(trip);
    setIsUpdating(true);
    setAddedNotes(tripNotes);
    setCountWeight(totalWeight);
    setIsSecondRunMode(false);
    setSelectedDriver(String(trip.driver_id));
    setSelectedCar(String(trip.car_id));
    previousDriverRef.current = String(trip.driver_id);
    previousCarRef.current = String(trip.car_id);
    setShowAssignmentFields(false);
  }, []);

  useEffect(() => {
    const tabFromQuery = searchParams.get('tab');
    const tabFromStorage = localStorage.getItem('routing_last_tab');
    const resolved = (tabFromQuery === 'routing' || tabFromQuery === 'trips')
      ? tabFromQuery
      : (tabFromStorage === 'routing' || tabFromStorage === 'trips')
        ? tabFromStorage
        : 'routing';

    setActiveTab(resolved as PlanningTab);

    if (tabFromQuery !== resolved) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', resolved);
      setSearchParams(next, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const fetchToken = async () => {
      if (token) {
        const isValidToken = await verifyToken(token);
        if (!isValidToken) navigate('/');
      } else {
        navigate('/');
      }
    };

    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [carsResponse, driversResponse, tripsResponse] = await Promise.all([
          axios.get(`${API_URL}/cars`),
          axios.get(`${API_URL}/drivers`),
          axios.get(`${API_URL}/trips/search/date/${todayApiDate}`),
        ]);
        setCars(carsResponse.data);
        setDrivers(driversResponse.data);
        setTodayTrips(tripsResponse.data);
        setDisplayedTrips(tripsResponse.data);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchToken();
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedDriver === 'null' || selectedCar === 'null') {
      setAssignmentWarning('');
      return;
    }

    if (isSecondRunMode) {
      setAssignmentWarning('');
      return;
    }

    const hasDriverConflict = driverOccupancyMap.has(String(selectedDriver));
    const hasCarConflict = carOccupancyMap.has(String(selectedCar));

    if (hasCarConflict) {
      setAssignmentWarning('Placa ocupada em rota ativa no dia. Resolva com Swap, 2ª saída ou escolha outro veículo.');
      return;
    }

    if (hasDriverConflict) {
      setAssignmentWarning('Motorista ocupado em rota ativa no dia. Resolva com Swap, 2ª saída ou escolha outro motorista.');
      return;
    }

    setAssignmentWarning('');
  }, [selectedDriver, selectedCar, isSecondRunMode, driverOccupancyMap, carOccupancyMap]);

  const applyDriverSelection = (driverId: string) => {
    setSelectedDriver(driverId);

    if (driverId === 'null') {
      loadAssignmentFromTrip(null);
      return;
    }

    if (tripToUpdate && !isSecondRunMode) {
      const occupied = driverOccupancyMap.get(driverId);
      if (occupied) {
        setPendingConflict({
          type: 'driver',
          targetTrip: occupied,
          nextDriver: driverId,
          nextCar: selectedCar,
        });
        return;
      }
    }

    previousDriverRef.current = driverId;
  };

  const applyCarSelection = (carId: string) => {
    setSelectedCar(carId);

    if (carId === 'null') return;

    if (tripToUpdate && !isSecondRunMode) {
      const occupied = carOccupancyMap.get(carId);
      if (occupied) {
        setPendingConflict({
          type: 'vehicle',
          targetTrip: occupied,
          nextDriver: selectedDriver,
          nextCar: carId,
        });
        return;
      }
    }

    previousCarRef.current = carId;
  };

  const normalizeValue = (value: string) => value.trim().toLowerCase();

  const commitDriverInput = (rawValue: string, preferFirst = false) => {
    const normalized = normalizeValue(rawValue);
    if (!normalized) {
      applyDriverSelection('null');
      return false;
    }

    const exact = driverOptions.find((item) =>
      normalizeValue(item.value) === normalized || normalizeValue(item.label) === normalized
    );
    const fallback = preferFirst
      ? driverOptions.find((item) =>
        normalizeValue(item.value).includes(normalized) || normalizeValue(item.label).includes(normalized)
      )
      : undefined;
    const selected = exact || fallback;
    if (!selected) return false;

    applyDriverSelection(selected.id);
    setDriverInput(selected.value);
    return true;
  };

  const commitCarInput = (rawValue: string, preferFirst = false) => {
    const normalized = normalizeValue(rawValue);
    if (!normalized) {
      applyCarSelection('null');
      return false;
    }

    const exact = carOptions.find((item) =>
      normalizeValue(item.value) === normalized || normalizeValue(item.label) === normalized
    );
    const fallback = preferFirst
      ? carOptions.find((item) =>
        normalizeValue(item.value).includes(normalized) || normalizeValue(item.label).includes(normalized)
      )
      : undefined;
    const selected = exact || fallback;
    if (!selected) return false;

    applyCarSelection(selected.id);
    setCarInput(selected.value);
    return true;
  };

  const resolveConflictCancel = () => {
    if (!pendingConflict) return;
    if (pendingConflict.type === 'driver') setSelectedDriver(previousDriverRef.current);
    if (pendingConflict.type === 'vehicle') setSelectedCar(previousCarRef.current);
    setPendingConflict(null);
  };

  const resolveConflictSecondRun = () => {
    setIsSecondRunMode(true);
    setIsUpdating(false);
    setTripToUpdate(null);
    setPendingConflict(null);
  };

  const executeSwap = async (targetTripId: number, mode: SwapMode, reason = '') => {
    if (!tripToUpdate) return;

    try {
      setIsSwapping(true);
      const payload = {
        targetTripId,
        swapDriver: mode === 'driver' || mode === 'both',
        swapVehicle: mode === 'vehicle' || mode === 'both',
        reason: reason || null,
      };

      const { data } = await axios.post(`${API_URL}/trips/${tripToUpdate.id}/swap`, payload, authConfig);

      await refreshTrips(todayApiDate);

      const refreshed = await fetchTripsByDate(todayApiDate);
      setTodayTrips(refreshed);
      const sourceTrip = data?.sourceTrip || refreshed.find((trip) => Number(trip.id) === Number(tripToUpdate.id));
      if (sourceTrip) loadAssignmentFromTrip(sourceTrip);

      setPendingConflict(null);
      setIsSwapModalOpen(false);
      setSwapReason('');
      alert('Troca aplicada com sucesso.');
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Erro ao executar troca de rota.');
    } finally {
      setIsSwapping(false);
    }
  };

  const resolveConflictSwap = async () => {
    if (!pendingConflict) return;
    const mode: SwapMode = pendingConflict.type === 'driver' ? 'driver' : 'vehicle';
    await executeSwap(Number(pendingConflict.targetTrip.id), mode, 'Conflito resolvido durante edicao');
  };

  const toggleSecondRun = () => {
    if (!isSecondRunMode) {
      if (selectedDriver === 'null') {
        alert('Selecione um motorista antes de abrir a Segunda saída.');
        return;
      }
      setIsSecondRunMode(true);
      setIsUpdating(false);
      setTripToUpdate(null);
      return;
    }

    setIsSecondRunMode(false);
    if (tripToUpdate) loadAssignmentFromTrip(tripToUpdate);
  };

  const handleEnterPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddNote();
    }
  };

  const handleNotesScroll = () => {
    const element = notesContainerRef.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
    setIsNotesNearBottom(nearBottom);
    if (nearBottom) setShowJumpToLatest(false);
  };

  const fetchDanfeByLookup = async (lookup: string) => {
    const normalizedLookup = String(lookup || '').trim();
    if (!normalizedLookup) return null;

    try {
      const byNf = await axios.get(`${API_URL}/danfes/nf/${normalizedLookup}`);
      if (byNf?.data) return byNf.data;
    } catch {
      // Ignora e tenta buscar por barcode
    }

    const sanitizedBarcode = normalizedLookup.replace(/\s+/g, '');
    const byBarcode = await axios.get(`${API_URL}/danfes/barcode/${sanitizedBarcode}`);
    return byBarcode?.data || null;
  };

  const handleAddNote = async () => {
    if (selectedDriver === 'null' || selectedCar === 'null') {
      alert('Selecione um motorista e um veículo antes de adicionar uma nota.');
      return;
    }

    const lookup = noteLookup.trim();
    if (!lookup) {
      alert('Digite a NF ou código de barras da nota.');
      return;
    }

    try {
      const danfeData = await fetchDanfeByLookup(lookup);
      if (!danfeData) {
        alert('Nota não encontrada. Confira a NF/código de barras e tente novamente.');
        return;
      }

      if (danfeData.status !== 'pending' && danfeData.status !== 'redelivery') {
        alert('Essa nota não pode ser roteirizada, verifique o status dela.');
        return;
      }

      if (addedNotes.some((note) => String(danfeData.invoice_number) === String(note.invoice_number))) {
        alert('Esta nota já foi adicionada à viagem.');
        return;
      }

      const newNote: ITripNote = {
        customer_name: danfeData.Customer.name_or_legal_entity,
        invoice_number: danfeData.invoice_number,
        city: danfeData.Customer.city,
        order: addedNotes.length + 1,
        gross_weight: danfeData.gross_weight,
        status: 'pending',
      };

      setAddedNotes((prev) => [...prev, newNote]);
      setCountWeight((prev) => prev + Number(danfeData.gross_weight || 0));
      setLastScannedInvoice(String(newNote.invoice_number));
    } catch {
      alert('Não foi possível buscar essa nota.');
    } finally {
      setNoteLookup('');
      noteLookupRef.current?.focus();
    }
  };

  const removeNoteFromList = async (nf: string, noteId: any) => {
    if (tripToUpdate?.id && noteId) {
      setIsLoading(true);
      try {
        await axios.put(`${API_URL}/trips/remove-note/${tripToUpdate.id}`, { noteId }, authConfig);
        await axios.put(`${API_URL}/danfes/update-status`, {
          danfes: [{ invoice_number: nf, status: 'pending' }],
        });
        setAddedNotes((prev) => prev.filter((note) => String(note.invoice_number) !== String(nf)));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setAddedNotes((prev) => prev.filter((note) => String(note.invoice_number) !== String(nf)));
  };

  const moveNoteUp = (order: number) => {
    const updated = [...addedNotes];
    const prevIndex = updated.findIndex((note) => note.order === order - 1);
    const currIndex = updated.findIndex((note) => note.order === order);
    if (prevIndex !== -1 && currIndex !== -1) {
      [updated[prevIndex].order, updated[currIndex].order] = [updated[currIndex].order, updated[prevIndex].order];
      setAddedNotes(updated);
    }
  };

  const moveNoteDown = (order: number) => {
    const updated = [...addedNotes];
    const nextIndex = updated.findIndex((note) => note.order === order + 1);
    const currIndex = updated.findIndex((note) => note.order === order);
    if (nextIndex !== -1 && currIndex !== -1) {
      [updated[nextIndex].order, updated[currIndex].order] = [updated[currIndex].order, updated[nextIndex].order];
      setAddedNotes(updated);
    }
  };

  const sendTripsToBackend = async () => {
    const total = sortedNotes.reduce((sum, note) => sum + Number(note.gross_weight || 0), 0);

    if (assignmentWarning) {
      alert(assignmentWarning);
      return;
    }

    if (selectedDriver === 'null' || selectedCar === 'null' || !sortedNotes.length) {
      alert('Selecione motorista, veículo e adicione ao menos uma nota antes de enviar.');
      return;
    }

    try {
      setIsLoading(true);
      const validation = await axios.post(`${API_URL}/trips/validate-assignment`, {
        date: todayApiDate,
        driver_id: Number(selectedDriver),
        car_id: Number(selectedCar),
        is_second_run: isSecondRunMode,
        replace_trip_id: isUpdating && tripToUpdate ? tripToUpdate.id : null,
      }, authConfig);

      if (!validation?.data?.ok) {
        if (validation?.data?.conflicts?.hasCarConflict) {
          alert('Placa ocupada em rota ativa no dia.');
          return;
        }
        if (validation?.data?.conflicts?.hasDriverConflict) {
          alert('Motorista já possui rota ativa no dia. Use Segunda saída ou faça Swap.');
          return;
        }
      }

      await axios.put(`${API_URL}/danfes/update-status`, {
        danfes: sortedNotes.map((note) => ({ invoice_number: note.invoice_number, status: 'assigned' })),
      });

      await axios.post(`${API_URL}/trips/create`, {
        driver_id: Number(selectedDriver),
        car_id: Number(selectedCar),
        date: todayApiDate,
        gross_weight: total,
        is_second_run: isSecondRunMode,
        replace_trip_id: isUpdating && tripToUpdate ? tripToUpdate.id : null,
        run_number: tripToUpdate?.run_number,
        tripNotes: sortedNotes.map(({ invoice_number, city, customer_name, order, gross_weight }) => ({
          invoice_number,
          city,
          customer_name,
          status: 'assigned',
          order,
          gross_weight,
        })),
      }, authConfig);

      if (isUpdating && tripToUpdate) {
        await axios.delete(`${API_URL}/trips/delete/${tripToUpdate.id}`, authConfig);
      }

      alert(isUpdating ? 'Rota atualizada com sucesso.' : 'Viagem criada com sucesso.');
      setSelectedDriver('null');
      setSelectedCar('null');
      setAddedNotes([]);
      setIsUpdating(false);
      setTripToUpdate(null);
      setIsSecondRunMode(false);
      setCountWeight(0);
      await refreshTrips(todayApiDate);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Erro ao enviar a viagem.');
    } finally {
      setIsLoading(false);
    }
  };

  const addDriverOrCar = (type: 'driver' | 'car') => {
    setShowPopup(true);
    setTitlePopup(type === 'driver' ? 'Adicionar Motorista' : 'Adicionar Veículo');
  };

  const handleAddNewDriverOrCar = (data: any) => {
    if (titlePopup === 'Adicionar Motorista') setDrivers((prev) => [...prev, data]);
    else setCars((prev) => [...prev, data]);
  };

  const handleTripSearch = async () => {
    const date = tripDateFilter || new Date();
    await refreshTrips(toApiDate(date));
  };

  const fetchAvailableForTrip = async (tripDate: string) => {
    try {
      const isoDate = toISODate(tripDate);
      const { data } = await axios.get(`${API_URL}/danfes/date/?startDate=${isoDate}&endDate=${isoDate}`);
      const filtered = Array.isArray(data)
        ? data.filter((danfe: any) => ['pending', 'redelivery', 'assigned'].includes(String(danfe.status || '').toLowerCase()))
        : [];
      setAvailableDanfes(filtered);
    } catch {
      setAvailableDanfes([]);
    }
  };

  const startEditModeFromTrip = async (trip: ITrip) => {
    setTab('routing');
    loadAssignmentFromTrip(trip);
    setEditTrip(trip);
    setEditNotes((trip.TripNotes || []).slice().sort((a, b) => a.order - b.order));
    setEditSearch('');
    await fetchAvailableForTrip(trip.date);
  };

  const exitEditMode = () => {
    setIsUpdating(false);
    setTripToUpdate(null);
    setEditTrip(null);
    setAddedNotes([]);
    setCountWeight(0);
    setSelectedDriver('null');
    setSelectedCar('null');
    setIsSecondRunMode(false);
    setAssignmentWarning('');
    setPendingConflict(null);
    setShowAssignmentFields(true);
  };

  const addAvailableDanfeToEdit = (danfe: IDanfe) => {
    setEditNotes((prev) => [
      ...prev,
      {
        invoice_number: danfe.invoice_number,
        customer_name: danfe.Customer.name_or_legal_entity,
        city: danfe.Customer.city,
        order: prev.length + 1,
        gross_weight: String(danfe.gross_weight || 0),
        status: 'assigned',
      },
    ]);
  };

  const removeEditNote = (invoice: string) => {
    setEditNotes((prev) => prev
      .filter((note) => String(note.invoice_number) !== String(invoice))
      .map((note, index) => ({ ...note, order: index + 1 })));
  };

  const saveTripEdition = async () => {
    if (!editTrip) return;
    if (!editNotes.length) {
      alert('A rota precisa ter ao menos uma nota.');
      return;
    }

    try {
      setIsSavingEdit(true);
      const validation = await axios.post(`${API_URL}/trips/validate-assignment`, {
        date: editTrip.date,
        driver_id: Number(selectedDriver),
        car_id: Number(selectedCar),
        replace_trip_id: editTrip.id,
        is_second_run: Number(editTrip.run_number || 1) > 1 || isSecondRunMode,
      }, authConfig);

      if (!validation.data?.ok && !isSecondRunMode) {
        alert('Conflito de motorista/placa para salvar edição.');
        return;
      }

      const originalInvoices = new Set((editTrip.TripNotes || []).map((note) => String(note.invoice_number)));
      const nextInvoices = new Set(editNotes.map((note) => String(note.invoice_number)));

      const danfesToPending = Array.from(originalInvoices)
        .filter((invoice) => !nextInvoices.has(invoice))
        .map((invoice_number) => ({ invoice_number, status: 'pending' }));

      const danfesToAssigned = Array.from(nextInvoices)
        .filter((invoice) => !originalInvoices.has(invoice))
        .map((invoice_number) => ({ invoice_number, status: 'assigned' }));

      if (danfesToPending.length) await axios.put(`${API_URL}/danfes/update-status`, { danfes: danfesToPending });
      if (danfesToAssigned.length) await axios.put(`${API_URL}/danfes/update-status`, { danfes: danfesToAssigned });

      const totalWeight = editNotes.reduce((acc, note) => acc + Number(note.gross_weight || 0), 0);

      await axios.post(`${API_URL}/trips/create`, {
        driver_id: Number(selectedDriver),
        car_id: Number(selectedCar),
        date: editTrip.date,
        gross_weight: totalWeight,
        run_number: isSecondRunMode ? Number(editTrip.run_number || 1) + 1 : editTrip.run_number || 1,
        is_second_run: isSecondRunMode || Number(editTrip.run_number || 1) > 1,
        replace_trip_id: editTrip.id,
        tripNotes: editNotes.map((note, index) => ({
          invoice_number: note.invoice_number,
          city: note.city,
          customer_name: note.customer_name,
          status: 'assigned',
          order: index + 1,
          gross_weight: note.gross_weight,
        })),
      }, authConfig);

      await axios.delete(`${API_URL}/trips/delete/${editTrip.id}`, authConfig);

      alert('Rota atualizada com sucesso.');
      setEditTrip(null);
      setEditNotes([]);
      const selectedDate = tripDateFilter ? toApiDate(tripDateFilter) : todayApiDate;
      await refreshTrips(selectedDate);
      const refreshedToday = await fetchTripsByDate(todayApiDate);
      setTodayTrips(refreshedToday);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Erro ao salvar edição da rota.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const fetchDanfesByTrip = async (trip: ITrip) => {
    const requests = trip.TripNotes.map((note) => axios.get(`${API_URL}/danfes/nf/${note.invoice_number}`).then((res) => res.data).catch(() => null));
    const danfes = await Promise.all(requests);
    return danfes.filter((item) => item !== null);
  };

  const printTripProducts = async (trip: ITrip) => {
    try {
      setIsPrinting(true);
      const validDanfes: any[] = await fetchDanfesByTrip(trip);
      const allProducts = validDanfes.flatMap((danfe) => danfe.DanfeProducts || []);
      const grouped = allProducts.reduce((acc: any[], product: any) => {
        const existing = acc.find((item) => item.Product.code === product.Product.code);
        const quantity = Number(product.quantity || 0);
        if (existing) existing.quantity += quantity;
        else acc.push({ ...product, quantity });
        return acc;
      }, []);
      const pdfBlob = await pdf(<ProductListPDF products={grouped} driver={trip.Driver.name} />).toBlob();
      window.open(URL.createObjectURL(pdfBlob), '_blank');
    } finally {
      setIsPrinting(false);
    }
  };

  const printTripDeliveries = async (trip: ITrip) => {
    try {
      setIsPrinting(true);
      const validDanfes: any[] = await fetchDanfesByTrip(trip);
      const pdfBlob = await pdf(<ProductListPDF danfes={validDanfes} driver={trip.Driver.name} />).toBlob();
      window.open(URL.createObjectURL(pdfBlob), '_blank');
    } finally {
      setIsPrinting(false);
    }
  };

  if (isLoading) {
    return (
      <ContainerRoutePlanning>
        <Header />
        <Container>
          <TruckLoader />
        </Container>
      </ContainerRoutePlanning>
    );
  }

  return (
    <ContainerRoutePlanning>
      <Header />
      <Container className="h-[calc(100dvh-var(--header-height)-var(--space-2))] min-h-0 overflow-hidden pb-2 pt-[calc(var(--header-height)+var(--space-2))]">
        <div className="flex h-full w-full max-w-[1280px] min-h-0 flex-col">
          <div className="flex items-end justify-between gap-2">
            <div className="relative inline-flex items-end rounded-t-xl border border-border bg-[linear-gradient(180deg,rgba(14,24,40,0.92)_0%,rgba(10,18,32,0.95)_100%)] px-1 pt-1">
              <button
                type="button"
                onClick={() => setTab('routing')}
                className={`relative -mb-px rounded-t-[10px] border px-4 py-2 text-sm font-semibold transition ${activeTab === 'routing'
                  ? 'border-border border-b-transparent bg-surface text-text shadow-[0_12px_20px_rgba(2,8,16,0.35)]'
                  : 'border-transparent bg-surface-2/70 text-muted shadow-[0_6px_12px_rgba(2,8,16,0.2)] hover:text-text'
                }`}
              >
                Roteirização
              </button>
              <button
                type="button"
                onClick={() => setTab('trips')}
                className={`relative -mb-px rounded-t-[10px] border px-4 py-2 text-sm font-semibold transition ${activeTab === 'trips'
                  ? 'border-border border-b-transparent bg-surface text-text shadow-[0_12px_20px_rgba(2,8,16,0.35)]'
                  : 'border-transparent bg-surface-2/70 text-muted shadow-[0_6px_12px_rgba(2,8,16,0.2)] hover:text-text'
                }`}
              >
                Trips
              </button>
            </div>

            {activeTab === 'routing' ? (
              <>
                <div className="hidden items-center gap-1 md:flex">
                  <button type="button" onClick={() => addDriverOrCar('driver')} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface-2/85 px-2.5 text-xs text-text"><UserPlus className="h-4 w-4" />Motorista</button>
                  <button type="button" onClick={() => addDriverOrCar('car')} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface-2/85 px-2.5 text-xs text-text"><CarFront className="h-4 w-4" />Veículo</button>
                  <button type="button" onClick={toggleSecondRun} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-700/70 bg-amber-950/25 px-2.5 text-xs text-amber-200"><Route className="h-4 w-4" />{isSecondRunMode ? 'Cancelar 2ª' : '2ª saída'}</button>
                  <button type="button" onClick={sendTripsToBackend} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/15 bg-gradient-to-r from-accent to-accent-strong px-3 text-xs font-semibold text-[#04131e]"><Send className="h-4 w-4" />{isUpdating ? 'Atualizar' : 'Enviar'}</button>
                </div>

                <div className="relative md:hidden">
                  <button type="button" onClick={() => setIsMobileToolbarOpen((prev) => !prev)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-2/85 text-text">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {isMobileToolbarOpen ? (
                    <div className="absolute right-0 top-10 z-20 w-52 rounded-md border border-border bg-surface p-2 shadow-[var(--shadow-3)]">
                      <button type="button" onClick={() => { addDriverOrCar('driver'); setIsMobileToolbarOpen(false); }} className="mb-1 flex h-9 w-full items-center gap-2 rounded-md border border-border bg-surface-2/80 px-2 text-xs text-text"><UserPlus className="h-4 w-4" />Adicionar motorista</button>
                      <button type="button" onClick={() => { addDriverOrCar('car'); setIsMobileToolbarOpen(false); }} className="mb-1 flex h-9 w-full items-center gap-2 rounded-md border border-border bg-surface-2/80 px-2 text-xs text-text"><CarFront className="h-4 w-4" />Adicionar veículo</button>
                      <button type="button" onClick={() => { toggleSecondRun(); setIsMobileToolbarOpen(false); }} className="mb-1 flex h-9 w-full items-center gap-2 rounded-md border border-amber-700/70 bg-amber-950/25 px-2 text-xs text-amber-200"><Route className="h-4 w-4" />{isSecondRunMode ? 'Cancelar 2ª saída' : 'Segunda saída'}</button>
                      <button type="button" onClick={() => { sendTripsToBackend(); setIsMobileToolbarOpen(false); }} className="flex h-9 w-full items-center gap-2 rounded-md border border-white/15 bg-gradient-to-r from-accent to-accent-strong px-2 text-xs font-semibold text-[#04131e]"><Send className="h-4 w-4" />{isUpdating ? 'Atualizar viagem' : 'Enviar viagem'}</button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

        {activeTab === 'routing' ? (
          <section className="w-full max-w-[1280px] min-h-0 flex-1 rounded-b-lg rounded-tr-lg border border-border bg-surface/70 p-2 shadow-[var(--shadow-2)]">
            <div className="flex h-full min-h-0 flex-col">
              {isUpdating && tripToUpdate ? (
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-700/60 bg-sky-950/30 px-2 py-1.5 text-xs text-sky-200">
                  <span>
                    Modo edição: rota #{tripToUpdate.id} | Motorista {tripToUpdate.Driver.name} | Placa {tripToUpdate.Car.license_plate}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-sky-700/65 bg-sky-900/25 px-2 py-1 text-sky-100"
                      onClick={() => setIsSwapModalOpen(true)}
                    >
                      Trocar com rota...
                    </button>
                    <button
                      type="button"
                      className="rounded border border-border bg-surface px-2 py-1 text-text"
                      onClick={exitEditMode}
                    >
                      Sair do modo edição
                    </button>
                  </div>
                </div>
              ) : null}

              <div className={`overflow-hidden transition-all duration-300 ${showAssignmentFields ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <ContainerForm className="w-full p-0">
                  <FormColumns className="grid-cols-1 gap-2">
                    <FormColumn className="gap-1">
                      <BoxDriverVehicle className="grid w-full grid-cols-1 gap-2 md:grid-cols-2">
                        <FieldGroup>
                          <label>Motorista:</label>
                          <input
                            list="driver-suggestions"
                            value={driverInput}
                            onChange={(event) => {
                              const value = event.target.value;
                              setDriverInput(value);
                              commitDriverInput(value, false);
                            }}
                            onBlur={(event) => {
                              commitDriverInput(event.target.value, true);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                commitDriverInput((event.target as HTMLInputElement).value, true);
                              }
                              if (event.key === 'Tab') {
                                commitDriverInput((event.target as HTMLInputElement).value, true);
                              }
                            }}
                            placeholder="Digite nome do motorista"
                          />
                          <datalist id="driver-suggestions">
                            {driverOptions.map((option) => (
                              <option key={option.id} value={option.value} label={option.label} />
                            ))}
                          </datalist>
                        </FieldGroup>
                        <FieldGroup>
                          <label>Veículo:</label>
                          <input
                            list="car-suggestions"
                            value={carInput}
                            onChange={(event) => {
                              const value = event.target.value;
                              setCarInput(value);
                              commitCarInput(value, false);
                            }}
                            onBlur={(event) => {
                              commitCarInput(event.target.value, true);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                commitCarInput((event.target as HTMLInputElement).value, true);
                              }
                              if (event.key === 'Tab') {
                                commitCarInput((event.target as HTMLInputElement).value, true);
                              }
                            }}
                            placeholder="Digite placa ou veículo"
                          />
                          <datalist id="car-suggestions">
                            {carOptions.map((option) => (
                              <option key={option.id} value={option.value} label={option.label} />
                            ))}
                          </datalist>
                        </FieldGroup>
                      </BoxDriverVehicle>
                    </FormColumn>
                  </FormColumns>
                </ContainerForm>
              </div>

              {showAssignmentFields && selectedDriver !== 'null' && selectedCar !== 'null' ? (
                <div className="mb-2 mt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAssignmentFields(false)}
                    className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs text-text"
                  >
                    Ocultar seleção <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}

              {!showAssignmentFields && (selectedDriver !== 'null' || selectedCar !== 'null') ? (
                <div className="mb-2 mt-1 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-2/60 px-2 py-1.5 text-xs">
                  <span className="text-muted">
                    <strong className="text-text">Motorista:</strong> {selectedDriverName || '-'} | <strong className="text-text">Veículo:</strong> {selectedVehicleLabel || '-'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAssignmentFields(true)}
                    className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs text-text"
                  >
                    Editar <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}

              {assignmentWarning ? (
                <div className="mb-2 w-full rounded-md border border-rose-700/65 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
                  {assignmentWarning}
                </div>
              ) : null}

              <div className="mb-2 grid w-full grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                <BoxSelectDanfe>
                  <input
                    type="text"
                    ref={noteLookupRef}
                    onKeyDown={handleEnterPress}
                    placeholder="Digite NF ou código de barras"
                    value={noteLookup}
                    onChange={(event) => setNoteLookup(event.target.value)}
                    disabled={selectedDriver === 'null' || selectedCar === 'null'}
                  />
                </BoxSelectDanfe>
                <ActionButton
                  $tone="secondary"
                  className="w-full border-accent/45 bg-[rgba(14,33,56,0.95)] px-3 py-2 text-sm text-sky-100 hover:bg-[rgba(18,43,72,0.98)] md:w-auto"
                  onClick={handleAddNote}
                  disabled={selectedDriver === 'null' || selectedCar === 'null'}
                >
                  Adicionar Nota
                </ActionButton>
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-surface-2/45">
                <div ref={notesContainerRef} onScroll={handleNotesScroll} className="scrollbar-ui h-full overflow-y-auto p-2">
                  <ul className="space-y-2">
                    {sortedNotes.map((note) => (
                      <li key={`${note.invoice_number}-${note.order}`} className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-2 ${lastScannedInvoice === String(note.invoice_number) ? 'border-emerald-500/70 bg-emerald-950/20' : 'border-border bg-surface-2/70'}`}>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold text-text">
                          {note.order}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-text">NF {note.invoice_number} | {note.customer_name}</p>
                          <p className="truncate text-xs text-muted">{note.city} | {note.gross_weight} Kg</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => moveNoteUp(note.order)} disabled={note.order === 1} className="rounded border border-border bg-surface px-2 py-1 text-xs text-text disabled:opacity-45">
                            <FaArrowUpLong />
                          </button>
                          <button type="button" onClick={() => moveNoteDown(note.order)} disabled={note.order === addedNotes.length} className="rounded border border-border bg-surface px-2 py-1 text-xs text-text disabled:opacity-45">
                            <FaArrowDownLong />
                          </button>
                          <button type="button" onClick={() => removeNoteFromList(note.invoice_number, note.id)} className="rounded border border-rose-700/70 bg-rose-950/30 px-2 py-1 text-xs text-rose-200">
                            Remover
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                {showJumpToLatest ? (
                  <button
                    type="button"
                    onClick={jumpToLatest}
                    className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border border-sky-700/70 bg-sky-950/80 px-3 py-1.5 text-xs text-sky-100 shadow-[var(--shadow-2)]"
                  >
                    Ir para a última <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="mt-2 flex shrink-0 items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs">
                <span className="text-muted"><strong className="text-text">{sortedNotes.length}</strong> notas adicionadas</span>
                <span className="text-muted">Peso total: <strong className="text-text">{countWeight.toFixed(2)}</strong></span>
                <span className="inline-flex items-center gap-1 text-muted"><Truck className="h-3.5 w-3.5" /> status operacional</span>
              </div>
            </div>
          </section>
        ) : (
          <section className="flex w-full max-w-[1280px] min-h-0 flex-1 flex-col rounded-b-lg rounded-tr-lg border border-border bg-surface/70 p-3 shadow-[var(--shadow-2)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-text">Trips / Rotas</h2>
              <div className="flex items-center gap-2">
                <DatePicker
                  selected={tripDateFilter}
                  onChange={(date) => setTripDateFilter(date)}
                  dateFormat="dd/MM/yyyy"
                  locale={ptBR}
                  className="h-10 rounded-sm border border-accent/35 bg-[rgba(14,33,56,0.9)] px-3 text-sm text-text"
                />
                <button type="button" onClick={handleTripSearch} className="h-10 rounded-md border border-white/15 bg-gradient-to-r from-accent to-accent-strong px-4 text-sm font-semibold text-[#04131e]">Buscar</button>
              </div>
            </div>

            {isTripsLoading ? (
              <div className="grid gap-2 md:grid-cols-2"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>
            ) : (
              <div className="scrollbar-ui min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {!sortedDisplayedTrips.length ? (
                  <div className="rounded-md border border-border bg-surface-2/70 p-3 text-sm text-muted">Nenhuma rota encontrada para essa data.</div>
                ) : (
                  sortedDisplayedTrips.map((trip) => (
                    <article key={trip.id} className="rounded-md border border-border bg-surface-2/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-text">{trip.Driver.name} | {trip.Car.license_plate}</p>
                          <p className="text-xs text-muted">{trip.date} | saída #{trip.run_number || 1} | {trip.TripNotes.length} notas</p>
                        </div>
                        <span className="rounded-full border border-sky-700/60 bg-sky-950/30 px-2 py-1 text-xs text-sky-200">{isTripActive(trip) ? 'Ativa' : 'Finalizada'}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text" onClick={() => setDetailsTrip(trip)}>Ver detalhes</button>
                        <button type="button" className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text" onClick={() => startEditModeFromTrip(trip)}>Editar rota</button>
                        <button type="button" className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text" onClick={() => printTripProducts(trip)}>Imprimir produtos</button>
                        <button type="button" className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text" onClick={() => printTripDeliveries(trip)}>Imprimir entregas</button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}
          </section>
        )}
        </div>

        {showPopup && <Popup title={titlePopup} closePopup={() => setShowPopup(false)} onAdd={handleAddNewDriverOrCar} />}

        {pendingConflict ? (
          <div className="fixed inset-0 z-[1450] flex items-center justify-center bg-black/70 p-3">
            <div className="w-full max-w-[560px] rounded-lg border border-border bg-surface p-4">
              <h3 className="text-base font-semibold text-text">Resolver conflito</h3>
              <p className="mt-2 text-sm text-muted">
                {pendingConflict.type === 'driver'
                  ? `Motorista selecionado já está na rota ${pendingConflict.targetTrip.id}.`
                  : `Veículo selecionado já está na rota ${pendingConflict.targetTrip.id}.`}
              </p>
              <div className="mt-3 grid gap-2">
                <button type="button" className="rounded-md border border-sky-700/70 bg-sky-950/30 px-3 py-2 text-left text-sm text-sky-200" onClick={resolveConflictSwap}>
                  A) Trocar com outra rota (Swap) - Recomendado
                </button>
                <button type="button" className="rounded-md border border-amber-700/70 bg-amber-950/25 px-3 py-2 text-left text-sm text-amber-200" onClick={resolveConflictSecondRun}>
                  B) Definir como 2ª saída
                </button>
                <button type="button" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-left text-sm text-text" onClick={resolveConflictCancel}>
                  C) Cancelar e escolher outro
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isSwapModalOpen && tripToUpdate ? (
          <div className="fixed inset-0 z-[1460] flex items-center justify-center bg-black/70 p-3">
            <div className="w-full max-w-[720px] rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-semibold text-text">Trocar com rota...</h3>
                <button type="button" className="rounded border border-border bg-surface-2 px-2 py-1 text-sm text-text" onClick={() => setIsSwapModalOpen(false)}>Fechar</button>
              </div>
              <div className="mb-2">
                <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Rota alvo</label>
                <select value={swapTargetTripId} onChange={(event) => setSwapTargetTripId(event.target.value)} className="h-10 w-full rounded-sm border border-accent/35 bg-[rgba(14,33,56,0.9)] px-3 text-sm text-text">
                  <option value="">Selecione a rota para trocar</option>
                  {availableSwapTrips.map((trip) => (
                    <option key={trip.id} value={trip.id}>Rota #{trip.id} | {trip.Driver.name} | {trip.Car.license_plate}</option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="mb-1 block text-xs uppercase tracking-wide text-muted">O que trocar</label>
                <div className="flex flex-wrap gap-2 text-sm text-text">
                  <label className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1">
                    <input type="radio" checked={swapMode === 'driver'} onChange={() => setSwapMode('driver')} /> somente motorista
                  </label>
                  <label className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1">
                    <input type="radio" checked={swapMode === 'vehicle'} onChange={() => setSwapMode('vehicle')} /> somente veículo/placa
                  </label>
                  <label className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1">
                    <input type="radio" checked={swapMode === 'both'} onChange={() => setSwapMode('both')} /> motorista + veículo
                  </label>
                </div>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Motivo (opcional)</label>
                <input value={swapReason} onChange={(event) => setSwapReason(event.target.value)} className="h-10 w-full rounded-sm border border-accent/35 bg-[rgba(14,33,56,0.9)] px-3 text-sm text-text" placeholder="Ex.: ajuste operacional" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded border border-border bg-surface-2 px-3 py-2 text-sm text-text" onClick={() => setIsSwapModalOpen(false)}>Cancelar</button>
                <button
                  type="button"
                  className="rounded border border-white/15 bg-gradient-to-r from-accent to-accent-strong px-4 py-2 text-sm font-semibold text-[#04131e] disabled:opacity-60"
                  disabled={!swapTargetTripId || isSwapping}
                  onClick={() => executeSwap(Number(swapTargetTripId), swapMode, swapReason)}
                >
                  {isSwapping ? 'Trocando...' : 'Confirmar troca'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {detailsTrip ? (
          <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/60 p-3">
            <div className="w-full max-w-[760px] rounded-lg border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-text">Detalhes da Rota #{detailsTrip.run_number || 1}</h3>
                <button type="button" onClick={() => setDetailsTrip(null)} className="rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-text">Fechar</button>
              </div>
              <p className="text-sm text-muted">Motorista: {detailsTrip.Driver.name} | Veículo: {detailsTrip.Car.license_plate} | Data: {detailsTrip.date}</p>
              <ul className="scrollbar-ui mt-3 max-h-[340px] space-y-1 overflow-y-auto pr-1">
                {detailsTrip.TripNotes.slice().sort((a, b) => a.order - b.order).map((note) => (
                  <li key={`${note.invoice_number}-${note.order}`} className="rounded-md border border-border bg-surface-2/70 px-2 py-1.5 text-sm text-text">
                    {note.order}. NF {note.invoice_number} | {note.customer_name} | {note.city}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {editTrip ? (
          <div className="fixed inset-0 z-[1450] flex items-center justify-center bg-black/70 p-3">
            <div className="w-full max-w-[980px] rounded-lg border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-text">Editar rota #{editTrip.run_number || 1} | {editTrip.Driver.name}</h3>
                <button type="button" onClick={() => setEditTrip(null)} className="rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-text">Fechar</button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted">Notas atribuídas</p>
                  <ul className="scrollbar-ui max-h-[320px] space-y-1 overflow-y-auto pr-1">
                    {editNotes.slice().sort((a, b) => a.order - b.order).map((note, index) => (
                      <li key={`${note.invoice_number}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2/70 px-2 py-1.5 text-sm">
                        <span className="min-w-0 truncate text-text">{index + 1}. NF {note.invoice_number} | {note.customer_name}</span>
                        <button type="button" className="rounded border border-rose-700/70 bg-rose-950/30 px-2 py-0.5 text-xs text-rose-200" onClick={() => removeEditNote(note.invoice_number)}>Remover</button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted">Notas disponíveis</p>
                  <input value={editSearch} onChange={(event) => setEditSearch(event.target.value)} placeholder="Filtrar por NF, cliente ou cidade" className="mb-2 h-10 w-full rounded-sm border border-accent/35 bg-[rgba(14,33,56,0.9)] px-3 text-sm text-text" />
                  <ul className="scrollbar-ui max-h-[320px] space-y-1 overflow-y-auto pr-1">
                    {filteredAvailableDanfes.map((danfe) => (
                      <li key={danfe.invoice_number} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2/70 px-2 py-1.5 text-sm">
                        <span className="min-w-0 truncate text-text">NF {danfe.invoice_number} | {danfe.Customer.name_or_legal_entity}</span>
                        <button type="button" className="rounded border border-sky-700/70 bg-sky-950/35 px-2 py-0.5 text-xs text-sky-200" onClick={() => addAvailableDanfeToEdit(danfe)}>Adicionar</button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setEditTrip(null)} className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text">Cancelar</button>
                <button type="button" onClick={saveTripEdition} disabled={isSavingEdit} className="rounded-md border border-white/15 bg-gradient-to-r from-accent to-accent-strong px-4 py-2 text-sm font-semibold text-[#04131e] disabled:opacity-70">
                  {isSavingEdit ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isPrinting ? (
          <div className="fixed bottom-4 right-4 z-[1500] rounded-md border border-border bg-surface px-3 py-2 text-xs text-text shadow-[var(--shadow-2)]">
            Gerando PDF...
          </div>
        ) : null}
      </Container>
    </ContainerRoutePlanning>
  );
}

export default RoutePlanning;
