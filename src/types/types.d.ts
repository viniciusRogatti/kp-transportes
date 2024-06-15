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
}

export interface IGroupedProduct {
  quantity: number;
  Product: IProduct;
}