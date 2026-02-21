import { Property, Room, Reservation, Guest, Invoice, Owner, Manager, Incident, Note } from '../types';
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

      // Invoices are now generated manually via batch, not auto-generated on payment
    }
  },

  deleteReservation: async (id: string) => {
    // Prevent deletion of invoiced reservations
    const all = await mysqlApi.fetchData('reservations');
    const res = all.find((r: Reservation) => String(r.id) === String(id));
    if (res && res.invoiceNumber) {
      throw new Error('No se puede eliminar una reserva que ya tiene factura.');
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
      const toInsert = { ...guest };
      delete toInsert.id;
      await mysqlApi.insertData('guests', toInsert);
    }
  },

  deleteGuest: async (id: string) => {
    const all = await mysqlApi.fetchData('reservations');
    const hasRes = all.some((r: Reservation) => String(r.guestId) === String(id));
    if (hasRes) {
      throw new Error('No se puede eliminar un huésped con reservas. Primero elimina reservas y facturas.');
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
    const raw = localStorage.getItem(KEYS.AUTH_USER);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed.username || raw;
    } catch {
      return raw;
    }
  },

  getAuthUserObj: (): { id: string; username: string; role: string } | null => {
    const raw = localStorage.getItem(KEYS.AUTH_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getAuthRole: (): string => {
    const raw = localStorage.getItem(KEYS.AUTH_USER);
    if (!raw) return 'gestor';
    try {
      const parsed = JSON.parse(raw);
      return parsed.role || 'gestor';
    } catch {
      return 'gestor';
    }
  },

  isAdmin: (): boolean => {
    const raw = localStorage.getItem(KEYS.AUTH_USER);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return parsed.role === 'admin';
    } catch {
      return false;
    }
  },

  setAuthUser: (user: { id: string; username: string; role: string } | string | null) => {
    if (!user) {
      localStorage.removeItem(KEYS.AUTH_USER);
    } else if (typeof user === 'string') {
      localStorage.setItem(KEYS.AUTH_USER, user);
    } else {
      localStorage.setItem(KEYS.AUTH_USER, JSON.stringify(user));
    }
  },

  login: async (username: string, password: string): Promise<{ id: string; username: string; role: string }> => {
    const result = await mysqlApi.login(username, password);
    localStorage.setItem(KEYS.AUTH_USER, JSON.stringify(result));
    return result;
  },

  getInvoices: async (): Promise<any[]> => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const raw = localStorage.getItem(KEYS.AUTH_USER);
        if (raw) { const p = JSON.parse(raw); if (p.username) headers['X-User'] = p.username; }
      } catch (_) {}
      const response = await fetch('/api/invoices/list', { headers });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return [];
    }
  },

  getPendingInvoiceCount: async (filters?: { fromDate?: string; toDate?: string; ownerId?: string }): Promise<number> => {
    try {
      const headers: Record<string, string> = {};
      try {
        const raw = localStorage.getItem(KEYS.AUTH_USER);
        if (raw) { const p = JSON.parse(raw); if (p.username) headers['X-User'] = p.username; }
      } catch (_) {}
      const params = new URLSearchParams();
      if (filters?.fromDate) params.set('fromDate', filters.fromDate);
      if (filters?.toDate) params.set('toDate', filters.toDate);
      if (filters?.ownerId) params.set('ownerId', filters.ownerId);
      const qs = params.toString();
      const response = await fetch(`/api/invoices/pending-count${qs ? '?' + qs : ''}`, { headers });
      if (!response.ok) return 0;
      const data = await response.json();
      return data.count || 0;
    } catch { return 0; }
  },

  generateBatchInvoices: async (filters?: { fromDate?: string; toDate?: string; ownerId?: string }): Promise<{ generated: number; errors: any[] }> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const raw = localStorage.getItem(KEYS.AUTH_USER);
      if (raw) { const p = JSON.parse(raw); if (p.username) headers['X-User'] = p.username; }
    } catch (_) {}
    const body: Record<string, string> = {};
    if (filters?.fromDate) body.fromDate = filters.fromDate;
    if (filters?.toDate) body.toDate = filters.toDate;
    if (filters?.ownerId) body.ownerId = filters.ownerId;
    const response = await fetch('/api/invoices/generate-batch', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Error en generacion masiva');
    }
    return await response.json();
  },

  saveInvoice: async (inv: Invoice) => {},
  deleteInvoice: async (reservationId: string) => {
    const headers: Record<string, string> = {};
    try {
      const raw = localStorage.getItem(KEYS.AUTH_USER);
      if (raw) { const p = JSON.parse(raw); if (p.username) headers['X-User'] = p.username; }
    } catch (_) {}
    const response = await fetch(`/api/invoices/${reservationId}`, {
      method: 'DELETE',
      headers
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
  },

  // NOTES CRUD
  getNotes: async (): Promise<Note[]> => {
    try {
      return await mysqlApi.fetchData('notes');
    } catch (error) {
      return [];
    }
  },

  saveNote: async (note: Note) => {
    if (note.id && !String(note.id).startsWith('temp_')) {
      await mysqlApi.updateData('notes', String(note.id), note);
    } else {
      const toInsert = { ...note };
      delete toInsert.id;
      await mysqlApi.insertData('notes', toInsert);
    }
  },

  deleteNote: async (id: string) => {
    await mysqlApi.deleteData('notes', id);
  }
};
