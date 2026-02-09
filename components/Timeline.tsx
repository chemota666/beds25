
import React, { useMemo, useState, useEffect } from 'react';
import { Room, Reservation, Property, Guest, PaymentMethod } from '../types';
import { db } from '../services/db';

interface TimelineProps {
  rooms: Room[];
  reservations: Reservation[];
  properties: Property[];
  startDate: Date;
  daysToShow: number;
  onCellClick: (roomId: string, date: Date) => void;
  onReservationClick: (res: Reservation) => void;
  isAllProperties: boolean;
}

const paymentColors: Record<PaymentMethod, string> = {
  'pending': 'bg-yellow-400 text-white border-yellow-500',
  'transfer': 'bg-blue-500 text-white border-blue-600',
  'cash': 'bg-green-500 text-white border-green-600',
};

export const Timeline: React.FC<TimelineProps> = ({ rooms, reservations, properties, startDate, daysToShow, onCellClick, onReservationClick, isAllProperties }) => {
  const [guests, setGuests] = useState<Guest[]>([]);

  const parseLocalDate = (value: string) => {
    if (!value) return new Date('');
    return value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`);
  };
  
  // FIX: Handled async call to db.getGuests() correctly within useEffect
  useEffect(() => {
    const loadGuests = async () => {
      const data = await db.getGuests();
      setGuests(data);
    };
    loadGuests();
  }, [reservations]);

  const days = useMemo(() => {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
    const arr: Date[] = [];
    const totalDays = Math.max(1, daysToShow);
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [startDate, daysToShow]);

  const getDayName = (date: Date) => {
    return date.toLocaleDateString('es-ES', { weekday: 'short' }).charAt(0).toUpperCase() + date.toLocaleDateString('es-ES', { weekday: 'short' }).slice(1, 3);
  };

  const getMonthShort = (date: Date) => {
    const raw = date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
    return raw.charAt(0).toUpperCase() + raw.slice(1, 3);
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

  const getPaymentLabel = (method: PaymentMethod) => {
    switch(method) {
      case 'cash': return 'Efectivo';
      case 'transfer': return 'Banco';
      case 'pending': return 'Pendiente';
      default: return method;
    }
  };

  const rowBackgrounds = useMemo(() => {
    const map: Record<string, string> = {};
    let lastPropertyId: string | null = null;
    let isGray = false;

    rooms.forEach((room) => {
      if (room.propertyId !== lastPropertyId) {
        isGray = !isGray;
        lastPropertyId = room.propertyId;
      }
      map[room.id] = isGray ? 'bg-gray-50' : 'bg-white';
    });

    return map;
  }, [rooms]);

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
              <div className="text-lg leading-tight">{day.getDate()} {getMonthShort(day)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto">
        {rooms.map((room) => (
          <div key={room.id} className={`flex border-b border-gray-100 group relative ${rowBackgrounds[room.id] || 'bg-white'}`}>
            <div className={`w-64 flex-shrink-0 p-3 text-sm font-medium text-gray-700 border-r border-gray-300 flex flex-col justify-center ${rowBackgrounds[room.id] || 'bg-white'}`}>
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
                  className={`flex-shrink-0 w-14 border-r border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${rowBackgrounds[room.id] || 'bg-white'} ${
                    isToday(day) ? 'bg-blue-50/30' : ''
                  }`}
                  onClick={() => onCellClick(room.id, day)}
                />
              ))}

              {reservations
                .filter(res => res.roomId === room.id)
                .map(res => {
                  const start = parseLocalDate(res.startDate);
                  const end = parseLocalDate(res.endDate);
                  const windowStart = days[0];
                  const windowDays = days.length;
                  
                  const startIndex = Math.floor((start.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24));
                  const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  
                  if (startIndex + duration < 0 || startIndex > windowDays) return null;

                  const adjustedStart = Math.max(0, startIndex);
                  const adjustedWidth = Math.min(windowDays - adjustedStart, duration + (startIndex < 0 ? startIndex : 0));

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
                        {getPaymentLabel(res.paymentMethod)} {res.notes ? `• ${res.notes}` : ''}
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
