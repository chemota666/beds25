
import { Property, Room, Reservation, Guest } from '../types';

const KEYS = {
  PROPERTIES: 'roomflow_properties',
  ROOMS: 'roomflow_rooms',
  RESERVATIONS: 'roomflow_reservations',
  GUESTS: 'roomflow_guests',
  LAST_RES_NUMBER: 'roomflow_last_res_number',
  AUTH_USER: 'roomflow_auth_user'
};

const INITIAL_PROPERTIES: Property[] = [
  { id: 'p1', name: 'Edificio Centro', address: 'Gran Vía 12', city: 'Madrid', owner: 'Inmuebles Paco', numRooms: 5 },
  { id: 'p2', name: 'Residencia Sol', address: 'Calle Mayor 5', city: 'Madrid', owner: 'Gestión Inmo', numRooms: 3 }
];

const INITIAL_ROOMS: Room[] = [
  { id: 'r1', propertyId: 'p1', name: 'Habitación 101' },
  { id: 'r2', propertyId: 'p1', name: 'Habitación 102' },
  { id: 'r3', propertyId: 'p1', name: 'Habitación 201' },
  { id: 'r4', propertyId: 'p1', name: 'Habitación 202' },
  { id: 'r5', propertyId: 'p1', name: 'Habitación 301' },
  { id: 'r6', propertyId: 'p2', name: 'Suite A' },
  { id: 'r7', propertyId: 'p2', name: 'Suite B' },
  { id: 'r8', propertyId: 'p2', name: 'Habitación S1' }
];

export const db = {
  getProperties: (): Property[] => {
    const data = localStorage.getItem(KEYS.PROPERTIES);
    if (!data) {
      localStorage.setItem(KEYS.PROPERTIES, JSON.stringify(INITIAL_PROPERTIES));
      return INITIAL_PROPERTIES;
    }
    return JSON.parse(data);
  },
  
  saveProperty: (prop: Property) => {
    const props = db.getProperties();
    const index = props.findIndex(p => p.id === prop.id);
    if (index >= 0) props[index] = prop;
    else props.push(prop);
    localStorage.setItem(KEYS.PROPERTIES, JSON.stringify(props));
  },

  getRooms: (propertyId?: string): Room[] => {
    const data = localStorage.getItem(KEYS.ROOMS);
    let rooms: Room[] = data ? JSON.parse(data) : INITIAL_ROOMS;
    if (!data) localStorage.setItem(KEYS.ROOMS, JSON.stringify(INITIAL_ROOMS));
    return propertyId ? rooms.filter(r => r.propertyId === propertyId) : rooms;
  },

  getGuests: (): Guest[] => {
    const data = localStorage.getItem(KEYS.GUESTS);
    return data ? JSON.parse(data) : [];
  },

  saveGuest: (guest: Guest) => {
    const guests = db.getGuests();
    const index = guests.findIndex(g => g.id === guest.id);
    if (index >= 0) guests[index] = guest;
    else guests.push(guest);
    localStorage.setItem(KEYS.GUESTS, JSON.stringify(guests));
  },

  deleteGuest: (id: string) => {
    const guests = db.getGuests().filter(g => g.id !== id);
    localStorage.setItem(KEYS.GUESTS, JSON.stringify(guests));
  },

  getReservations: (): Reservation[] => {
    const data = localStorage.getItem(KEYS.RESERVATIONS);
    return data ? JSON.parse(data) : [];
  },

  checkOverbooking: (newRes: Reservation): boolean => {
    const reservations = db.getReservations();
    const start = new Date(newRes.startDate).getTime();
    const end = new Date(newRes.endDate).getTime();

    return reservations.some(res => {
      // Don't check against itself when editing
      if (res.id === newRes.id) return false;
      
      // Only check same room
      if (res.roomId !== newRes.roomId) return false;

      const resStart = new Date(res.startDate).getTime();
      const resEnd = new Date(res.endDate).getTime();

      // Standard overlap check: (StartA < EndB) and (EndA > StartB)
      return start < resEnd && end > resStart;
    });
  },

  saveReservation: (res: Reservation) => {
    const reservations = db.getReservations();
    const index = reservations.findIndex(r => r.id === res.id);
    
    if (index >= 0) {
      reservations[index] = res;
    } else {
      let lastNumber = Number(localStorage.getItem(KEYS.LAST_RES_NUMBER) || '1000');
      lastNumber++;
      res.reservationNumber = lastNumber;
      localStorage.setItem(KEYS.LAST_RES_NUMBER, lastNumber.toString());
      reservations.push(res);
    }
    localStorage.setItem(KEYS.RESERVATIONS, JSON.stringify(reservations));
  },

  deleteReservation: (id: string) => {
    const reservations = db.getReservations().filter(r => r.id !== id);
    localStorage.setItem(KEYS.RESERVATIONS, JSON.stringify(reservations));
  },

  deleteProperty: (id: string) => {
    const props = db.getProperties().filter(p => p.id !== id);
    localStorage.setItem(KEYS.PROPERTIES, JSON.stringify(props));
    const rooms = db.getRooms().filter(r => r.propertyId !== id);
    localStorage.setItem(KEYS.ROOMS, JSON.stringify(rooms));
  },

  setAuthUser: (username: string | null) => {
    if (username) localStorage.setItem(KEYS.AUTH_USER, username);
    else localStorage.removeItem(KEYS.AUTH_USER);
  },

  getAuthUser: (): string | null => {
    return localStorage.getItem(KEYS.AUTH_USER);
  }
};
