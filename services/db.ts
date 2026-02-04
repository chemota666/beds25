import { Property, Room, Reservation, Guest, Invoice } from '../types';
import { mysqlApi } from './mysqlApi';

const KEYS = {
  PROPERTIES: 'properties',
  ROOMS: 'rooms',
  RESERVATIONS: 'reservations',
  GUESTS: 'guests',
  LAST_RES_NUMBER: 'roomflow_last_res_number',
  LAST_INV_NUMBER: 'roomflow_last_inv_number',
  AUTH_USER: 'roomflow_auth_user'
};

export const db = {
  getProperties: async (): Promise<Property[]> => {
    try {
      const data = await mysqlApi.fetchData('properties');
      localStorage.setItem(KEYS.PROPERTIES, JSON.stringify(data));
      return data;
    } catch (error) {
      const local = localStorage.getItem(KEYS.PROPERTIES);
      return local ? JSON.parse(local) : [];
    }
  },

  saveProperty: async (prop: Property) => {
    if (prop.id && !String(prop.id).startsWith('temp_')) {
      await mysqlApi.updateData('properties', String(prop.id), prop);
    } else {
      delete prop.id;
      await mysqlApi.insertData('properties', prop);
    }
  },

  deleteProperty: async (id: string) => {
    await mysqlApi.deleteData('properties', id);
  },

  getRooms: async (propertyId?: string): Promise<Room[]> => {
    try {
      const data = await mysqlApi.fetchData('rooms');
      localStorage.setItem(KEYS.ROOMS, JSON.stringify(data));
      if (propertyId) {
        return data.filter((r: Room) => String(r.propertyId) === String(propertyId));
      }
      return data;
    } catch (error) {
      const local = localStorage.getItem(KEYS.ROOMS);
      const rooms = local ? JSON.parse(local) : [];
      if (propertyId) {
        return rooms.filter((r: Room) => String(r.propertyId) === String(propertyId));
      }
      return rooms;
    }
  },

  getReservations: async (): Promise<Reservation[]> => {
    try {
      const data = await mysqlApi.fetchData('reservations');
      localStorage.setItem(KEYS.RESERVATIONS, JSON.stringify(data));
      return data;
    } catch (error) {
      const local = localStorage.getItem(KEYS.RESERVATIONS);
      return local ? JSON.parse(local) : [];
    }
  },

  saveReservation: async (res: Reservation) => {
    if (res.id && !String(res.id).startsWith('temp_')) {
      await mysqlApi.updateData('reservations', String(res.id), res);
    } else {
      delete res.id;
      await mysqlApi.insertData('reservations', res);
    }
  },

  deleteReservation: async (id: string) => {
    await mysqlApi.deleteData('reservations', id);
  },

  getGuests: async (): Promise<Guest[]> => {
    try {
      const data = await mysqlApi.fetchData('guests');
      localStorage.setItem(KEYS.GUESTS, JSON.stringify(data));
      return data;
    } catch (error) {
      const local = localStorage.getItem(KEYS.GUESTS);
      return local ? JSON.parse(local) : [];
    }
  },

  saveGuest: async (guest: Guest) => {
    if (guest.id && !String(guest.id).startsWith('temp_')) {
      await mysqlApi.updateData('guests', String(guest.id), guest);
    } else {
      await mysqlApi.insertData('guests', guest);
    }
  },

  deleteGuest: async (id: string) => {
    await mysqlApi.deleteData('guests', id);
  },

  checkOverbooking: async (newRes: Reservation): Promise<boolean> => {
    const reservations = await db.getReservations();
    const start = new Date(newRes.startDate).getTime();
    const end = new Date(newRes.endDate).getTime();

    return reservations.some(res => {
      if (res.id === newRes.id) return false;
      if (res.roomId !== newRes.roomId) return false;
      const resStart = new Date(res.startDate).getTime();
      const resEnd = new Date(res.endDate).getTime();
      return start < resEnd && end > resStart;
    });
  },

  getAuthUser: (): string | null => {
    return localStorage.getItem(KEYS.AUTH_USER);
  },

  setAuthUser: (username: string | null) => {
    if (username) localStorage.setItem(KEYS.AUTH_USER, username);
    else localStorage.removeItem(KEYS.AUTH_USER);
  },

  getInvoices: async (): Promise<Invoice[]> => [],
  saveInvoice: async (inv: Invoice) => {},
  deleteInvoice: async (id: string) => {},

  // OWNERS CRUD
  getOwners: async (): Promise<Owner[]> => {
    try {
      const data = await mysqlApi.fetchData('owners');
      return data;
    } catch (error) {
      return [];
    }
  },

  saveOwner: async (owner: Owner) => {
    // Si tiene ID numerico, es una actualizacion
    if (owner.id && !isNaN(Number(owner.id))) {
      await mysqlApi.updateData('owners', String(owner.id), owner);
    } else {
      // Es nuevo, generar serie de facturacion si no tiene
      if (!owner.invoiceSeries) {
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        owner.invoiceSeries = 'F' + randomSuffix;
      }
      // Quitar el id para que MySQL lo genere
      delete owner.id;
      await mysqlApi.insertData('owners', owner);
    }
  },

  deleteOwner: async (id: string) => {
    await mysqlApi.deleteData('owners', id);
  }
};
