
import React, { useState, useEffect, useMemo } from 'react';
import { Room, Reservation, Guest, Property, PaymentMethod } from '../types';
import { db } from '../services/db';

interface ReservationModalProps {
  rooms: Room[];
  propertyId: string;
  initialReservation?: Reservation | null;
  initialData?: { roomId: string, date: string } | null;
  onClose: () => void;
  onSave: (res: Reservation) => void;
  onDelete: (id: string) => void;
  onReservationUpdated?: (res: Reservation) => void;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({ rooms: initialRooms, propertyId: initialPropId, initialReservation, initialData, onClose, onSave, onDelete, onReservationUpdated }) => {
  const safeRooms = useMemo(() => (Array.isArray(initialRooms) ? initialRooms : []), [initialRooms]);
  const safePropId = initialPropId ?? '';
  const [modalRooms, setModalRooms] = useState<Room[]>(safeRooms);
  const [allGuests, setAllGuests] = useState<Guest[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [overbookingError, setOverbookingError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', surname: '', dni: '' });
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const normalizeAmount = (value?: number | string) => {
    if (value === undefined || value === null || value === '') return 0;
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const formatLocalISODate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState<Partial<Reservation>>(
    initialReservation ? { 
      ...initialReservation,
      amount: normalizeAmount(initialReservation.price ?? initialReservation.amount),
      price: normalizeAmount(initialReservation.price ?? initialReservation.amount),
      startDate: initialReservation.startDate?.split("T")[0],
      endDate: initialReservation.endDate?.split("T")[0]
    } : {
      id: 'temp_' + Math.random().toString(36).substr(2, 9),
      propertyId: safePropId === 'all' ? (safeRooms.length > 0 ? safeRooms[0].propertyId : '') : safePropId,
      roomId: initialData?.roomId || (safeRooms.length > 0 ? safeRooms[0].id : ''),
      guestId: '',
      amount: 0,
      price: 0,
      startDate: initialData?.date || new Date().toISOString().split('T')[0],
      endDate: initialData?.date || new Date().toISOString().split('T')[0],
      paymentMethod: 'pending',
      cashDelivered: false,
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );

  useEffect(() => {
    const loadStatic = async () => {
      const [guests, props] = await Promise.all([db.getGuests(), db.getProperties()]);
      setAllGuests(guests);
      setAllProperties(props);
    };
    loadStatic();
  }, []);

  useEffect(() => {
    setModalRooms(safeRooms);
  }, [safeRooms]);

  // Sincronizar formData cuando cambia initialReservation
  useEffect(() => {
    if (initialReservation) {
      const normalized = normalizeAmount(initialReservation.price ?? initialReservation.amount);
      setFormData({
        ...initialReservation,
        amount: normalized,
        price: normalized,
        startDate: initialReservation.startDate?.split("T")[0],
        endDate: initialReservation.endDate?.split("T")[0]
      });
    } else {
      setFormData({
        id: 'temp_' + Math.random().toString(36).substr(2, 9),
        propertyId: safePropId === 'all' ? (safeRooms.length > 0 ? safeRooms[0].propertyId : '') : safePropId,
        roomId: initialData?.roomId || (safeRooms.length > 0 ? safeRooms[0].id : ''),
        guestId: '',
        amount: 0,
        price: 0,
        startDate: initialData?.date || new Date().toISOString().split('T')[0],
        endDate: initialData?.date || new Date().toISOString().split('T')[0],
        paymentMethod: 'pending',
        cashDelivered: false,
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    setSearchTerm('');
    setOverbookingError('');
  }, [initialReservation, safeRooms, safePropId, initialData]);

  useEffect(() => {
    const loadRoomsForProperty = async () => {
      if (!formData.propertyId) {
        setModalRooms(safeRooms);
        return;
      }
      try {
        const propRooms = await db.getRooms(String(formData.propertyId));
        setModalRooms(propRooms);
      } catch {
        setModalRooms(safeRooms);
      }
    };
    loadRoomsForProperty();
  }, [formData.propertyId, safeRooms]);

  const availableRooms = useMemo(() => {
    return modalRooms.filter(r => r.propertyId === formData.propertyId);
  }, [formData.propertyId, modalRooms]);

  useEffect(() => {
    if (!availableRooms.length) return;
    if (formData.roomId && availableRooms.some(r => String(r.id) === String(formData.roomId))) return;
    setFormData(prev => ({ ...prev, roomId: availableRooms[0].id }));
  }, [availableRooms, formData.roomId]);

  const selectedGuest = useMemo(() => 
    allGuests.find(g => g.id === formData.guestId), 
    [allGuests, formData.guestId]
  );

  const filteredGuests = useMemo(() => {
    if (!searchTerm) return [];
    const lower = searchTerm.toLowerCase();
    return allGuests.filter(g => 
      g.name.toLowerCase().includes(lower) || 
      g.surname.toLowerCase().includes(lower) ||
      g.dni.toLowerCase().includes(lower)
    ).slice(0, 5);
  }, [allGuests, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOverbookingError('');
    
    if (!formData.guestId) {
      alert('Por favor, selecciona un huésped.');
      return;
    }

    const normalizedAmount = normalizeAmount(formData.amount ?? formData.price);
    const resToSave = {
      ...formData as Reservation,
      amount: normalizedAmount,
      price: normalizedAmount,
      updatedAt: new Date().toISOString()
    };

    try {
      setLoading(true);
      const overbookResult = await db.checkOverbooking(resToSave);
      if (overbookResult.conflict && overbookResult.conflictingRes) {
        const conflicting = overbookResult.conflictingRes;
        const guest = allGuests.find(g => String(g.id) === String(conflicting.guestId));
        const guestName = guest ? `${guest.name} ${guest.surname}`.trim() : 'Desconocido';
        setOverbookingError(`⚠️ CONFLICTO DE FECHAS\nLa habitación ya está ocupada\nReserva: ${guestName} (${new Date(conflicting.startDate).toLocaleDateString('es-ES')} - ${new Date(conflicting.endDate).toLocaleDateString('es-ES')})`);
        setLoading(false);
        return;
      }
      onSave(resToSave);
    } catch (error: any) {
      alert('❌ Error al guardar la reserva: ' + (error?.message || 'Error desconocido'));
      setLoading(false);
    }
  };

  const handleCopyToNextMonth = async () => {
    const currentStart = new Date(formData.startDate || '');
    const currentEnd = new Date(formData.endDate || '');

    if (isNaN(currentStart.getTime()) || isNaN(currentEnd.getTime())) {
      alert('Fechas inválidas para copiar.');
      return;
    }

    const nextMonthBase = new Date(currentStart);
    nextMonthBase.setDate(1);
    nextMonthBase.setMonth(nextMonthBase.getMonth() + 1);
    const nextStart = new Date(nextMonthBase.getFullYear(), nextMonthBase.getMonth(), 1);
    const nextEnd = new Date(nextMonthBase.getFullYear(), nextMonthBase.getMonth() + 1, 0);

    const normalizedAmount = normalizeAmount(formData.amount ?? formData.price);
    const newRes: Reservation = {
      ...formData as Reservation,
      amount: normalizedAmount,
      price: normalizedAmount,
      id: 'temp_' + Math.random().toString(36).substr(2, 9),
      startDate: formatLocalISODate(nextStart),
      endDate: formatLocalISODate(nextEnd),
      paymentMethod: 'pending',
      cashDelivered: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      invoiceNumber: undefined, // Clear invoice for copies
      invoiceDate: undefined,
    };

    const overbookResult = await db.checkOverbooking(newRes);
    if (overbookResult.conflict) {
       alert('No se pudo copiar: Overbooking detectado en el mes siguiente.');
       return;
    }

    onSave(newRes);
    alert('Copia creada para el mes siguiente.');
  };

  const handleCreateGuest = async () => {
    if (!newGuest.name.trim() || !newGuest.surname.trim() || !newGuest.dni.trim()) {
      alert('Completa nombre, apellidos y DNI.');
      return;
    }

    try {
      setLoading(true);
      const guestToSave: Guest = {
        id: 'temp_' + Date.now(),
        name: newGuest.name.trim(),
        surname: newGuest.surname.trim(),
        dni: newGuest.dni.trim(),
        nationality: 'Española',
        sex: 'Masculino',
        isRegistered: false
      };
      await db.saveGuest(guestToSave);
      const updatedGuests = await db.getGuests();
      setAllGuests(updatedGuests);
      const created = updatedGuests.find(g => g.dni === guestToSave.dni) || updatedGuests[updatedGuests.length - 1];
      if (created) {
        setFormData({ ...formData, guestId: created.id });
      }
      setIsCreatingGuest(false);
      setNewGuest({ name: '', surname: '', dni: '' });
      setSearchTerm('');
      setIsSearching(false);
    } catch (error: any) {
      alert('❌ Error al crear huésped: ' + (error?.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const canUploadReceipt = formData.id && !String(formData.id).startsWith('temp_');

  const extractReceiptFilename = (value: string) => {
    if (!value) return null;
    try {
      const pathValue = value.startsWith('http') ? new URL(value).pathname : value;
      const parts = pathValue.split('/').filter(Boolean);
      return parts[parts.length - 1] || null;
    } catch {
      const parts = value.split('/').filter(Boolean);
      return parts[parts.length - 1] || null;
    }
  };

  const getReceiptUrl = (value?: string) => {
    if (!value) return '';
    if (value.startsWith('/uploads/')) return `/api${value}`;
    return value;
  };

  const uploadPaymentReceipt = async (file: File) => {
    if (!canUploadReceipt) {
      alert('Guarda la reserva antes de subir el justificante.');
      return;
    }

    try {
      setReceiptUploading(true);
      setReceiptError(null);
      const form = new FormData();
      form.append('file', file);
      const response = await fetch(`/api/upload/reservation/${formData.id}`, {
        method: 'POST',
        body: form
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al subir el justificante');
      }
      const result = await response.json();
      const filePath = result?.file?.path || result?.path || result?.url;
      const updatedRes = { ...(formData as Reservation), paymentReceiptFile: filePath || '' };
      await db.saveReservation(updatedRes);
      setFormData(updatedRes);
      onReservationUpdated?.(updatedRes);
    } catch (error: any) {
      setReceiptError(error?.message || 'Error al subir el justificante');
    } finally {
      setReceiptUploading(false);
    }
  };

  const deletePaymentReceipt = async () => {
    if (!canUploadReceipt || !formData.paymentReceiptFile) return;
    const filename = extractReceiptFilename(formData.paymentReceiptFile);
    if (!filename) {
      setReceiptError('No se pudo determinar el archivo a borrar');
      return;
    }
    if (!confirm('¿Eliminar el justificante de cobro?')) return;

    try {
      setReceiptUploading(true);
      setReceiptError(null);
      const response = await fetch(`/api/files/reservation/${formData.id}/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (!response.ok && response.status !== 404) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo eliminar el justificante');
      }
      const updatedRes = { ...(formData as Reservation), paymentReceiptFile: '' };
      await db.saveReservation(updatedRes);
      setFormData(updatedRes);
      onReservationUpdated?.(updatedRes);
    } catch (error: any) {
      setReceiptError(error?.message || 'Error al eliminar el justificante');
    } finally {
      setReceiptUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {initialReservation ? 'Detalles de la Reserva' : 'Registrar Nueva Reserva'}
            </h2>
            {initialReservation && (
              <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Reserva #{initialReservation.reservationNumber}</span>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {overbookingError && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs font-black uppercase flex items-center animate-bounce">
               <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
               {overbookingError}
            </div>
          )}

          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 relative">
            <label className="block text-xs font-bold text-blue-500 uppercase mb-2">Huésped</label>
            {selectedGuest ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">{selectedGuest.name[0]}{selectedGuest.surname[0]}</div>
                  <div>
                    <p className="font-bold text-gray-900">{selectedGuest.name} {selectedGuest.surname}</p>
                    <p className="text-xs text-gray-500">{selectedGuest.dni}</p>
                  </div>
                </div>
                {true && (
                  <button type="button" onClick={() => setFormData({...formData, guestId: ''})} className="text-xs font-bold text-blue-600">Cambiar</button>
                )}
              </div>
            ) : (
              <div className="relative">
                <input type="text" placeholder="Buscar huésped..." className="w-full bg-white border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onFocus={() => setIsSearching(true)} />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsCreatingGuest(prev => !prev)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800"
                  >
                    {isCreatingGuest ? 'Cancelar' : 'Crear huésped'}
                  </button>
                </div>
                {isCreatingGuest && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 bg-white border border-gray-200 rounded-lg p-3">
                    <input
                      type="text"
                      placeholder="Nombre"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-semibold text-gray-700 outline-none"
                      value={newGuest.name}
                      onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="Apellidos"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-semibold text-gray-700 outline-none"
                      value={newGuest.surname}
                      onChange={(e) => setNewGuest({ ...newGuest, surname: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="DNI"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-semibold text-gray-700 outline-none"
                      value={newGuest.dni}
                      onChange={(e) => setNewGuest({ ...newGuest, dni: e.target.value })}
                    />
                    <div className="md:col-span-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleCreateGuest}
                        disabled={loading}
                        className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        {loading ? 'Creando...' : 'Guardar huésped'}
                      </button>
                    </div>
                  </div>
                )}
                {isSearching && filteredGuests.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden">
                    {filteredGuests.map(g => (
                      <div key={g.id} onClick={() => { setFormData({...formData, guestId: g.id}); setIsSearching(false); }} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center">
                        <div><p className="font-bold text-gray-800">{g.name} {g.surname}</p><p className="text-xs text-gray-500">{g.dni}</p></div>
                        <span className="text-[10px] font-black text-blue-600">SELECCIONAR</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Inmueble</label>
              <select 
                className="w-full bg-white border border-gray-300 rounded-lg p-2.5 outline-none"
                value={formData.propertyId}
                onChange={e => setFormData({...formData, propertyId: e.target.value})}
              >
                {allProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Habitación</label>
              <select 
                className="w-full bg-white border border-gray-300 rounded-lg p-2.5 outline-none"
                value={formData.roomId}
                onChange={e => setFormData({...formData, roomId: e.target.value})}
              >
                {availableRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Entrada</label>
              <input required type="date" className="w-full bg-white border border-gray-300 rounded-lg p-2.5 outline-none" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Salida</label>
              <input required type="date" className="w-full bg-white border border-gray-300 rounded-lg p-2.5 outline-none" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Importe Mensual (€)</label>
              <input 
                required 
                type="number" 
                className="w-full border rounded-lg p-2.5 outline-none" 
                value={formData.amount ?? formData.price ?? 0} 
                onChange={e => {
                  const amountValue = normalizeAmount(e.target.value);
                  setFormData({ ...formData, amount: amountValue, price: amountValue });
                }} 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Método de Pago</label>
              <select 
                className="w-full border rounded-lg p-2.5 outline-none font-bold"
                value={formData.paymentMethod}
                onChange={e => {
                  const nextMethod = e.target.value as PaymentMethod;
                  setFormData({
                    ...formData,
                    paymentMethod: nextMethod,
                    cashDelivered: nextMethod === 'cash' ? !!formData.cashDelivered : false
                  });
                }}
              >
                <option value="pending">Pendiente (No pagado)</option>
                <option value="transfer">Banco (Pagado)</option>
                <option value="cash">Efectivo (Pagado)</option>
              </select>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Justificante de cobro</label>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {formData.paymentReceiptFile ? (
                <div className="text-sm font-semibold text-gray-700 flex items-center gap-3">
                  <a href={getReceiptUrl(formData.paymentReceiptFile)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    Ver justificante
                  </a>
                  <button
                    type="button"
                    onClick={deletePaymentReceipt}
                    disabled={receiptUploading}
                    className="text-red-600 text-xs font-black hover:underline disabled:opacity-50"
                  >
                    Borrar
                  </button>
                </div>
              ) : (
                <div className="text-xs text-gray-400">Sin justificante</div>
              )}
              <label className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer">
                {receiptUploading ? 'Subiendo...' : 'Subir archivo'}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadPaymentReceipt(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            {receiptError && <p className="mt-2 text-xs font-bold text-red-600">{receiptError}</p>}
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between border-t border-gray-100 gap-4">
            <div className="flex space-x-4">
               {initialReservation && (
                 <>
                   <button type="button" onClick={() => onDelete(initialReservation.id)} className="text-red-500 text-sm font-bold hover:underline">Eliminar</button>
                   <button type="button" onClick={handleCopyToNextMonth} className="text-blue-600 text-sm font-bold hover:underline">Copiar mes</button>
                 </>
               )}
            </div>
            <div className="flex space-x-3 w-full sm:w-auto">
               <button type="button" onClick={onClose} className="flex-1 px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Cerrar</button>
               <button type="submit" disabled={loading} className="flex-1 px-8 py-2.5 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:bg-blue-700 disabled:bg-gray-400">
                 {loading ? 'Guardando...' : 'Guardar'}
               </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
