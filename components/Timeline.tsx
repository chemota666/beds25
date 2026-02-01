
import React, { useMemo, useState, useEffect } from 'react';
import { Room, Reservation, Property, Guest, PaymentMethod } from '../types';
import { db } from '../services/db';

interface TimelineProps {
  rooms: Room[];
  reservations: Reservation[];
  properties: Property[];
  currentDate: Date;
  onCellClick: (roomId: string, date: Date) => void;
  onReservationClick: (res: Reservation) => void;
  isAllProperties: boolean;
}

const paymentColors: Record<PaymentMethod, string> = {
  'transfer': 'bg-blue-500 text-white border-blue-600',
  'cash': 'bg-green-500 text-white border-green-600',
};

export const Timeline: React.FC<TimelineProps> = ({ rooms, reservations, properties, currentDate, onCellClick, onReservationClick, isAllProperties }) => {
  const [guests, setGuests] = useState<Guest[]>([]);
  
  useEffect(() => {
    setGuests(db.getGuests());
  }, [reservations]);

  const days = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const arr = [];
    for (let i = 0; i < 31; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [currentDate]);

  const getDayName = (date: Date) => {
    return date.toLocaleDateString('es-ES', { weekday: 'short' }).charAt(0).toUpperCase() + date.toLocaleDateString('es-ES', { weekday: 'short' }).slice(1, 3);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getPropertyName = (propId: string) => properties.find(p => p.id === propId)?.name || 'Desconocido';
  
  const getGuestDisplayName = (guestId: string) => {
    const g = guests.find(guest => guest.id === guestId);
    return g ? `${g.name} ${g.surname}` : 'Desconocido';
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden select-none">
      <div className="flex border-b border-gray-300 bg-gray-100">
        <div className="w-64 flex-shrink-0 p-4 font-bold text-gray-600 border-r border-gray-300">
          Inmueble / Habitación
        </div>
        <div className="flex-1 flex overflow-x-auto scrollbar-hide">
          {days.map((day, idx) => (
            <div 
              key={idx} 
              className={`flex-shrink-0 w-14 border-r border-gray-200 p-2 text-center text-xs font-semibold ${
                isToday(day) ? 'bg-blue-600 text-white' : 'text-gray-500'
              }`}
            >
              <div className="uppercase opacity-80">{getDayName(day)}</div>
              <div className="text-lg leading-tight">{day.getDate()}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto">
        {rooms.map((room) => (
          <div key={room.id} className="flex border-b border-gray-100 group relative">
            <div className="w-64 flex-shrink-0 p-3 text-sm font-medium text-gray-700 border-r border-gray-300 bg-gray-50 flex flex-col justify-center">
              {isAllProperties && (
                <span className="text-[10px] text-blue-600 uppercase font-bold truncate">
                  {getPropertyName(room.propertyId)}
                </span>
              )}
              <span className="truncate">{room.name}</span>
            </div>

            <div className="flex-1 flex relative h-16">
              {days.map((day, idx) => (
                <div 
                  key={idx} 
                  className={`flex-shrink-0 w-14 border-r border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${
                    isToday(day) ? 'bg-blue-50/30' : ''
                  }`}
                  onClick={() => onCellClick(room.id, day)}
                />
              ))}

              {reservations
                .filter(res => res.roomId === room.id)
                .map(res => {
                  const start = new Date(res.startDate);
                  const end = new Date(res.endDate);
                  const monthStart = days[0];
                  
                  const startIndex = Math.floor((start.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));
                  const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                  
                  if (startIndex + duration < 0 || startIndex > 31) return null;

                  const adjustedStart = Math.max(0, startIndex);
                  const adjustedWidth = Math.min(31 - adjustedStart, duration + (startIndex < 0 ? startIndex : 0));

                  return (
                    <div
                      key={res.id}
                      onClick={(e) => { e.stopPropagation(); onReservationClick(res); }}
                      className={`absolute top-2 h-12 rounded shadow-sm border px-2 py-1 cursor-pointer transition-all hover:brightness-95 z-10 overflow-hidden ${paymentColors[res.paymentMethod] || 'bg-gray-500'}`}
                      style={{
                        left: `${adjustedStart * 56}px`,
                        width: `${adjustedWidth * 56 - 4}px`,
                      }}
                      title={`${getGuestDisplayName(res.guestId)}: ${res.notes || 'Sin notas'}`}
                    >
                      <div className="text-[11px] font-bold truncate flex items-center justify-between">
                        <span>#{res.reservationNumber} - {getGuestDisplayName(res.guestId)}</span>
                        {res.notes && (
                           <svg className="w-3 h-3 flex-shrink-0 ml-1 opacity-80" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd"></path></svg>
                        )}
                      </div>
                      <div className="text-[9px] opacity-90 truncate italic">
                        {res.paymentMethod === 'transfer' ? 'Transfer' : 'Efectivo'} {res.notes ? `• ${res.notes}` : ''}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
