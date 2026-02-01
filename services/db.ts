
import { Property, Room, Reservation, Guest } from '../types';
import { sheetsApi } from './sheetsApi';

const KEYS = {
  PROPERTIES: 'roomflow_properties',
  ROOMS: 'roomflow_rooms',
  RESERVATIONS: 'roomflow_reservations',
  GUESTS: 'roomflow_guests',
  LAST_RES_NUMBER: 'roomflow_last_res_number',
  AUTH_USER: 'roomflow_auth_user'
};

export const db = {
  getProperties: async (): Promise<Property[]> => {
    const data = await sheetsApi.fetchSheet('properties');
    if (data.length === 0) {
      // Si el sheet está vacío, intentamos cargar de local o usar iniciales
      const local = localStorage.getItem(KEYS.PROPERTIES);
      return local ? JSON.parse(local) : [];
    }
    return data;
  },
  
  saveProperty: async (prop: Property) => {
    // Primero en local para feedback instantáneo
    const props = await db.getProperties();
    const index = props.findIndex(p => p.id === prop.id);
    const action = index >= 0 ? 'update' : 'append';
    if (index >= 0) props[index] = prop; else props.push(prop);
    localStorage.setItem(KEYS.PROPERTIES, JSON.stringify(props));
    
    // Luego al Sheet
    await sheetsApi.postAction('properties', action, prop, prop.id);
  },

  getRooms: async (propertyId?: string): Promise<Room[]> => {
    const data = await sheetsApi.fetchSheet('rooms');
    let rooms: Room[] = data;
    if (data.length === 0) {
      const local = localStorage.getItem(KEYS.ROOMS);
      rooms = local ? JSON.parse(local) : [];
    }
    return propertyId ? rooms.filter(r => r.propertyId === propertyId) : rooms;
  },

  getGuests: async (): Promise<Guest[]> => {
    const data = await sheetsApi.fetchSheet('guests');
    if (data.length === 0) {
      const local = localStorage.getItem(KEYS.GUESTS);
      return local ? JSON.parse(local) : [];
    }
    return data;
  },

  saveGuest: async (guest: Guest) => {
    const guests = await db.getGuests();
    const index = guests.findIndex(g => g.id === guest.id);
    const action = index >= 0 ? 'update' : 'append';
    if (index >= 0) guests[index] = guest; else guests.push(guest);
    localStorage.setItem(KEYS.GUESTS, JSON.stringify(guests));
    
    await sheetsApi.postAction('guests', action, guest, guest.id);
  },

  deleteGuest: async (id: string) => {
    const guests = (await db.getGuests()).filter(g => g.id !== id);
    localStorage.setItem(KEYS.GUESTS, JSON.stringify(guests));
    await sheetsApi.postAction('guests', 'delete', {}, id);
  },

  getReservations: async (): Promise<Reservation[]> => {
    const data = await sheetsApi.fetchSheet('reservations');
    if (data.length === 0) {
      const local = localStorage.getItem(KEYS.RESERVATIONS);
      return local ? JSON.parse(local) : [];
    }
    return data;
  },

  checkOverbooking: async (newRes: Reservation): Promise<boolean> => {
    const reservations = await db.getReservations();
    const start = new Date(newRes.startDate).getTime();
    const end = new Date(newRes.endDate).getTime();

    return reservations.some(res => {
      if (res.id === newRes.id) return false;
      if (res.roomId !== newRes.roomId) return false;
      if (res.status === 'cancelled') return false;

      const resStart = new Date(res.startDate).getTime();
      const resEnd = new Date(res.endDate).getTime();
      return start < resEnd && end > resStart;
    });
  },

  saveReservation: async (res: Reservation) => {
    const reservations = await db.getReservations();
    const index = reservations.findIndex(r => r.id === res.id);
    const action = index >= 0 ? 'update' : 'append';
    
    if (index >= 0) {
      reservations[index] = res;
    } else {
      let lastNumber = Number(localStorage.getItem(KEYS.LAST_RES_NUMBER) || '1002');
      lastNumber++;
      res.reservationNumber = lastNumber;
      localStorage.setItem(KEYS.LAST_RES_NUMBER, lastNumber.toString());
      reservations.push(res);
    }
    localStorage.setItem(KEYS.RESERVATIONS, JSON.stringify(reservations));
    await sheetsApi.postAction('reservations', action, res, res.id);
  },

  deleteReservation: async (id: string) => {
    const reservations = (await db.getReservations()).filter(r => r.id !== id);
    localStorage.setItem(KEYS.RESERVATIONS, JSON.stringify(reservations));
    await sheetsApi.postAction('reservations', 'delete', {}, id);
  },

  deleteProperty: async (id: string) => {
    const props = (await db.getProperties()).filter(p => p.id !== id);
    localStorage.setItem(KEYS.PROPERTIES, JSON.stringify(props));
    await sheetsApi.postAction('properties', 'delete', {}, id);
    // Nota: Las habitaciones y reservas asociadas deberían borrarse también en una implementación completa
  },

  setAuthUser: (username: string | null) => {
    if (username) localStorage.setItem(KEYS.AUTH_USER, username);
    else localStorage.removeItem(KEYS.AUTH_USER);
  },

  getAuthUser: (): string | null => {
    return localStorage.getItem(KEYS.AUTH_USER);
  }
};
