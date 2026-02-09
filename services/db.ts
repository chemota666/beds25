import { Property, Room, Reservation, Guest, Invoice, Owner, Manager, Incident } from '../types';
import { mysqlApi } from './mysqlApi';
import { logger } from '../utils/logger';
import { STORAGE_KEYS } from '../utils/constants';

const KEYS = STORAGE_KEYS;

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
    // Ensure property is saved, then sync rooms with names "Habitación N"
    let propId: any = prop.id;
    if (prop.id && !String(prop.id).startsWith('temp_')) {
      await mysqlApi.updateData('properties', String(prop.id), prop);
    } else {
      const toInsert = { ...prop };
      delete toInsert.id;
      const res = await mysqlApi.insertData('properties', toInsert);
      propId = res && res.id ? String(res.id) : propId;
    }

    // Sync rooms count and names
    try {
      const allRooms: Room[] = await mysqlApi.fetchData('rooms');
      const propRooms = allRooms.filter(r => String(r.propertyId) === String(propId));
      const existingCount = propRooms.length;
      const target = Number(prop.numRooms) || 0;

      if (target > existingCount) {
        // create missing rooms
        for (let i = existingCount + 1; i <= target; i++) {
          const roomName = `Habitación ${i}`;
          await mysqlApi.insertData('rooms', { propertyId: String(propId), name: roomName });
        }
      } else if (target < existingCount) {
        // remove extra rooms (delete the ones with highest ids)
        const sorted = propRooms.sort((a, b) => Number(a.id) - Number(b.id));
        const toRemove = sorted.slice(target);
        for (const r of toRemove) {
          try { await mysqlApi.deleteData('rooms', String(r.id)); } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('No se pudo sincronizar habitaciones:', err && err.message ? err.message : err);
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
    // Handle insert vs update
    const isPaidNow = res.paymentMethod === 'cash' || res.paymentMethod === 'transfer';
    const normalizeInvoiceFields = (payload: Reservation | Partial<Reservation>) => {
      if (payload.invoiceNumber !== undefined) {
        const trimmed = String(payload.invoiceNumber || '').trim();
        if (!trimmed) {
          delete (payload as any).invoiceNumber;
          delete (payload as any).invoiceDate;
        } else {
          payload.invoiceNumber = trimmed as any;
        }
      }
      if ((payload as any).invoiceDate) {
        const parsed = new Date((payload as any).invoiceDate);
        if (!isNaN(parsed.getTime())) {
          (payload as any).invoiceDate = parsed.toISOString().split('T')[0];
        }
      }
    };

    if (res.id && !String(res.id).startsWith('temp_')) {
      // existing reservation - check previous state
      const all = await mysqlApi.fetchData('reservations');
      const existing = all.find((r: Reservation) => String(r.id) === String(res.id));
      const hadInvoice = existing && existing.invoiceNumber;

      // Preserve invoice data if already issued
      if (hadInvoice) {
        if (!res.invoiceNumber || String(res.invoiceNumber).trim() === '') {
          res.invoiceNumber = existing.invoiceNumber;
        }
        if (existing.invoiceDate && !res.invoiceDate) {
          res.invoiceDate = existing.invoiceDate;
        }
      }

      // If changing from unpaid to paid without invoice -> call server endpoint
      if (isPaidNow && !hadInvoice && !res.invoiceNumber) {
        try {
          const result = await mysqlApi.fetchData(`invoices/generate?reservationId=${res.id}`);
          if (result && (result as any).invoiceNumber) {
            res.invoiceNumber = (result as any).invoiceNumber;
            if ((result as any).invoiceDate) {
              res.invoiceDate = (result as any).invoiceDate;
            }
          }
        } catch (err) {
          console.warn('Error calling /invoices/generate:', err && err.message ? err.message : err);
        }
      }

      // Update reservation
      normalizeInvoiceFields(res);
      await mysqlApi.updateData('reservations', String(res.id), res);
    } else {
      // new reservation - insert first so we have an id
      const toInsert = { ...res };
      delete toInsert.id;
      normalizeInvoiceFields(toInsert);
      const inserted = await mysqlApi.insertData('reservations', toInsert);
      const newId = inserted && inserted.id ? String(inserted.id) : null;

      // If marked as paid at creation and no invoice -> call server endpoint
      if (isPaidNow && !res.invoiceNumber && newId) {
        try {
          const result = await mysqlApi.fetchData(`invoices/generate?reservationId=${newId}`);
          if (result && (result as any).invoiceNumber) {
            await mysqlApi.updateData('reservations', String(newId), { invoiceNumber: (result as any).invoiceNumber, invoiceDate: (result as any).invoiceDate });
          }
        } catch (err) {
          console.warn('Error calling /invoices/generate after insert:', err && err.message ? err.message : err);
        }
      }
    }
  },

  deleteReservation: async (id: string) => {
    // Prevent deletion of invoiced reservations
    try {
      const all = await mysqlApi.fetchData('reservations');
      const res = all.find((r: Reservation) => String(r.id) === String(id));
      if (res && res.invoiceNumber) {
        throw new Error('No se puede eliminar una reserva que ya tiene factura.');
      }
    } catch (err) {
      if (err && err.message && err.message.includes('No se puede eliminar')) throw err;
      // otherwise fallthrough to deletion
    }
    await mysqlApi.deleteData('reservations', id);
  },

  updateReservationFields: async (id: string, fields: Partial<Reservation>) => {
    await mysqlApi.updateData('reservations', String(id), fields);
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
    try {
      const all = await mysqlApi.fetchData('reservations');
      const hasRes = all.some((r: Reservation) => String(r.guestId) === String(id));
      if (hasRes) {
        throw new Error('No se puede eliminar un huésped con reservas. Primero elimina reservas y facturas.');
      }
    } catch (err) {
      if (err && err.message && err.message.includes('No se puede eliminar')) throw err;
    }
    await mysqlApi.deleteData('guests', id);
  },

  checkOverbooking: async (newRes: Reservation): Promise<{ conflict: boolean; conflictingRes?: Reservation }> => {
    const reservations = await db.getReservations();
    const start = new Date(newRes.startDate).getTime();
    const end = new Date(newRes.endDate).getTime();

    const conflict = reservations.find(res => {
      if (res.id === newRes.id) return false;
      if (String(res.roomId) !== String(newRes.roomId)) return false;
      if (res.paymentMethod === 'pending') return false; // Ignorar reservas pendientes
      const resStart = new Date(res.startDate).getTime();
      const resEnd = new Date(res.endDate).getTime();
      return start < resEnd && end > resStart;
    });

    return {
      conflict: !!conflict,
      conflictingRes: conflict
    };
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
  deleteInvoice: async (reservationId: string) => {
    const response = await fetch(`/api/invoices/${reservationId}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'No se pudo eliminar la factura');
    }
    return await response.json().catch(() => ({}));
  },

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
    // If owner has numeric id, update and ensure invoiceSeries is ownerId
    if (owner.id && !isNaN(Number(owner.id))) {
      owner.invoiceSeries = String(owner.id);
      owner.lastInvoiceNumber = owner.lastInvoiceNumber || 0;
      await mysqlApi.updateData('owners', String(owner.id), owner);
    } else {
      // New owner: remove id so server generates numeric id, insert, then set series
      const toInsert = { ...owner };
      delete toInsert.id;
      toInsert.lastInvoiceNumber = toInsert.lastInvoiceNumber || 0;
      const inserted = await mysqlApi.insertData('owners', toInsert);
      const newId = inserted && inserted.id ? String(inserted.id) : null;
      if (newId) {
        const series = String(newId);
        try {
          await mysqlApi.updateData('owners', String(newId), { ...toInsert, invoiceSeries: series, id: newId });
        } catch (err) {
          console.warn('No se pudo actualizar serie de facturación del propietario:', err && err.message ? err.message : err);
        }
      }
    }
  },

  deleteOwner: async (id: string) => {
    await mysqlApi.deleteData('owners', id);
  },

  // INCIDENTS CRUD
  getIncidents: async (): Promise<Incident[]> => {
    try {
      const data = await mysqlApi.fetchData('incidents');
      return (data || []).map((row: any) => {
        let lines: any[] = [];
        if (row.lines) {
          try {
            lines = JSON.parse(row.lines);
          } catch (_) {
            lines = [];
          }
        }
        return {
          ...row,
          solved: Boolean(row.solved),
          refactured: Boolean(row.refactured),
          lines,
          total: Number(row.total) || 0
        } as Incident;
      });
    } catch (error) {
      return [];
    }
  },

  saveIncident: async (incident: Incident) => {
    const payload = {
      ...incident,
      solved: incident.solved ? 1 : 0,
      refactured: incident.refactured ? 1 : 0,
      lines: JSON.stringify(incident.lines || []),
      total: Number(incident.total) || 0
    } as any;

    if (incident.id && !String(incident.id).startsWith('temp_')) {
      await mysqlApi.updateData('incidents', String(incident.id), payload);
    } else {
      if (payload.id) delete payload.id;
      await mysqlApi.insertData('incidents', payload);
    }
  },

  deleteIncident: async (id: string) => {
    await mysqlApi.deleteData('incidents', id);
  },

  // MANAGERS CRUD
  getManagers: async (): Promise<Manager[]> => {
    try {
      const data = await mysqlApi.fetchData('managers');
      localStorage.setItem(KEYS.MANAGERS, JSON.stringify(data));
      return data;
    } catch (error) {
      const local = localStorage.getItem(KEYS.MANAGERS);
      return local ? JSON.parse(local) : [];
    }
  },

  saveManager: async (manager: Manager) => {
    if (manager.id && !String(manager.id).startsWith('temp_')) {
      await mysqlApi.updateData('managers', String(manager.id), manager);
    } else {
      const toInsert = { ...manager };
      delete toInsert.id;
      await mysqlApi.insertData('managers', toInsert);
    }
  },

  deleteManager: async (id: string) => {
    await mysqlApi.deleteData('managers', id);
  }
};
