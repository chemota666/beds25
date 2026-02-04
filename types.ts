
export type PaymentMethod = 'pending' | 'transfer' | 'cash';
export type Sex = 'Masculino' | 'Femenino' | 'Otro';

export interface AuditFields {
  createdBy?: string;
  updatedBy?: string;
}

export interface Guest extends AuditFields {
  id: string;
  name: string;
  surname: string;
  dni: string;
  nationality: string;
  sex: Sex;
  isRegistered: boolean; // Empadronado
  email?: string;
  phone?: string;
  notes?: string;
  dniFile?: string; // base64 string
  contractFile?: string; // base64 string
  depositReceiptFile?: string; // base64 string
  createdAt?: string;
  updatedAt?: string;
}

export interface Property extends AuditFields {
  id: string;
  name: string;
  address: string;
  city: string;
  owner: string;
  numRooms: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Room extends AuditFields {
  id: string;
  propertyId: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Reservation extends AuditFields {
  id: string;
  reservationNumber: number;
  invoiceNumber?: string;
  invoiceDate?: string; // Fecha en que se generó la factura (YYYY-MM-DD)
  propertyId: string;
  roomId: string;
  guestId: string;
  amount: number;
  startDate: string; // ISO format
  endDate: string;   // ISO format
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  reservationId: string;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface Owner {
  id: string;
  name: string;
  dni?: string;
  phone?: string;
  invoiceSeries?: string;
  lastInvoiceNumber?: number;
  createdAt?: string;
  updatedAt?: string;
}
