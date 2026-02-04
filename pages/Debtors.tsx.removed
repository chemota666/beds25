
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Reservation, Property, Room, Guest } from '../types';

export const Debtors: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [filter, setFilter] = useState({ propertyId: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [resData, propsData, roomsData, guestsData] = await Promise.all([
        db.getReservations(),
        db.getProperties(),
        db.getRooms(),
        db.getGuests()
      ]);
      setReservations(resData);
      setProperties(propsData);
      setRooms(roomsData);
      setGuests(guestsData);
      setLoading(false);
    };
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return reservations.filter(r => {
      // Solo mostramos lo PENDIENTE de cobro
      // En el nuevo sistema, status no existe, rely on paymentMethod
      const isPending = r.paymentMethod === 'pending';
      if (!isPending) return false;

      const matchProp = filter.propertyId ? r.propertyId === filter.propertyId : true;
      return matchProp;
    });
  }, [reservations, filter]);

  const totalPending = filteredData.reduce((sum, r) => sum + r.amount, 0);

  const getRoomName = (id: string) => rooms.find(r => r.id === id)?.name || 'N/A';
  const getPropertyName = (id: string) => properties.find(p => p.id === id)?.name || 'N/A';
  const getGuestName = (id: string) => {
    const g = guests.find(guest => guest.id === id);
    return g ? `${g.name} ${g.surname}` : 'N/A';
  };
  const getGuestPhone = (id: string) => {
    const g = guests.find(guest => guest.id === id);
    return g?.phone || 'Sin tlf';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reporte de Deudores</h1>
          <p className="text-sm text-gray-500">Reservas con pago pendiente de cobro.</p>
        </div>
        {loading && <span className="text-blue-600 font-bold animate-pulse text-sm">Cargando desde Sheets...</span>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
           <div>
             <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Filtrar por Inmueble</label>
             <select 
               className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 outline-none focus:ring-4 focus:ring-red-50/50 transition-all"
               value={filter.propertyId}
               onChange={e => setFilter({...filter, propertyId: e.target.value})}
             >
               <option value="">Todos los inmuebles</option>
               {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
             </select>
           </div>
           
           <div className="bg-red-600 rounded-2xl p-4 flex items-center justify-between text-white shadow-xl shadow-red-100">
             <div>
               <p className="text-[10px] font-black uppercase opacity-60">Importe Pendiente</p>
               <p className="text-2xl font-black">{totalPending.toLocaleString()}€</p>
             </div>
             <div className="bg-red-500/30 p-2 rounded-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
             </div>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                <th className="pb-4 px-2">#</th>
                <th className="pb-4">Huésped</th>
                <th className="pb-4">Ubicación</th>
                <th className="pb-4">Período</th>
                <th className="pb-4">Contacto</th>
                <th className="pb-4 text-right">Deuda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredData.length > 0 ? filteredData.map(r => (
                <tr key={r.id} className="hover:bg-red-50/50 transition-colors group">
                  <td className="py-4 px-2 text-xs font-black text-red-500">#{r.reservationNumber}</td>
                  <td className="py-4">
                    <div className="font-bold text-gray-800">{getGuestName(r.guestId)}</div>
                  </td>
                  <td className="py-4">
                    <div className="text-sm font-medium text-gray-600">{getPropertyName(r.propertyId)}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase">{getRoomName(r.roomId)}</div>
                  </td>
                  <td className="py-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                       <span className="font-bold text-gray-700">{new Date(r.startDate).toLocaleDateString()}</span>
                       <span className="text-gray-300">→</span>
                       <span className="font-bold text-gray-700">{new Date(r.endDate).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="text-sm text-gray-600">{getGuestPhone(r.guestId)}</div>
                  </td>
                  <td className="py-4 text-right font-black text-red-600">{r.amount.toLocaleString()}€</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400 italic">No hay deudas pendientes en este momento.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
