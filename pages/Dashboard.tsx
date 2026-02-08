
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Property, Room, Reservation } from '../types';
import { Timeline } from '../components/Timeline';
import { ReservationModal } from '../components/ReservationModal';

export const Dashboard: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [rangeMonths, setRangeMonths] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [initialDataForNew, setInitialDataForNew] = useState<{ roomId: string, date: string } | null>(null);

  useEffect(() => {
    const loadProperties = async () => {
      const props = await db.getProperties();
      setProperties(props);
    };
    loadProperties();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      if (selectedPropertyId === 'all') {
        const [allRooms, allRes] = await Promise.all([db.getRooms(), db.getReservations()]);
        setRooms(allRooms);
        setReservations(allRes);
      } else {
        const [propRooms, allRes] = await Promise.all([db.getRooms(selectedPropertyId), db.getReservations()]);
        setRooms(propRooms);
        setReservations(allRes.filter(r => String(r.propertyId) === String(selectedPropertyId)));
      }
      setLoading(false);
    };
    loadData();
  }, [selectedPropertyId]);

  const handleCellClick = (roomId: string, date: Date) => {
    setEditingReservation(null);
    setInitialDataForNew({ roomId, date: date.toISOString().split('T')[0] });
    setIsModalOpen(true);
  };

  const handleReservationClick = (res: Reservation) => {
    setInitialDataForNew(null);
    setEditingReservation(res);
    setIsModalOpen(true);
  };

  const handleSave = async (res: Reservation) => {
    try {
      setLoading(true);
      await db.saveReservation(res);
      const updatedRes = await db.getReservations();
      if (selectedPropertyId === 'all') {
        setReservations(updatedRes);
      } else {
        setReservations(updatedRes.filter(r => String(r.propertyId) === String(selectedPropertyId)));
      }
      setIsModalOpen(false);
      const message = editingReservation ? '✅ Reserva actualizada correctamente' : '✅ Nueva reserva creada';
      alert(message);
    } catch (error: any) {
      alert('❌ Error al guardar la reserva: ' + (error?.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleReservationUpdated = (updatedRes: Reservation) => {
    setReservations(prev => prev.map(r => String(r.id) === String(updatedRes.id) ? { ...r, ...updatedRes } : r));
    setEditingReservation(updatedRes);
  };

  const handleDelete = async (id: string) => {
    try {
      await db.deleteReservation(id);
    } catch (err: any) {
      alert(err && err.message ? err.message : 'Error al eliminar la reserva');
      return;
    }
    const updatedRes = await db.getReservations();
    if (selectedPropertyId === 'all') {
      setReservations(updatedRes);
    } else {
      setReservations(updatedRes.filter(r => String(r.propertyId) === String(selectedPropertyId)));
    }
    setIsModalOpen(false);
  };

  const parseLocalDate = (value: string) => {
    if (!value) return new Date();
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const addMonthsPreserveDay = (date: Date, months: number) => {
    const d = new Date(date);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
  };

  const startDateObj = parseLocalDate(startDate);
  const endDateObj = addMonthsPreserveDay(startDateObj, rangeMonths);
  const daysToShow = Math.max(1, Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)));

  const nextMonth = () => {
    const d = addMonthsPreserveDay(startDateObj, rangeMonths);
    setStartDate(formatLocalDate(d));
  };

  const prevMonth = () => {
    const d = addMonthsPreserveDay(startDateObj, -rangeMonths);
    setStartDate(formatLocalDate(d));
  };

  const activeRoomsCount = rooms.length;
  const currentOccupied = reservations.filter(r => {
    const today = new Date();
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    // Removed the non-existent 'status' check as the database logic now assumes presence means confirmed.
    return today >= start && today <= end;
  }).length;

  const occupancy = activeRoomsCount > 0 ? Math.round((currentOccupied / activeRoomsCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-start gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-blue-500 uppercase tracking-wider z-10">Inmueble</label>
            <select 
              value={selectedPropertyId} 
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-4 focus:ring-blue-100 outline-none appearance-none pr-10 cursor-pointer min-w-[220px]"
            >
              <option value="all">🏢 Todos los Inmuebles</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>

          <button 
            onClick={() => { setEditingReservation(null); setInitialDataForNew(null); setIsModalOpen(true); }}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
            Nueva Reserva
          </button>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Calendario Maestro</h1>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span className={`w-2 h-2 rounded-full ${loading ? 'bg-orange-400 animate-spin' : 'bg-green-500 animate-pulse'}`}></span>
            <span>{loading ? 'Cargando datos de Sheets...' : `Sistema en vivo • ${activeRoomsCount} habitaciones monitoreadas`}</span>
          </div>
        </div>
      </div>

      {/* Navigation & Timeline */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 overflow-hidden relative">
        {loading && <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-center justify-center font-bold text-blue-600">Sincronizando...</div>}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
           <div className="flex flex-wrap items-center gap-4">
             <div className="flex bg-gray-100 p-1.5 rounded-2xl">
               <button onClick={prevMonth} className="p-3 hover:bg-white hover:shadow-md rounded-xl transition-all text-gray-600">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
               </button>
               <button onClick={() => setStartDate(formatLocalDate(new Date()))} className="px-6 py-2 text-sm font-black text-gray-700 uppercase tracking-widest">
                 {startDateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                 <span className="mx-2 text-gray-300">→</span>
                 {endDateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
               </button>
               <button onClick={nextMonth} className="p-3 hover:bg-white hover:shadow-md rounded-xl transition-all text-gray-600">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
               </button>
             </div>

             <div className="flex items-center gap-3">
               <div>
                 <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ir a fecha</label>
                 <input
                   type="date"
                   className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 focus:ring-4 focus:ring-blue-100 outline-none"
                   value={startDate}
                   onChange={(e) => setStartDate(e.target.value)}
                 />
               </div>
               <div>
                 <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Rango</label>
                 <select
                   className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 focus:ring-4 focus:ring-blue-100 outline-none"
                   value={String(rangeMonths)}
                   onChange={(e) => setRangeMonths(Number(e.target.value))}
                 >
                   <option value="1">1 mes</option>
                   <option value="2">2 meses</option>
                   <option value="3">3 meses</option>
                   <option value="6">6 meses</option>
                   <option value="12">12 meses</option>
                 </select>
               </div>
             </div>
           </div>

           <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-blue-500"></span>
                  <span className="text-xs font-bold text-gray-500 uppercase">Banco</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-green-500"></span>
                  <span className="text-xs font-bold text-gray-500 uppercase">Efectivo</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-yellow-400"></span>
                  <span className="text-xs font-bold text-gray-500 uppercase">Pendiente</span>
                </div>
             </div>
            </div>

        <Timeline 
          rooms={rooms} 
          reservations={reservations} 
          properties={properties}
          startDate={startDateObj}
          daysToShow={daysToShow}
          onCellClick={handleCellClick}
          onReservationClick={handleReservationClick}
          isAllProperties={selectedPropertyId === 'all'}
        />
      </div>

      {isModalOpen && (
        <ReservationModal
          rooms={rooms}
          propertyId={selectedPropertyId === 'all' ? (rooms.length > 0 ? rooms[0].propertyId : '') : selectedPropertyId}
          initialReservation={editingReservation}
          initialData={initialDataForNew}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
          onReservationUpdated={handleReservationUpdated}
        />
      )}
    </div>
  );
};
