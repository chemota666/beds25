/**
 * Utilidades de validación con tipado fuerte
 */

import { Guest, Owner, Reservation, Property } from '../types';
import { VALIDATION } from './constants';

export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validators = {
  /**
   * Valida un email
   */
  email: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  /**
   * Valida un teléfono (flexible para varios formatos)
   */
  phone: (value: string): boolean => {
    const phoneRegex = /^[\d\s\-\+\(\)]{7,}$/;
    return phoneRegex.test(value);
  },

  /**
   * Valida un DNI español
   */
  dni: (value: string): boolean => {
    const dniRegex = /^[0-9]{8}[A-Z]$/;
    return dniRegex.test(value);
  },

  /**
   * Valida un IBAN
   */
  iban: (value: string): boolean => {
    const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
    return ibanRegex.test(value);
  },

  /**
   * Valida fechas ISO (YYYY-MM-DD)
   */
  isoDate: (value: string): boolean => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  },

  /**
   * Valida que una fecha sea posterior a otra
   */
  dateAfter: (startDate: string, endDate: string): boolean => {
    return new Date(startDate) < new Date(endDate);
  },

  /**
   * Valida rango de precios
   */
  price: (value: number): boolean => {
    return value > 0 && value < 1000000;
  }
};

export const validateGuest = (guest: Partial<Guest>): string[] => {
  const errors: string[] = [];

  if (!guest.name || guest.name.trim().length === 0) {
    errors.push('El nombre es requerido');
  }

  if (!guest.surname || guest.surname.trim().length === 0) {
    errors.push('El apellido es requerido');
  }

  if (guest.email && !validators.email(guest.email)) {
    errors.push('Email inválido');
  }

  if (guest.phone && !validators.phone(guest.phone)) {
    errors.push('Teléfono inválido');
  }

  if (guest.dni && !validators.dni(guest.dni)) {
    errors.push('DNI inválido');
  }

  return errors;
};

export const validateOwner = (owner: Partial<Owner>): string[] => {
  const errors: string[] = [];

  if (!owner.name || owner.name.trim().length === 0) {
    errors.push('El nombre del propietario es requerido');
  }

  if (owner.phone && !validators.phone(owner.phone)) {
    errors.push('Teléfono del propietario inválido');
  }

  return errors;
};

export const validateReservation = (reservation: Partial<Reservation>): string[] => {
  const errors: string[] = [];

  if (!reservation.roomId) {
    errors.push('Debe seleccionar una habitación');
  }

  if (!reservation.guestId) {
    errors.push('Debe seleccionar un huésped');
  }

  if (!reservation.startDate || !validators.isoDate(reservation.startDate)) {
    errors.push('Fecha de inicio inválida');
  }

  if (!reservation.endDate || !validators.isoDate(reservation.endDate)) {
    errors.push('Fecha de fin inválida');
  }

  if (reservation.startDate && reservation.endDate) {
    if (!validators.dateAfter(reservation.startDate, reservation.endDate)) {
      errors.push('La fecha de fin debe ser posterior a la de inicio');
    }
  }

  if (reservation.price && !validators.price(reservation.price)) {
    errors.push('El precio debe ser entre 0 y 1.000.000');
  }

  return errors;
};

export const validateProperty = (property: Partial<Property>): string[] => {
  const errors: string[] = [];

  if (!property.name || property.name.trim().length === 0) {
    errors.push('El nombre de la propiedad es requerido');
  }

  if (!property.address || property.address.trim().length === 0) {
    errors.push('La dirección es requerida');
  }

  if (!property.city || property.city.trim().length === 0) {
    errors.push('La ciudad es requerida');
  }

  if (!property.numRooms || property.numRooms < 1) {
    errors.push('El número de habitaciones debe ser al menos 1');
  }

  return errors;
};
