
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Property, Room, Reservation, ReservationStatus } from '../types';
import { Timeline } from '../components/Timeline';
import { ReservationModal } from '../components/ReservationModal';

export const Dashboard: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [initialDataForNew, setInitialDataForNew] = useState<{ roomId: string, date: string } | null>(null);

  useEffect(() => {
    const props = db.getProperties();
    setProperties(props);
  }, []);

  useEffect(() => {
    if (selectedPropertyId === 'all') {
      setRooms(db.getRooms());
      setReservations(db.getReservations());
    } else {
      setRooms(db.getRooms(selectedPropertyId));
      setReservations(db.getReservations().filter(r => r.propertyId === selectedPropertyId));
    }
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

  const handleSave = (res: Reservation) => {
    db.saveReservation(res);
    // Refresh
    if (selectedPropertyId === 'all') {
      setReservations(db.getReservations());
    } else {
      setReservations(db.getReservations().filter(r => r.propertyId === selectedPropertyId));
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    db.deleteReservation(id);
    if (selectedPropertyId === 'all') {
      setReservations(db.getReservations());
    } else {
      setReservations(db.getReservations().filter(r => r.propertyId === selectedPropertyId));
    }
    setIsModalOpen(false);
  };

  const nextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const prevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const activeRooms = rooms.length;
  const currentOccupied = reservations.filter(r => {
    const today = new Date();
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    return today >= start && today <= end && r.status === 'confirmed';
  }).length;

  const occupancy = activeRooms > 0 ? Math.round((currentOccupied / activeRooms) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Calendario Maestro</h1>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Sistema en vivo • {activeRooms} habitaciones monitoreadas</span>
          </div>
        </div>
        
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

          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-blue-500 uppercase tracking-wider z-10">Ir a fecha</label>
            <input 
              type="date"
              value={currentDate.toISOString().split('T')[0]}
              onChange={(e) => setCurrentDate(new Date(e.target.value))}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-4 focus:ring-blue-100 outline-none cursor-pointer"
            />
          </div>

          <button 
            onClick={() => { setEditingReservation(null); setInitialDataForNew(null); setIsModalOpen(true); }}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
            Nueva Reserva
          </button>
        </div>
      </div>

      {/* Navigation & Timeline */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center space-x-6">
             <h3 className="text-2xl font-extrabold text-gray-800 capitalize">
               {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
             </h3>
             <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-green-500"></span>
                  <span className="text-xs font-bold text-gray-500 uppercase">Confirmadas</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-yellow-400"></span>
                  <span className="text-xs font-bold text-gray-500 uppercase">Pendientes</span>
                </div>
             </div>
           </div>
           
           <div className="flex bg-gray-100 p-1.5 rounded-2xl">
             <button 
                onClick={prevMonth} 
                className="p-3 hover:bg-white hover:shadow-md rounded-xl transition-all text-gray-600"
                title="Mes Anterior"
             >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
             </button>
             <button 
                onClick={() => setCurrentDate(new Date())} 
                className="px-6 py-2 text-sm font-black text-gray-700 uppercase tracking-widest"
             >
                Hoy
             </button>
             <button 
                onClick={nextMonth} 
                className="p-3 hover:bg-white hover:shadow-md rounded-xl transition-all text-gray-600"
                title="Mes Siguiente"
             >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
             </button>
           </div>
        </div>

        <Timeline 
          rooms={rooms} 
          reservations={reservations} 
          properties={properties}
          currentDate={currentDate} 
          onCellClick={handleCellClick}
          onReservationClick={handleReservationClick}
          isAllProperties={selectedPropertyId === 'all'}
        />
      </div>

      {/* Legend & Stats Overlay */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-2xl text-white shadow-xl shadow-blue-100 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-black uppercase opacity-60 mb-1">Ocupación Actual</p>
            <p className="text-4xl font-black">{occupancy}%</p>
            <div className="mt-4 w-full bg-blue-400/30 h-2 rounded-full overflow-hidden">
              <div className="bg-white h-full transition-all duration-1000" style={{ width: `${occupancy}%` }}></div>
            </div>
          </div>
          <svg className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"></path></svg>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="bg-orange-100 p-4 rounded-2xl text-orange-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div>
            <p className="text-xs font-black text-gray-400 uppercase">Pendientes de Entrada</p>
            <p className="text-3xl font-black text-gray-800">{reservations.filter(r => r.status === 'pending').length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="bg-green-100 p-4 rounded-2xl text-green-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div>
            <p className="text-xs font-black text-gray-400 uppercase">Estancias en Curso</p>
            <p className="text-3xl font-black text-gray-800">{currentOccupied}</p>
          </div>
        </div>
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
        />
      )}
    </div>
  );
};
