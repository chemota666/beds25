
import React, { useState, useEffect, useMemo } from 'react';
import { Room, Reservation, Guest, Property, PaymentMethod, ReservationStatus } from '../types';
import { db } from '../services/db';

interface ReservationModalProps {
  rooms: Room[];
  propertyId: string;
  initialReservation?: Reservation | null;
  initialData?: { roomId: string, date: string } | null;
  onClose: () => void;
  onSave: (res: Reservation) => void;
  onDelete: (id: string) => void;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({ rooms: initialRooms, propertyId: initialPropId, initialReservation, initialData, onClose, onSave, onDelete }) => {
  const [allGuests, setAllGuests] = useState<Guest[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [overbookingError, setOverbookingError] = useState('');

  // Fixed: Added 'status' to the initial formData state
  const [formData, setFormData] = useState<Partial<Reservation>>(
    initialReservation || {
      id: Math.random().toString(36).substr(2, 9),
      propertyId: initialPropId === 'all' ? (initialRooms.length > 0 ? initialRooms[0].propertyId : '') : initialPropId,
      roomId: initialData?.roomId || (initialRooms.length > 0 ? initialRooms[0].id : ''),
      guestId: '',
      amount: 0,
      startDate: initialData?.date || new Date().toISOString().split('T')[0],
      endDate: initialData?.date || new Date().toISOString().split('T')[0],
      paymentMethod: 'transfer',
      status: 'confirmed',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );

  useEffect(() => {
    setAllGuests(db.getGuests());
    setAllProperties(db.getProperties());
  }, []);

  // Sync rooms when property changes
  const availableRooms = useMemo(() => {
    return db.getRooms(formData.propertyId);
  }, [formData.propertyId]);

  // Ensure valid roomId if property changes
  useEffect(() => {
    if (availableRooms.length > 0 && !availableRooms.find(r => r.id === formData.roomId)) {
      setFormData(prev => ({ ...prev, roomId: availableRooms[0].id }));
    }
  }, [availableRooms]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOverbookingError('');
    
    if (!formData.guestId) {
      alert('Por favor, selecciona un huésped.');
      return;
    }

    const resToSave = {
      ...formData as Reservation,
      updatedAt: new Date().toISOString()
    };

    if (db.checkOverbooking(resToSave)) {
      setOverbookingError('¡ERROR: Overbooking! La habitación ya está ocupada en estas fechas.');
      return;
    }

    onSave(resToSave);
  };

  const handleCopyToNextMonth = () => {
    const currentStart = new Date(formData.startDate || '');
    const currentEnd = new Date(formData.endDate || '');
    
    const nextStart = new Date(currentStart);
    nextStart.setMonth(currentStart.getMonth() + 1);
    
    const nextEnd = new Date(currentEnd);
    nextEnd.setMonth(currentEnd.getMonth() + 1);

    const newRes: Reservation = {
      ...formData as Reservation,
      id: Math.random().toString(36).substr(2, 9),
      startDate: nextStart.toISOString().split('T')[0],
      endDate: nextEnd.toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (db.checkOverbooking(newRes)) {
       alert('No se pudo copiar: Overbooking detectado en el mes siguiente.');
       return;
    }

    onSave(newRes);
    alert('Copia creada para el mes siguiente.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200">
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

          {/* Guest Selector */}
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
                {!initialReservation && (
                  <button type="button" onClick={() => setFormData({...formData, guestId: ''})} className="text-xs font-bold text-blue-600">Cambiar</button>
                )}
              </div>
            ) : (
              <div className="relative">
                <input type="text" placeholder="Buscar huésped..." className="w-full bg-white border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onFocus={() => setIsSearching(true)} />
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
                className="w-full bg-white border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.propertyId}
                onChange={e => setFormData({...formData, propertyId: e.target.value})}
              >
                {allProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Habitación</label>
              <select 
                className="w-full bg-white border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Importe Mensual (€)</label>
              <input required type="number" className="w-full bg-white border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Método de Pago</label>
              <select 
                className="w-full bg-white border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.paymentMethod}
                onChange={e => setFormData({...formData, paymentMethod: e.target.value as PaymentMethod})}
              >
                <option value="transfer">Transferencia</option>
                <option value="cash">Efectivo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Estado</label>
              <select 
                className="w-full bg-white border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as ReservationStatus})}
              >
                <option value="pending">Pendiente</option>
                <option value="confirmed">Confirmada</option>
                <option value="checked-out">Finalizada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
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
               <button type="submit" className="flex-1 px-8 py-2.5 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:bg-blue-700">Guardar</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};