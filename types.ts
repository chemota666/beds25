
export type PaymentMethod = 'pending' | 'transfer' | 'cash';
export type Sex = 'Masculino' | 'Femenino' | 'Otro';

export interface AuditFields {
  createdBy?: string;
  updatedBy?: string;
}

export interface Note {
  id: string;
  content: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Guest extends AuditFields {
  id: string;
  name: string;
  surname: string;
  dni: string;
  nationality: string;
  sex: Sex;
  isRegistered: boolean; // Empadronado
  archived?: boolean;
  defaultPropertyId?: string;
  defaultRoomId?: string;
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
  managerId?: string;
  numRooms: number;
  sqm?: number;
  archived?: boolean;
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
  price?: number;
  amount?: number;
  status?: string;
  startDate: string; // ISO format
  endDate: string;   // ISO format
  paymentMethod: PaymentMethod;
  cashDelivered?: boolean;
  paymentReceiptFile?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Invoice {
  id: string;
  number: string;
  reservationId: string;
  createdAt: string;
}

export interface Document {
  id: string;
  userId: string;
  documentType: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export interface User {
  id: string;
  username: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'gestor';
}

export interface Owner {
  id: string;
  name: string;
  dni?: string;
  phone?: string;
  email?: string;
  iban?: string;
  taxId?: string;
  taxAddress?: string;
  commission?: number;
  invoiceSeries: string;
  lastInvoiceNumber: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface IncidentLine {
  description: string;
  amount: number;
}

export interface Incident extends AuditFields {
  id: string;
  propertyId: string;
  title: string;
  solved: boolean;
  refactured: boolean;
  lines: IncidentLine[];
  total: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Manager {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
