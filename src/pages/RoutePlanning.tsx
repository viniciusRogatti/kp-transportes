import { useCallback, useEffect, useMemo, useRef, useState, KeyboardEvent } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import { format, subDays } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import { pdf } from '@react-pdf/renderer';
import { FaArrowDownLong, FaArrowUpLong } from 'react-icons/fa6';
import { CarFront, ChevronDown, ChevronUp, MoreVertical, Pencil, Route, Search, Send, Truck, UserPlus } from 'lucide-react';
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
import IconButton from '../components/ui/IconButton';
import Skeleton from '../components/ui/Skeleton';
import { normalizeCityLabel, normalizeTextValue, sanitizeDanfeTextFields } from '../utils/textNormalization';
import verifyToken from '../utils/verifyToken';
import { formatDateBR } from '../utils/dateDisplay';
import { API_URL } from '../data';
import { ICar, IDanfe, IDriver, ITrip, ITripNote } from '../types/types';

type PlanningTab = 'routing' | 'trips';
type SwapMode = 'driver' | 'vehicle' | 'both';
type RouteLookupDanfe = IDanfe & { status?: string | null };

interface ConflictState {
  type: 'driver' | 'vehicle';
  targetTrip: ITrip;
  nextDriver: string;
  nextCar: string;
}

interface RoutingCityOption {
  city: string;
  danfes: RouteLookupDanfe[];
  noteCount: number;
  totalWeight: number;
}

function toApiDate(date: Date) {
  return format(date, 'dd-MM-yyyy');
}

function toISODate(date: string) {
  const normalized = String(date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const [day, month, year] = normalized.split('-');
  return `${year}-${month}-${day}`;
}

function parseSupportedDateInput(date: string) {
  const normalized = String(date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(normalized)) {
    const [day, month, year] = normalized.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return null;
}

function resolveRoutingInvoiceDateCandidates(date: string) {
  const parsedDate = parseSupportedDateInput(date);
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    const fallback = toISODate(date);
    return fallback ? [fallback] : [];
  }

  const routeDate = format(parsedDate, 'yyyy-MM-dd');
  const operationalInvoiceDate = format(subDays(parsedDate, 1), 'yyyy-MM-dd');
  return Array.from(new Set([operationalInvoiceDate, routeDate]));
}

function isTripActive(trip: ITrip) {
  return (trip.TripNotes || []).some((note) => !['returned', 'cancelled', 'delivered'].includes(String(note.status || '').toLowerCase()));
}

function canAssignDanfe(status: unknown) {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'pending' || normalized === 'redelivery';
}

function isDanfeEligibleForRouting(status: unknown) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return true;
  return !['cancelled', 'delivered', 'returned'].includes(normalized);
}

function normalizeTripNoteStatus(status: unknown) {
  return String(status || '').trim().toLowerCase();
}

function isMutableTripNoteStatus(status: unknown) {
  const normalized = normalizeTripNoteStatus(status);
  return !normalized || normalized === 'pending' || normalized === 'assigned';
}

function resolveTripNotePayloadStatus(status: unknown) {
  const normalized = normalizeTripNoteStatus(status);
  if (!normalized || normalized === 'pending') return 'assigned';
  return normalized;
}

function getTripNoteStatusLabel(status: unknown) {
  const normalized = normalizeTripNoteStatus(status);
  if (!normalized || normalized === 'pending' || normalized === 'assigned') return 'Atribuida';
  if (normalized === 'on_the_way') return 'A caminho';
  if (normalized === 'arrived') return 'No local';
  if (normalized === 'delivered' || normalized === 'completed') return 'Entregue';
  if (normalized === 'returned') return 'Recusada';
  if (normalized === 'cancelled') return 'Cancelada';
  if (normalized === 'redelivery') return 'Redespacho';
  return normalized;
}

function buildTripNotePayload(note: ITripNote, order: number) {
  return {
    invoice_number: note.invoice_number,
    city: note.city,
    customer_name: note.customer_name,
    status: resolveTripNotePayloadStatus(note.status),
    order,
    gross_weight: note.gross_weight,
  };
}

function sanitizeRouteLookupDanfe(danfeData: RouteLookupDanfe): RouteLookupDanfe {
  return sanitizeDanfeTextFields(danfeData as IDanfe) as RouteLookupDanfe;
}

function buildTripNoteFromDanfe(danfeData: RouteLookupDanfe, order: number): ITripNote {
  return {
    customer_name: normalizeTextValue(danfeData.Customer?.name_or_legal_entity) || '-',
    invoice_number: String(danfeData.invoice_number),
    city: normalizeCityLabel(danfeData.Customer?.city) || 'Cidade não informada',
    order,
    gross_weight: String(danfeData.gross_weight || 0),
    status: 'pending',
  };
}

function sortTripNotesByOrder(notes: ITripNote[]) {
  return notes.slice().sort((a, b) => a.order - b.order);
}

function reindexTripNotes(notes: ITripNote[]) {
  return sortTripNotesByOrder(notes).map((note, index) => ({ ...note, order: index + 1 }));
}

function canReorderTripNote(notes: ITripNote[], note: ITripNote, direction: 'up' | 'down') {
  if (!isMutableTripNoteStatus(note.status)) return false;

  const adjacentOrder = direction === 'up' ? note.order - 1 : note.order + 1;
  const adjacentNote = notes.find((item) => item.order === adjacentOrder);
  if (!adjacentNote) return false;

  return isMutableTripNoteStatus(adjacentNote.status);
}

function calculateTripNotesWeight(notes: ITripNote[]) {
  return notes.reduce((sum, note) => sum + Number(note.gross_weight || 0), 0);
}

function RoutePlanning() {
  const [drivers, setDrivers] = useState<IDriver[]>([]);
  const [cars, setCars] = useState<ICar[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('null');
  const [selectedCar, setSelectedCar] = useState<string>('null');
  const [driverInput, setDriverInput] = useState<string>('');
  const [carInput, setCarInput] = useState<string>('');
  const [noteLookup, setNoteLookup] = useState<string>('');
  const [batchNoteLookup, setBatchNoteLookup] = useState<string>('');
  const [isBatchAdding, setIsBatchAdding] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [addedNotes, setAddedNotes] = useState<ITripNote[]>([]);
  const [todayTrips, setTodayTrips] = useState<ITrip[]>([]);
  const [displayedTrips, setDisplayedTrips] = useState<ITrip[]>([]);
  const [tripDateFilter, setTripDateFilter] = useState<Date | null>(new Date());
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [titlePopup, setTitlePopup] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTripsLoading, setIsTripsLoading] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [tripToUpdate, setTripToUpdate] = useState<ITrip | null>(null);
  const [isSecondRunMode, setIsSecondRunMode] = useState<boolean>(false);
  const [assignmentWarning, setAssignmentWarning] = useState<string>('');
  const [detailsTrip, setDetailsTrip] = useState<ITrip | null>(null);
  const [editTrip, setEditTrip] = useState<ITrip | null>(null);
  const [editNotes, setEditNotes] = useState<ITripNote[]>([]);
  const [editSearch, setEditSearch] = useState<string>('');
  const [availableDanfes, setAvailableDanfes] = useState<IDanfe[]>([]);
  const [routingPoolDanfes, setRoutingPoolDanfes] = useState<RouteLookupDanfe[]>([]);
  const [selectedRoutingCity, setSelectedRoutingCity] = useState<string>('');
  const [isRoutingPoolLoading, setIsRoutingPoolLoading] = useState<boolean>(false);
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
  const carInputRef = useRef<HTMLInputElement>(null);
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

  const sortedNotes = useMemo(() => sortTripNotesByOrder(addedNotes), [addedNotes]);
  const countWeight = useMemo(() => calculateTripNotesWeight(sortedNotes), [sortedNotes]);
  const hasLockedNotesInRoutingEdit = useMemo(
    () => isUpdating && sortedNotes.some((note) => !isMutableTripNoteStatus(note.status)),
    [isUpdating, sortedNotes],
  );
  const editHasLockedNotes = useMemo(
    () => editNotes.some((note) => !isMutableTripNoteStatus(note.status)),
    [editNotes],
  );

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

  const availableRoutingCityOptions = useMemo(() => {
    const invoicesAlreadyAdded = new Set(addedNotes.map((note) => String(note.invoice_number)));
    const seenInvoices = new Set<string>();
    const groupedByCity = new Map<string, RoutingCityOption>();

    routingPoolDanfes.forEach((danfe) => {
      const invoiceNumber = String(danfe.invoice_number || '').trim();
      if (!invoiceNumber || invoicesAlreadyAdded.has(invoiceNumber) || seenInvoices.has(invoiceNumber)) return;

      seenInvoices.add(invoiceNumber);

      const city = normalizeCityLabel(danfe.Customer?.city) || 'Cidade não informada';
      const existing = groupedByCity.get(city);
      if (existing) {
        existing.noteCount += 1;
        existing.totalWeight += Number(danfe.gross_weight || 0);
        existing.danfes.push(danfe);
        return;
      }

      groupedByCity.set(city, {
        city,
        danfes: [danfe],
        noteCount: 1,
        totalWeight: Number(danfe.gross_weight || 0),
      });
    });

    return Array.from(groupedByCity.values()).sort((a, b) => a.city.localeCompare(b.city, 'pt-BR', { sensitivity: 'base' }));
  }, [addedNotes, routingPoolDanfes]);

  const availableRoutingCityNoteCount = useMemo(
    () => availableRoutingCityOptions.reduce((sum, option) => sum + option.noteCount, 0),
    [availableRoutingCityOptions],
  );

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

  const fetchDanfesForTripDate = useCallback(async (tripDate: string) => {
    const candidateDates = resolveRoutingInvoiceDateCandidates(tripDate);
    if (!candidateDates.length) return [];

    const responses = await Promise.all(
      candidateDates.map((candidateDate) => (
        axios.get(`${API_URL}/danfes/date/?startDate=${candidateDate}&endDate=${candidateDate}`)
      )),
    );

    const danfesByInvoice = new Map<string, RouteLookupDanfe>();

    responses.forEach((response) => {
      if (!Array.isArray(response.data)) return;
      response.data.forEach((danfe: RouteLookupDanfe) => {
        const sanitized = sanitizeRouteLookupDanfe(danfe);
        const invoiceNumber = String(sanitized.invoice_number || '').trim();
        if (!invoiceNumber || danfesByInvoice.has(invoiceNumber)) return;
        danfesByInvoice.set(invoiceNumber, sanitized);
      });
    });

    return Array.from(danfesByInvoice.values());
  }, []);

  const refreshRoutingPool = useCallback(async (tripDate?: string) => {
    setIsRoutingPoolLoading(true);
    try {
      const targetDate = tripDate || todayApiDate;
      const [danfes, trips] = await Promise.all([
        fetchDanfesForTripDate(targetDate),
        fetchTripsByDate(targetDate),
      ]);

      const assignedInvoiceNumbers = new Set(
        trips.flatMap((trip) => (trip.TripNotes || []).map((note) => String(note.invoice_number || '').trim())).filter(Boolean),
      );

      setRoutingPoolDanfes(
        danfes.filter((danfe) => {
          const invoiceNumber = String(danfe.invoice_number || '').trim();
          if (!invoiceNumber) return false;
          if (assignedInvoiceNumbers.has(invoiceNumber)) return false;
          return isDanfeEligibleForRouting(danfe.status);
        }),
      );
    } catch {
      setRoutingPoolDanfes([]);
    } finally {
      setIsRoutingPoolLoading(false);
    }
  }, [fetchDanfesForTripDate, todayApiDate]);

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
      previousDriverRef.current = 'null';
      previousCarRef.current = 'null';
      setShowAssignmentFields(true);
      return;
    }

    const tripNotes = sortTripNotesByOrder(trip.TripNotes || []);

    setTripToUpdate(trip);
    setIsUpdating(true);
    setAddedNotes(tripNotes);
    setIsSecondRunMode(false);
    setSelectedDriver(String(trip.driver_id));
    setSelectedCar(String(trip.car_id));
    previousDriverRef.current = String(trip.driver_id);
    previousCarRef.current = String(trip.car_id);
    setShowAssignmentFields(false);
  }, []);

  useEffect(() => {
    void refreshRoutingPool(tripToUpdate?.date || todayApiDate);
  }, [refreshRoutingPool, todayApiDate, tripToUpdate?.date]);

  useEffect(() => {
    if (selectedRoutingCity && !availableRoutingCityOptions.some((option) => option.city === selectedRoutingCity)) {
      setSelectedRoutingCity('');
    }
  }, [availableRoutingCityOptions, selectedRoutingCity]);

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

  const fetchDanfeByLookup = async (lookup: string): Promise<RouteLookupDanfe | null> => {
    const normalizedLookup = String(lookup || '').trim();
    if (!normalizedLookup) return null;

    try {
      const byNf = await axios.get<RouteLookupDanfe>(`${API_URL}/danfes/nf/${normalizedLookup}`);
      if (byNf?.data) return sanitizeRouteLookupDanfe(byNf.data);
    } catch {
      // Ignora e tenta buscar por barcode
    }

    const sanitizedBarcode = normalizedLookup.replace(/\s+/g, '');
    const byBarcode = await axios.get<RouteLookupDanfe>(`${API_URL}/danfes/barcode/${sanitizedBarcode}`);
    return byBarcode?.data ? sanitizeRouteLookupDanfe(byBarcode.data) : null;
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

      if (!canAssignDanfe(danfeData.status)) {
        alert('Essa nota não pode ser roteirizada, verifique o status dela.');
        return;
      }

      if (addedNotes.some((note) => String(danfeData.invoice_number) === String(note.invoice_number))) {
        alert('Esta nota já foi adicionada à viagem.');
        return;
      }

      const newNote = buildTripNoteFromDanfe(danfeData, addedNotes.length + 1);

      setAddedNotes((prev) => [...prev, newNote]);
      setLastScannedInvoice(String(newNote.invoice_number));
    } catch {
      alert('Não foi possível buscar essa nota.');
    } finally {
      setNoteLookup('');
      noteLookupRef.current?.focus();
    }
  };

  const handleAddBatchNotes = async () => {
    if (selectedDriver === 'null' || selectedCar === 'null') {
      alert('Selecione um motorista e um veículo antes de adicionar notas em lote.');
      return;
    }

    const lookups = batchNoteLookup
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (!lookups.length) {
      alert('Cole ao menos uma NF ou código de barras (uma por linha).');
      return;
    }

    setIsBatchAdding(true);
    try {
      const existingInvoiceNumbers = new Set(addedNotes.map((note) => String(note.invoice_number)));
      const seenLookups = new Set<string>();
      const notesToAdd: ITripNote[] = [];
      const errors: string[] = [];
      let orderCursor = addedNotes.length + 1;

      for (const lookup of lookups) {
        const lookupKey = lookup.toLowerCase();
        if (seenLookups.has(lookupKey)) {
          errors.push(`${lookup}: duplicado no lote.`);
          continue;
        }
        seenLookups.add(lookupKey);

        try {
          const danfeData = await fetchDanfeByLookup(lookup);
          if (!danfeData) {
            errors.push(`${lookup}: nota não encontrada.`);
            continue;
          }

          const invoiceKey = String(danfeData.invoice_number);
          if (existingInvoiceNumbers.has(invoiceKey)) {
            errors.push(`${lookup}: NF ${invoiceKey} já adicionada na viagem.`);
            continue;
          }

          if (!canAssignDanfe(danfeData.status)) {
            errors.push(`${lookup}: NF ${invoiceKey} com status inválido (${danfeData.status || 'desconhecido'}).`);
            continue;
          }

          const newNote = buildTripNoteFromDanfe(danfeData, orderCursor);
          notesToAdd.push(newNote);
          existingInvoiceNumbers.add(invoiceKey);
          orderCursor += 1;
        } catch {
          errors.push(`${lookup}: erro ao consultar.`);
        }
      }

      if (notesToAdd.length) {
        setAddedNotes((prev) => [...prev, ...notesToAdd]);
        setLastScannedInvoice(String(notesToAdd[notesToAdd.length - 1].invoice_number));
      }

      setBatchNoteLookup('');
      noteLookupRef.current?.focus();

      if (errors.length) {
        const maxLines = 12;
        const visibleErrors = errors.slice(0, maxLines);
        const hiddenCount = errors.length - visibleErrors.length;
        alert(
          `Processamento concluído.\nAdicionadas: ${notesToAdd.length}\nCom erro: ${errors.length}\n\n${visibleErrors.join('\n')}${hiddenCount > 0 ? `\n... e mais ${hiddenCount} erro(s).` : ''}`,
        );
        return;
      }

      alert(`${notesToAdd.length} nota(s) adicionada(s) com sucesso.`);
    } finally {
      setIsBatchAdding(false);
      setIsBatchModalOpen(false);
    }
  };

  const handleAddCityNotes = () => {
    if (selectedDriver === 'null' || selectedCar === 'null') {
      alert('Selecione um motorista e um veículo antes de adicionar notas por cidade.');
      return;
    }

    if (!selectedRoutingCity) {
      alert('Selecione uma cidade para adicionar as notas.');
      return;
    }

    const cityOption = availableRoutingCityOptions.find((option) => option.city === selectedRoutingCity);
    if (!cityOption?.danfes.length) {
      alert('Nenhuma nota pendente encontrada para essa cidade.');
      setSelectedRoutingCity('');
      return;
    }

    const notesToAdd = cityOption.danfes.map((danfe, index) => buildTripNoteFromDanfe(danfe, addedNotes.length + index + 1));

    setAddedNotes((prev) => [...prev, ...notesToAdd]);
    setLastScannedInvoice(String(notesToAdd[notesToAdd.length - 1].invoice_number));
    setSelectedRoutingCity('');
    setNoteLookup('');
    noteLookupRef.current?.focus();
  };

  const removeNoteFromList = async (note: ITripNote) => {
    if (!isMutableTripNoteStatus(note.status)) {
      alert('Notas em andamento ou finalizadas nao podem ser removidas nesta tela.');
      return;
    }

    const nf = String(note.invoice_number);
    const noteId = note.id;

    if (tripToUpdate?.id && noteId) {
      setIsLoading(true);
      try {
        await axios.put(`${API_URL}/trips/remove-note/${tripToUpdate.id}`, { noteId }, authConfig);
        await axios.put(`${API_URL}/danfes/update-status`, {
          danfes: [{ invoice_number: nf, status: 'pending' }],
        });
        setAddedNotes((prev) => reindexTripNotes(prev.filter((note) => String(note.invoice_number) !== String(nf))));
        await refreshRoutingPool(tripToUpdate.date);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setAddedNotes((prev) => reindexTripNotes(prev.filter((note) => String(note.invoice_number) !== String(nf))));
  };

  const moveNoteUp = (order: number) => {
    const updated = [...addedNotes];
    const prevIndex = updated.findIndex((note) => note.order === order - 1);
    const currIndex = updated.findIndex((note) => note.order === order);
    if (prevIndex !== -1 && currIndex !== -1) {
      if (!isMutableTripNoteStatus(updated[currIndex].status) || !isMutableTripNoteStatus(updated[prevIndex].status)) {
        alert('Nao e permitido reordenar notas em andamento ou finalizadas.');
        return;
      }
      [updated[prevIndex].order, updated[currIndex].order] = [updated[currIndex].order, updated[prevIndex].order];
      setAddedNotes(updated);
    }
  };

  const moveNoteDown = (order: number) => {
    const updated = [...addedNotes];
    const nextIndex = updated.findIndex((note) => note.order === order + 1);
    const currIndex = updated.findIndex((note) => note.order === order);
    if (nextIndex !== -1 && currIndex !== -1) {
      if (!isMutableTripNoteStatus(updated[currIndex].status) || !isMutableTripNoteStatus(updated[nextIndex].status)) {
        alert('Nao e permitido reordenar notas em andamento ou finalizadas.');
        return;
      }
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

    if (hasLockedNotesInRoutingEdit) {
      alert('Esta rota possui notas em andamento ou finalizadas. Para evitar perda de historico, a atualizacao por recriacao esta bloqueada.');
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
        tripNotes: sortedNotes.map((note, index) => buildTripNotePayload(note, index + 1)),
      }, authConfig);

      if (isUpdating && tripToUpdate) {
        await axios.delete(`${API_URL}/trips/delete/${tripToUpdate.id}`, authConfig);
      }

      alert(isUpdating ? 'Rota atualizada com sucesso.' : 'Viagem criada com sucesso.');
      setSelectedDriver('null');
      setSelectedCar('null');
      setShowAssignmentFields(true);
      setAddedNotes([]);
      setIsUpdating(false);
      setTripToUpdate(null);
      setIsSecondRunMode(false);
      await Promise.all([
        refreshTrips(todayApiDate),
        refreshRoutingPool(todayApiDate),
      ]);
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
      const danfes = await fetchDanfesForTripDate(tripDate);
      const filtered = danfes.filter((danfe) => ['pending', 'redelivery', 'assigned'].includes(String(danfe.status || '').toLowerCase()));
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
    const targetNote = editNotes.find((note) => String(note.invoice_number) === String(invoice));
    if (targetNote && !isMutableTripNoteStatus(targetNote.status)) {
      alert('Notas em andamento ou finalizadas nao podem ser removidas da rota.');
      return;
    }

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

    if (editHasLockedNotes) {
      alert('Esta rota possui notas em andamento ou finalizadas. Para evitar perda de historico, a edicao por recriacao esta bloqueada.');
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
        tripNotes: editNotes.map((note, index) => buildTripNotePayload(note, index + 1)),
      }, authConfig);

      await axios.delete(`${API_URL}/trips/delete/${editTrip.id}`, authConfig);

      alert('Rota atualizada com sucesso.');
      setEditTrip(null);
      setEditNotes([]);
      const selectedDate = tripDateFilter ? toApiDate(tripDateFilter) : todayApiDate;
      await Promise.all([
        refreshTrips(selectedDate),
        refreshRoutingPool(editTrip.date),
      ]);
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
            <div className="relative inline-flex items-end rounded-t-xl border border-border bg-card px-1 pt-1 shadow-soft">
              <button
                type="button"
                onClick={() => setTab('routing')}
                className={`relative -mb-px rounded-t-[10px] border px-4 py-2 text-sm font-semibold transition ${activeTab === 'routing'
                  ? 'border-border border-b-transparent bg-card text-text shadow-soft'
                  : 'border-transparent bg-surface/70 text-muted hover:bg-surface-2/70 hover:text-text'
                }`}
              >
                Roteirização
              </button>
              <button
                type="button"
                onClick={() => setTab('trips')}
                className={`relative -mb-px rounded-t-[10px] border px-4 py-2 text-sm font-semibold transition ${activeTab === 'trips'
                  ? 'border-border border-b-transparent bg-card text-text shadow-soft'
                  : 'border-transparent bg-surface/70 text-muted hover:bg-surface-2/70 hover:text-text'
                }`}
              >
                Trips
              </button>
            </div>

            {activeTab === 'routing' ? (
              <>
                <div className="hidden items-center gap-1 md:flex">
                  <button type="button" onClick={() => addDriverOrCar('driver')} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs text-text"><UserPlus className="h-4 w-4" />Motorista</button>
                  <button type="button" onClick={() => addDriverOrCar('car')} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs text-text"><CarFront className="h-4 w-4" />Veículo</button>
                  <button type="button" onClick={toggleSecondRun} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-warning/70 bg-gradient-to-r from-warning to-[#ff7a18] px-2.5 text-xs font-semibold text-[#1f1300] hover:brightness-105"><Route className="h-4 w-4" />{isSecondRunMode ? 'Cancelar 2ª' : '2ª saída'}</button>
                  <button type="button" onClick={sendTripsToBackend} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-gradient-to-r from-accent to-accent-strong px-3 text-xs font-semibold text-[#04131e]"><Send className="h-4 w-4" />{isUpdating ? 'Atualizar' : 'Enviar'}</button>
                </div>

                <div className="relative md:hidden">
                  <button type="button" onClick={() => setIsMobileToolbarOpen((prev) => !prev)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-text">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {isMobileToolbarOpen ? (
                    <div className="absolute right-0 top-10 z-20 w-52 rounded-md border border-border bg-surface p-2 shadow-[var(--shadow-3)]">
                      <button type="button" onClick={() => { addDriverOrCar('driver'); setIsMobileToolbarOpen(false); }} className="mb-1 flex h-9 w-full items-center gap-2 rounded-md border border-border bg-card px-2 text-xs text-text"><UserPlus className="h-4 w-4" />Adicionar motorista</button>
                      <button type="button" onClick={() => { addDriverOrCar('car'); setIsMobileToolbarOpen(false); }} className="mb-1 flex h-9 w-full items-center gap-2 rounded-md border border-border bg-card px-2 text-xs text-text"><CarFront className="h-4 w-4" />Adicionar veículo</button>
                      <button type="button" onClick={() => { toggleSecondRun(); setIsMobileToolbarOpen(false); }} className="mb-1 flex h-9 w-full items-center gap-2 rounded-md border border-warning/70 bg-gradient-to-r from-warning to-[#ff7a18] px-2 text-xs font-semibold text-[#1f1300] hover:brightness-105"><Route className="h-4 w-4" />{isSecondRunMode ? 'Cancelar 2ª saída' : 'Segunda saída'}</button>
                      <button type="button" onClick={() => { sendTripsToBackend(); setIsMobileToolbarOpen(false); }} className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-gradient-to-r from-accent to-accent-strong px-2 text-xs font-semibold text-[#04131e]"><Send className="h-4 w-4" />{isUpdating ? 'Atualizar viagem' : 'Enviar viagem'}</button>
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
                                if (!event.shiftKey) {
                                  event.preventDefault();
                                  window.requestAnimationFrame(() => {
                                    carInputRef.current?.focus();
                                  });
                                }
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
                            ref={carInputRef}
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
                                const committed = commitCarInput((event.target as HTMLInputElement).value, true);
                                const hasDriverSelected = selectedDriver !== 'null';
                                const hasCarSelected = selectedCar !== 'null' || committed;
                                if (!event.shiftKey && hasDriverSelected && hasCarSelected) {
                                  event.preventDefault();
                                  window.requestAnimationFrame(() => {
                                    noteLookupRef.current?.focus();
                                  });
                                }
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

              {hasLockedNotesInRoutingEdit ? (
                <div className="mb-2 w-full rounded-md border border-amber-700/65 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
                  Esta rota possui notas em andamento ou finalizadas. Elas aparecem para consulta, mas a atualizacao por recriacao fica bloqueada para preservar o historico operacional.
                </div>
              ) : null}

              <div className="mb-2 grid w-full grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                <BoxSelectDanfe>
                  <input
                    type="text"
                    ref={noteLookupRef}
                    onKeyDown={handleEnterPress}
                    placeholder="Digite NF ou código de barras"
                    value={noteLookup}
                    onChange={(event) => setNoteLookup(event.target.value)}
                    disabled={selectedDriver === 'null' || selectedCar === 'null' || isBatchAdding}
                  />
                </BoxSelectDanfe>
                <ActionButton
                  $tone="secondary"
                  className="w-full border-accent/45 bg-card px-3 py-2 text-sm text-text hover:bg-surface md:w-auto"
                  onClick={handleAddNote}
                  disabled={selectedDriver === 'null' || selectedCar === 'null' || isBatchAdding}
                >
                  Adicionar Nota
                </ActionButton>
                <ActionButton
                  $tone="secondary"
                  className="w-full border-accent/45 bg-card px-3 py-2 text-sm text-text hover:bg-surface md:w-auto"
                  onClick={() => setIsBatchModalOpen(true)}
                  disabled={selectedDriver === 'null' || selectedCar === 'null' || isBatchAdding}
                  >
                  Adicionar lote
                </ActionButton>
              </div>

              <div className="mb-2 grid w-full grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex flex-col gap-1">
                  <select
                    value={selectedRoutingCity}
                    onChange={(event) => setSelectedRoutingCity(event.target.value)}
                    disabled={selectedDriver === 'null' || selectedCar === 'null' || isRoutingPoolLoading || !availableRoutingCityOptions.length}
                    className="h-10 w-full rounded-sm border border-accent/35 bg-card px-3 text-sm text-text outline-none focus:ring-2 focus:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {isRoutingPoolLoading
                        ? 'Carregando cidades...'
                        : availableRoutingCityOptions.length
                          ? 'Selecione uma cidade para adicionar todas as notas'
                          : 'Nenhuma cidade pendente disponível'}
                    </option>
                    {availableRoutingCityOptions.map((option) => (
                      <option key={option.city} value={option.city}>
                        {`${option.city} • ${option.noteCount} nota(s) • ${option.totalWeight.toFixed(2)} Kg`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted">
                    {isRoutingPoolLoading
                      ? 'Atualizando cidades com notas ainda sem motorista...'
                      : `${availableRoutingCityOptions.length} cidade(s) com ${availableRoutingCityNoteCount} nota(s) do dia ainda sem motorista para esta data.`}
                  </p>
                </div>
                <ActionButton
                  $tone="secondary"
                  className="w-full border-accent/45 bg-card px-3 py-2 text-sm text-text hover:bg-surface md:w-auto"
                  onClick={handleAddCityNotes}
                  disabled={selectedDriver === 'null' || selectedCar === 'null' || isRoutingPoolLoading || !selectedRoutingCity}
                >
                  Adicionar cidade
                </ActionButton>
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-surface-2/45">
                <div ref={notesContainerRef} onScroll={handleNotesScroll} className="scrollbar-ui h-full overflow-y-auto p-2">
                  <ul className="space-y-2">
                    {sortedNotes.map((note) => (
                      <li key={`${note.invoice_number}-${note.order}`} className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-2 ${lastScannedInvoice === String(note.invoice_number) ? 'border-emerald-500/70 bg-emerald-950/20' : !isMutableTripNoteStatus(note.status) ? 'border-amber-700/55 bg-amber-950/15' : 'border-border bg-surface-2/70'}`}>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold text-text">
                          {note.order}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-text">NF {note.invoice_number} | {note.customer_name}</p>
                          <p className="truncate text-xs text-muted">{note.city} | {note.gross_weight} Kg | {getTripNoteStatusLabel(note.status)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => moveNoteUp(note.order)} disabled={!canReorderTripNote(sortedNotes, note, 'up')} className="rounded border border-border bg-surface px-2 py-1 text-xs text-text disabled:opacity-45">
                            <FaArrowUpLong />
                          </button>
                          <button type="button" onClick={() => moveNoteDown(note.order)} disabled={!canReorderTripNote(sortedNotes, note, 'down')} className="rounded border border-border bg-surface px-2 py-1 text-xs text-text disabled:opacity-45">
                            <FaArrowDownLong />
                          </button>
                          <button type="button" onClick={() => removeNoteFromList(note)} disabled={!isMutableTripNoteStatus(note.status)} className="rounded border border-rose-700/70 bg-rose-950/30 px-2 py-1 text-xs text-rose-200 disabled:opacity-45">
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
                <span className="inline-flex items-center gap-1 text-muted"><Truck className="h-3.5 w-3.5" /> {sortedNotes.filter((note) => !isMutableTripNoteStatus(note.status)).length} bloqueada(s)</span>
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
                  className="h-10 rounded-sm border border-accent/35 bg-card px-3 text-sm text-text"
                />
                <IconButton
                  icon={Search}
                  label="Buscar rotas por data"
                  onClick={handleTripSearch}
                  size="lg"
                  className="h-10 w-10 min-h-10 min-w-10 rounded-md"
                />
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
                          <p className="text-xs text-muted">{formatDateBR(trip.date)} | saída #{trip.run_number || 1} | {trip.TripNotes.length} notas</p>
                        </div>
                        <span className="rounded-full border border-sky-700/60 bg-sky-950/30 px-2 py-1 text-xs text-sky-200">{isTripActive(trip) ? 'Ativa' : 'Finalizada'}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text" onClick={() => setDetailsTrip(trip)}>Ver detalhes</button>
                        <IconButton
                          icon={Pencil}
                          label="Editar rota"
                          onClick={() => startEditModeFromTrip(trip)}
                          className="rounded-md"
                        />
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

        {showPopup && (
          <Popup
            title={titlePopup}
            closePopup={() => setShowPopup(false)}
            onAdd={handleAddNewDriverOrCar}
            existingDrivers={drivers}
            existingCars={cars}
          />
        )}

        {isBatchModalOpen ? (
          <div className="fixed inset-0 z-[1470] flex items-center justify-center bg-black/70 p-3">
            <div className="w-full max-w-[720px] rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-text">Adicionar notas em lote</h3>
                <button
                  type="button"
                  className="rounded border border-border bg-surface-2 px-2 py-1 text-sm text-text"
                  onClick={() => {
                    if (isBatchAdding) return;
                    setIsBatchModalOpen(false);
                  }}
                >
                  Fechar
                </button>
              </div>

              <textarea
                className="scrollbar-ui min-h-[220px] w-full resize-y rounded-sm border border-accent/35 bg-card p-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/60"
                placeholder="Cole várias NFs/códigos de barras (uma por linha)"
                value={batchNoteLookup}
                onChange={(event) => setBatchNoteLookup(event.target.value)}
                disabled={isBatchAdding}
              />
              <p className="mt-2 text-xs text-muted">
                Digite ou cole uma NF/código por linha. O sistema valida item por item e mostra os erros ao final.
              </p>

              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
                  onClick={() => {
                    if (isBatchAdding) return;
                    setIsBatchModalOpen(false);
                  }}
                  disabled={isBatchAdding}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border bg-gradient-to-r from-accent to-accent-strong px-3 py-2 text-sm font-semibold text-[#04131e] disabled:cursor-not-allowed disabled:opacity-55"
                  onClick={handleAddBatchNotes}
                  disabled={isBatchAdding}
                >
                  {isBatchAdding ? 'Validando lote...' : 'Enviar lote'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

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
                <button type="button" className="rounded-md border border-warning/70 bg-gradient-to-r from-warning to-[#ff7a18] px-3 py-2 text-left text-sm font-semibold text-[#1f1300] hover:brightness-105" onClick={resolveConflictSecondRun}>
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
                <select value={swapTargetTripId} onChange={(event) => setSwapTargetTripId(event.target.value)} className="h-10 w-full rounded-sm border border-accent/35 bg-card px-3 text-sm text-text">
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
                <input value={swapReason} onChange={(event) => setSwapReason(event.target.value)} className="h-10 w-full rounded-sm border border-accent/35 bg-card px-3 text-sm text-text" placeholder="Ex.: ajuste operacional" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded border border-border bg-surface-2 px-3 py-2 text-sm text-text" onClick={() => setIsSwapModalOpen(false)}>Cancelar</button>
                <button
                  type="button"
                  className="rounded border border-border bg-gradient-to-r from-accent to-accent-strong px-4 py-2 text-sm font-semibold text-[#04131e] disabled:opacity-60"
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
              <p className="text-sm text-muted">Motorista: {detailsTrip.Driver.name} | Veículo: {detailsTrip.Car.license_plate} | Data: {formatDateBR(detailsTrip.date)}</p>
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

              {editHasLockedNotes ? (
                <div className="mb-3 rounded-md border border-amber-700/65 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
                  Esta rota possui notas em andamento ou finalizadas. O salvamento fica bloqueado nesta tela para preservar o historico operacional.
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted">Notas atribuídas</p>
                  <ul className="scrollbar-ui max-h-[320px] space-y-1 overflow-y-auto pr-1">
                    {editNotes.slice().sort((a, b) => a.order - b.order).map((note, index) => (
                      <li key={`${note.invoice_number}-${index}`} className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm ${isMutableTripNoteStatus(note.status) ? 'border-border bg-surface-2/70' : 'border-amber-700/55 bg-amber-950/15'}`}>
                        <span className="min-w-0 truncate text-text">{index + 1}. NF {note.invoice_number} | {note.customer_name} | {getTripNoteStatusLabel(note.status)}</span>
                        <button type="button" className="rounded border border-rose-700/70 bg-rose-950/30 px-2 py-0.5 text-xs text-rose-200 disabled:opacity-45" disabled={!isMutableTripNoteStatus(note.status)} onClick={() => removeEditNote(note.invoice_number)}>Remover</button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted">Notas disponíveis</p>
                  <input value={editSearch} onChange={(event) => setEditSearch(event.target.value)} placeholder="Filtrar por NF, cliente ou cidade" className="mb-2 h-10 w-full rounded-sm border border-accent/35 bg-card px-3 text-sm text-text" />
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
                <button type="button" onClick={saveTripEdition} disabled={isSavingEdit || editHasLockedNotes} className="rounded-md border border-border bg-gradient-to-r from-accent to-accent-strong px-4 py-2 text-sm font-semibold text-[#04131e] disabled:opacity-70">
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
