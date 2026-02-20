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
  gross_weight: string;
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
  workflow_status?: 'solicitada' | 'aceita_agendada' | 'coletada' | 'enviada_em_lote' | 'recebida' | 'cancelada';
  quality_status?: 'sem_ocorrencia' | 'em_tratativa' | 'aguardando_torre' | 'resolvida';
  display_status?: 'solicitada' | 'aceita_agendada' | 'coletada' | 'enviada_em_lote' | 'recebida' | 'cancelada' | 'em_tratativa';
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
  invoice_number: string;
  barcode: string;
  load_number?: string | null;
  invoice_date: string;
  departure_time: string;
  total_quantity: number;
  gross_weight: string;
  net_weight: string;
  total_value: string;
  created_at: string;
  updated_at: string;
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
  cnpj_or_cpf: string;
}
