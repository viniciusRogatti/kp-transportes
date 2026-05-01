export interface ITrip {
  id: number;
  driver_id: number;
  car_id: number;
  created_at: string;
  updated_at: string;
  date: string;
  gross_weight: number;
  run_number?: number;
  Driver: {
    id: number;
    name: string;
  };
  Car: {
    id: number;
    model: string;
    license_plate: string;
  },
  TripNotes: ITripNote[];
}

export interface IUploadResponse {
  message: string;
  successful: number;
  failed: number;
  details: Array<{ success: boolean; message: string }>;
}

export interface ITripNote {
  id?: number;
  invoice_number: string;
  status: string;
  order: number;
  city: string;
  customer_name?: string;
  customer_id?: string | null;
  gross_weight: string;
  created_at?: string | null;
  updated_at?: string | null;
}


export interface IDriver {
  id: string;
  name: string;
}

export interface IInvoiceReturnItem {
  id?: number;
  product_id: string;
  product_description: string;
  product_type?: string | null;
  quantity: number;
  unit_price?: number | string;
  total_price?: number | string;
}

export interface IInvoiceReturn {
  id: number;
  invoice_number: string;
  return_type: 'total' | 'partial' | 'sobra' | 'coleta';
  load_number?: string | null;
  is_inversion?: boolean;
  inversion_invoice_number?: string | null;
  inversion_missing_product_code?: string | null;
  inversion?: {
    invoice_number: string | null;
    missing_product_code: string | null;
  } | null;
  driver_id: number;
  vehicle_plate: string;
  return_date: string;
  batch_code?: string;
  batch_status?: 'open' | 'closed';
  workflow_status?: 'pending_transportadora' | 'awaiting_control_tower' | 'finalized';
  sent_to_control_tower_at?: string | null;
  sent_to_control_tower_by_user_id?: number | null;
  sent_to_control_tower_by_username?: string | null;
  received_by_control_tower_at?: string | null;
  received_by_control_tower_user_id?: number | null;
  received_by_control_tower_username?: string | null;
  Driver?: {
    id: number;
    name: string;
  };
  items: IInvoiceReturnItem[];
}

export interface IReturnBatch {
  batch_code: string;
  batch_status: 'open' | 'closed';
  workflow_status?: 'pending_transportadora' | 'awaiting_control_tower' | 'finalized';
  driver_id: number;
  vehicle_plate: string;
  return_date: string;
  sent_to_control_tower_at?: string | null;
  sent_to_control_tower_by_user_id?: number | null;
  sent_to_control_tower_by_username?: string | null;
  received_by_control_tower_at?: string | null;
  received_by_control_tower_user_id?: number | null;
  received_by_control_tower_username?: string | null;
  Driver?: {
    id: number;
    name: string;
  };
  notes: IInvoiceReturn[];
  aggregated_items: IInvoiceReturnItem[];
}

export interface IOccurrence {
  id: number;
  invoice_number: string;
  customer_name?: string | null;
  city?: string | null;
  load_number?: string | null;
  representative_name?: string | null;
  invoice_total_value?: number | string | null;
  reason?: 'faltou_no_carregamento' | 'faltou_na_carga' | 'produto_avariado' | 'produto_invertido' | 'produto_sem_etiqueta_ou_data' | 'legacy_outros' | null;
  scope?: 'invoice_total' | 'items';
  items?: Array<{
    product_id: string;
    product_description?: string | null;
    product_type?: string | null;
    quantity: number;
    unit_price?: number | string;
    total_price?: number | string;
  }>;
  product_id: string | null;
  product_description: string | null;
  product_type?: string | null;
  quantity: number | null;
  unit_price?: number | string;
  total_price?: number | string;
  description: string;
  status: 'pending' | 'resolved';
  workflow_status?: 'pending_transportadora' | 'awaiting_control_tower' | 'finalized';
  credit_status?: 'not_applicable' | 'pending' | 'completed';
  resolution_type?: 'enviado_posteriormente' | 'talao_mercadoria_faltante' | 'motivo_corrigido' | 'motorista_pagou_cliente' | 'troca_realizada' | 'cliente_aceitou_invertido' | 'legacy_outros' | null;
  resolution_note?: string | null;
  resolved_by_user_id?: number | null;
  resolved_by_username?: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ICar {
  id: string;
  model: string;
  license_plate: string;
}

export interface ICollectionRequest {
  id: number;
  invoice_number: string | null;
  request_code?: string;
  customer_name: string;
  city: string;
  product_id: string | null;
  product_description: string;
  product_type: string | null;
  quantity: number;
  request_scope?: 'invoice_total' | 'items';
  urgency_level?: 'baixa' | 'media' | 'alta' | 'critica';
  workflow_status?: 'solicitada' | 'aceita_agendada' | 'coletada' | 'cancelamento_solicitado' | 'enviada_em_lote' | 'recebida' | 'cancelada';
  quality_status?: 'sem_ocorrencia' | 'em_tratativa' | 'aguardando_torre' | 'resolvida';
  display_status?: 'solicitada' | 'aceita_agendada' | 'coletada' | 'cancelamento_solicitado' | 'enviada_em_lote' | 'recebida' | 'cancelada' | 'em_tratativa';
  scheduled_for?: string | null;
  accepted_at?: string | null;
  accepted_by_user_id?: number | null;
  collected_at?: string | null;
  collected_by_user_id?: number | null;
  sent_in_batch_code?: string | null;
  sent_in_batch_at?: string | null;
  received_at?: string | null;
  quality_note?: string | null;
  related_occurrence_id?: number | null;
  unit_price?: number | string;
  total_price?: number | string;
  requested_by_company: string;
  notes: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  requested_by_user_id: number | null;
  completed_by_user_id: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  requestedByUser?: {
    id: number;
    username: string;
    permission: string;
  };
  completedByUser?: {
    id: number;
    username: string;
    permission: string;
  };
  acceptedByUser?: {
    id: number;
    username: string;
    permission: string;
  };
  collectedByUser?: {
    id: number;
    username: string;
    permission: string;
  };
  quantity_original?: number | null;
  total_collected?: number | null;
  remaining_collectable?: number | null;
  collection_item_history?: Array<{
    collection_request_id: number;
    request_code: string | null;
    quantity: number;
    workflow_status: 'coletada' | 'enviada_em_lote' | 'recebida';
    collected_at: string | null;
    sent_in_batch_at: string | null;
    received_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  }>;
}

export interface ICollectionDashboard {
  metrics: {
    pending_count: number;
    total_requests: number;
    completed_count: number;
  };
  pending: ICollectionRequest[];
  latest_completed: ICollectionRequest[];
  top_clients: Array<{
    customer_name: string;
    requests: number;
  }>;
  top_products: Array<{
    product_description: string;
    requests: number;
    quantity: number;
  }>;
}

export interface IControlTowerReturnItem {
  product_id: string;
  product_description: string;
  product_type: string | null;
  quantity: number;
  unit_price?: number;
  total_price?: number;
}

export interface IControlTowerReturn {
  id: number;
  invoice_number: string;
  return_type: 'total' | 'partial' | 'sobra' | 'coleta';
  load_number?: string | null;
  is_inversion?: boolean;
  inversion_invoice_number?: string | null;
  inversion_missing_product_code?: string | null;
  inversion?: {
    invoice_number: string | null;
    missing_product_code: string | null;
  } | null;
  driver_id: number;
  vehicle_plate: string;
  return_date: string;
  batch_code: string;
  batch_status: 'open' | 'closed';
  workflow_status?: 'pending_transportadora' | 'awaiting_control_tower' | 'finalized';
  sent_to_control_tower_at?: string | null;
  sent_to_control_tower_by_user_id?: number | null;
  sent_to_control_tower_by_username?: string | null;
  received_by_control_tower_at?: string | null;
  received_by_control_tower_user_id?: number | null;
  received_by_control_tower_username?: string | null;
  created_at: string;
  customer_name: string;
  city: string;
  items: IControlTowerReturnItem[];
}

export interface IInvoiceSearchContext {
  occurrence_count: number;
  occurrence_pending_count: number;
  occurrence_resolved_count: number;
  credit_letter_count: number;
  credit_letter_pending_count: number;
  credit_letter_completed_count: number;
  return_count: number;
  return_types: Array<'total' | 'partial' | 'sobra' | 'coleta'>;
  driver_name?: string | null;
  trip_id?: number | null;
  trip_date?: string | null;
  trip_run_number?: number | null;
  latest_occurrence?: {
    id: number;
    description: string;
    status: 'pending' | 'resolved';
    created_at: string;
    resolved_at?: string | null;
  } | null;
}

export interface IReceiptRow {
  id: number;
  nf_id: string | null;
  trip_id: number | null;
  motorista_id: number | null;
  r2_key: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
  checksum_sha256?: string | null;
  status: 'POSTED' | 'PENDING';
  delivered_at?: string | null;
  legibility_blur_score?: number | null;
  date_ok?: boolean;
  sign_ok?: boolean;
  nfe_ok?: boolean;
  brand_ok?: boolean;
  nf_detected?: string | null;
  needs_manual_review?: boolean;
  anchor_score?: number | null;
  anchor_rotation?: number | null;
  created_at: string;
  updated_at?: string | null;
  preview_url?: string;
  metrics?: {
    blurScore: number;
    meanLuminance: number;
    minBlurScore: number;
  };
  driver?: {
    id: number;
    name: string;
  } | null;
  danfe?: {
    invoice_number: string;
    status?: string;
    invoice_date?: string | null;
    customer_name?: string | null;
    city?: string | null;
  } | null;
}

export interface IReceiptsListResponse {
  rows: IReceiptRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface IReceiptUploadResponse {
  receiptId: number;
}

export interface IPendingReceiptRow {
  nf_id: string;
  invoice_number: string;
  customer_id?: string | null;
  status: 'PENDING';
  source_status?: string;
  invoice_date?: string | null;
  load_number?: string | null;
  customer_name?: string | null;
  city?: string | null;
  trip_id?: number | null;
  rota_id?: number | null;
  trip_date?: string | null;
  motorista_id?: number | null;
  motorista_name?: string | null;
  can_upload?: boolean;
}

export interface IPendingReceiptsListResponse {
  rows: IPendingReceiptRow[];
  total: number;
  limit: number;
}

export type ReceiptBacklogQueueType = 'pending' | 'retained' | 'returned' | 'cancelled' | 'unassigned';

export interface IReceiptBacklogRouteHistoryRow {
  trip_id?: number | null;
  trip_note_id?: number | null;
  trip_date?: string | null;
  motorista_id?: number | null;
  motorista_name?: string | null;
  note_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface IReceiptBacklogRow {
  queue_type: ReceiptBacklogQueueType;
  nf_id: string;
  invoice_number: string;
  customer_id?: string | null;
  status: 'POSTED' | 'PENDING';
  source_status?: string | null;
  latest_stop_status?: string | null;
  invoice_date?: string | null;
  load_number?: string | null;
  customer_name?: string | null;
  city?: string | null;
  trip_id?: number | null;
  rota_id?: number | null;
  trip_date?: string | null;
  motorista_id?: number | null;
  motorista_name?: string | null;
  has_receipt?: boolean;
  receipt_id?: number | null;
  receipt_created_at?: string | null;
  route_history?: IReceiptBacklogRouteHistoryRow[];
  age_days?: number;
  can_upload?: boolean;
}

export interface IReceiptBacklogSummary {
  pending: number;
  retained: number;
  returned: number;
  cancelled: number;
  unassigned: number;
  total: number;
}

export interface IReceiptBacklogResponse {
  rows: IReceiptBacklogRow[];
  total: number;
  limit: number;
  cutoff_date: string;
  summary: IReceiptBacklogSummary;
}

export interface IReceiptWhatsappActivityRow {
  id: string;
  event_id: number | null;
  alert_id: number | null;
  kind: 'success' | 'review' | 'error';
  processing_status: 'SUCCESS' | 'REVIEW' | 'ERROR';
  classification?: string | null;
  invoice_number?: string | null;
  backend_action?: string | null;
  backend_mode?: string | null;
  title: string;
  message: string;
  occurred_at: string | number | null;
  group_id?: string | null;
  group_name?: string | null;
  message_id?: string | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  driver?: {
    id: number;
    name: string;
  } | null;
  danfe?: {
    invoice_number: string;
    status?: string | null;
    invoice_date?: string | null;
    customer_name?: string | null;
    city?: string | null;
  } | null;
  receipt?: {
    id: number;
    nf_id: string | null;
    needs_manual_review: boolean;
  } | null;
  metadata?: Record<string, unknown> | null;
}

export interface IReceiptWhatsappActivitySummary {
  total: number;
  success: number;
  review: number;
  error: number;
}

export interface IReceiptWhatsappActivityListResponse {
  rows: IReceiptWhatsappActivityRow[];
  total: number;
  limit: number;
  summary: IReceiptWhatsappActivitySummary;
}

export interface IReceiptSignedUrlResponse {
  id: number;
  signed_url: string;
  expires_in_seconds: number;
}

export interface IAlertRow {
  id: number;
  company_id: number;
  user_id?: number | null;
  receipt_id?: number | null;
  driver_id?: number | null;
  trip_id?: number | null;
  trip_note_id?: number | null;
  nf_number?: string | null;
  dedupe_key?: string | null;
  code: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'RESOLVED';
  metadata?: Record<string, unknown> | null;
  resolved_at?: string | null;
  resolved_by_user_id?: number | null;
  created_at: string;
  updated_at?: string | null;
  receipt?: {
    id: number;
    nf_id: string | null;
    needs_manual_review: boolean;
  } | null;
  created_by_user?: {
    id: number;
    name: string;
    username: string;
  } | null;
  resolved_by_user?: {
    id: number;
    name: string;
    username: string;
  } | null;
}

export interface IAlertsListResponse {
  rows: IAlertRow[];
  total: number;
  limit: number;
}

export interface IDanfeTrip {
  customerName: string;
  nf: string;
  city: string;
  order: number;
  grossWeight: string;
  animationClass?: string;
}

export interface IProduct {
  code: string,
  description: string,
  price: string,
  type: string,
  quantity?: number,
  created_at?: string,
  updated_at?: string
}

export interface IDanfe {
  customer_id: string;
  company_id?: number;
  invoice_number: string;
  status?: string | null;
  replacement_invoice_number?: string | null;
  replacement_reason?: string | null;
  replacement_invoice?: {
    invoice_number: string | null;
    status?: string | null;
    invoice_date?: string | null;
  } | null;
  replaced_invoice_number?: string | null;
  replaced_invoice?: {
    invoice_number: string | null;
    status?: string | null;
    invoice_date?: string | null;
  } | null;
  barcode: string;
  load_number?: string | null;
  representative_name?: string | null;
  invoice_date: string;
  departure_time: string;
  total_quantity: number;
  gross_weight: string;
  net_weight: string;
  total_value: string;
  created_at: string;
  updated_at: string;
  company?: {
    id: number;
    code: string;
    name: string;
  } | null;
  Customer: {
    name_or_legal_entity: string;
    phone: string | null;
    address: string | null;
    address_number?: string | null;
    neighborhood?: string | null;
    city: string;
    state?: string | null;
    zip_code?: string | null;
    cnpj_or_cpf: string;
    representative_name?: string | null;
  };
  DanfeProducts: IDanfeProduct[];
}

export interface IDanfeProduct {
  quantity: number | string;
  price: string;
  total_price: string;
  type: string;
  Product: {
    code: string;
    description: string;
    price: string;
    type: string;
  };
};

interface ICities {
  [key: string]: string;
};

export interface IGroupedProduct {
  quantity: number;
  Product: IProduct;
};

export interface IMapIcon {
  className: string;
  html: string;
  iconSize: [number, number];
};

export interface IMapLocation {
  id: number;
  lat: number;
  lng: number;
}

export interface ICustomer {
  name_or_legal_entity: string;
  phone: string | null;
  address: string | null;
  address_number?: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  neighborhood: string | null;
  representative_name?: string | null;
  cnpj_or_cpf: string;
}
