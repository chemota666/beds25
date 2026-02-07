import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Reservation, Property, Guest, Room } from '../types';
import { ReservationModal } from '../components/ReservationModal';


export const Reservations: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterCheckinFrom, setFilterCheckinFrom] = useState('');
  const [filterCheckinTo, setFilterCheckinTo] = useState('');
  const [filterProperty, setFilterProperty] = useState('all');
  const [filterGuest, setFilterGuest] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  
  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);


  useEffect(() => {
    loadData();
  }, []);


  const loadData = async () => {
    setLoading(true);
    try {
              const res = await fetch('/api/reservations').then(r => r.json());
        const props = await fetch('/api/properties').then(r => r.json());
        const gsts = await fetch('/api/guests').then(r => r.json());
        const rms = await fetch('/api/rooms').then(r => r.json());
      
      setReservations(res);
      setProperties(props);
      setGuests(gsts);
      setRooms(rms);
    } catch (e) {
      console.error('Error loading data:', e);
    }
    setLoading(false);
  };


  // Helper functions
  const getPropertyName = (propertyId: number) => {
    const prop = properties.find(p => Number(p.id) === Number(propertyId));
    return prop?.name || 'Desconocido';
  };


  const getGuestName = (guestId: number) => {
    const guest = guests.find(g => Number(g.id) === Number(guestId));
    return guest ? `${guest.name} ${guest.surname}` : 'Desconocido';
  };


  const getRoomName = (roomId: number) => {
    const room = rooms.find(r => Number(r.id) === Number(roomId));
    return room?.name || 'Desconocida';
  };


  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES');
  };


  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      confirmed: 'Confirmada',
      paid: 'Pagada',
      cancelled: 'Cancelada'
    };
    return labels[status] || status;
  };


  const getPaymentLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Efectivo',
      bank: 'Banco',
      pending: 'Pendiente'
    };
    return labels[method] || method;
  };


  // Filtered reservations
  const filteredReservations = useMemo(() => {
    return reservations.filter(r => {
      // Filter by checkin date range
      if (filterCheckinFrom && new Date(r.startDate) < new Date(filterCheckinFrom)) return false;
      if (filterCheckinTo && new Date(r.startDate) > new Date(filterCheckinTo)) return false;
      // Filter by property
      if (filterProperty !== 'all') {
        const room = rooms.find(rm => Number(rm.id) === Number(r.roomId));
        if (r.propertyId !== Number(filterProperty)) return false;
      }
      // Filter by guest
      if (filterGuest !== 'all' && r.guestId !== Number(filterGuest)) return false;
      // Filter by status
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      // Filter by payment method
      if (filterPayment !== 'all' && r.paymentMethod !== filterPayment) return false;
      return true;
    });
  }, [reservations, rooms, filterCheckinFrom, filterCheckinTo, filterProperty, filterGuest, filterStatus, filterPayment]);


  const handleDoubleClick = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setIsModalOpen(true);
  };


  const handleSave = async (res: Reservation) => {
    await db.saveReservation(res);
    await loadData();
    setIsModalOpen(false);
    setEditingReservation(null);
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Reservas</h1>
      </div>


      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Desde</label>
            <input type="date" value={filterCheckinFrom} onChange={e => setFilterCheckinFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Hasta</label>
            <input type="date" value={filterCheckinTo} onChange={e => setFilterCheckinTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Propiedad</label>
            <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
              <option value="all">Todas</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Huésped</label>
            <select value={filterGuest} onChange={e => setFilterGuest(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
              <option value="all">Todos</option>
              {guests.map(g => <option key={g.id} value={g.id}>{g.name} {g.surname}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
              <option value="all">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="confirmed">Confirmada</option>
              <option value="paid">Pagada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método Pago</label>
            <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
              <option value="all">Todos</option>
              <option value="cash">Efectivo</option>
              <option value="bank">Banco</option>
              <option value="pending">Pendiente</option>
            </select>
          </div>
        </div>
      </div>


      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inmueble</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Huésped</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Habitación</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-in</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-out</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Precio</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReservations.map(r => {
                  const room = rooms.find(rm => Number(rm.id) === Number(r.roomId));
                  const propertyId = r.propertyId || 0;
                  return (
                    <tr key={r.id} onDoubleClick={() => handleDoubleClick(r)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(r.createdAt || '')}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{getPropertyName(propertyId)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getGuestName(r.guestId)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getRoomName(r.roomId)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(r.startDate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(r.endDate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{r.price}€</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${r.status === 'paid' ? 'bg-green-100 text-green-800' : r.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : r.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{getStatusLabel(r.status)}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getPaymentLabel(r.paymentMethod)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredReservations.length === 0 && (
              <div className="p-8 text-center text-gray-500">No hay reservas que coincidan con los filtros</div>
            )}
          </div>
        )}
      </div>


      {/* Modal */}
      {isModalOpen && (
        <ReservationModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingReservation(null); }}
          onSave={handleSave}
            initialReservation={editingReservation}
          rooms={rooms}
                      propertyId={'all'}
            onDelete={(id) => { console.log('delete', id); }}
        />
      )}
    </div>
  );
};