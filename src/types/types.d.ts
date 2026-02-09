export interface ITrip {
  id: number;
  driver_id: number;
  car_id: number;
  created_at: string;
  updated_at: string;
  date: string;
  gross_weight: number;
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
  quantity: number;
}

export interface IInvoiceReturn {
  id: number;
  invoice_number: string;
  return_type: 'total' | 'partial';
  driver_id: number;
  vehicle_plate: string;
  return_date: string;
  batch_code?: string;
  batch_status?: 'open' | 'closed';
  Driver?: {
    id: number;
    name: string;
  };
  items: IInvoiceReturnItem[];
}

export interface IReturnBatch {
  batch_code: string;
  batch_status: 'open' | 'closed';
  driver_id: number;
  vehicle_plate: string;
  return_date: string;
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
  product_id: string | null;
  product_description: string | null;
  quantity: number | null;
  description: string;
  status: 'pending' | 'resolved';
  reported_by_driver_id: number | null;
  resolved_at: string | null;
  created_at: string;
  reportedByDriver?: {
    id: number;
    name: string;
  };
}

export interface ICar {
  id: string;
  model: string;
  license_plate: string;
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
    address: string;
    city: string;
    cnpj_or_cpf: string;
  };
  DanfeProducts: IDanfeProduct[];
}

export interface IDanfeProduct {
  quantity: number;
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
  city: string | null;
  state: string | null;
  zip_code: string | null;
  neighborhood: string | null;
  cnpj_or_cpf: string;
}
