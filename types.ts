
export type PaymentMethod = 'pending' | 'transfer' | 'cash';
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'checked-out';
export type Sex = 'Masculino' | 'Femenino' | 'Otro';

export interface Guest {
  id: string;
  name: string;
  surname: string;
  dni: string;
  nationality: string;
  sex: Sex;
  isRegistered: boolean; // Empadronado
  email?: string;
  phone?: string;
  dniFile?: string; // base64 string
  contractFile?: string; // base64 string
  depositReceiptFile?: string; // base64 string
}

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  owner: string;
  numRooms: number;
}

export interface Room {
  id: string;
  propertyId: string;
  name: string;
}

export interface Reservation {
  id: string;
  reservationNumber: number;
  propertyId: string;
  roomId: string;
  guestId: string;
  amount: number;
  startDate: string; // ISO format
  endDate: string;   // ISO format
  paymentMethod: PaymentMethod;
  status: ReservationStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  username: string;
}
