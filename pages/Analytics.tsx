import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { AnalyticsService, KPI, OccupancyData, RevenueData, PropertyMetrics, OwnerMetrics } from '../services/analytics';
import { Reservation, Property, Owner, Room, Manager, Incident } from '../types';

export const Analytics: React.FC = () => {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [occupancyData, setOccupancyData] = useState<OccupancyData[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [propertyMetrics, setPropertyMetrics] = useState<PropertyMetrics[]>([]);
  const [ownerMetrics, setOwnerMetrics] = useState<OwnerMetrics[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'kpis' | 'revenue' | 'occupancy' | 'incidents'>('kpis');
  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), Math.max(0, today.getMonth() - 5), 1);
  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const parseLocalDate = (value: string) => {
    if (!value) return new Date();
    const clean = value.includes('T') ? value.split('T')[0] : value;
    const [y, m, d] = clean.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const [dateRange, setDateRange] = useState({
    start: formatLocalDate(defaultStart),
    end: formatLocalDate(today)
  });
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [managerFilter, setManagerFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'transfer' | 'cash' | 'cash_pending_delivery'>('all');
  const [expandedPropertyIds, setExpandedPropertyIds] = useState<string[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<'transfer' | 'cash' | 'pending' | null>(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true);
      try {
        const [reservations, properties, owners, rooms, managers, incidents] = await Promise.all([
          db.getReservations(),
          db.getProperties(),
          db.getOwners(),
          db.getRooms(),
          db.getManagers(),
          db.getIncidents()
        ]);

        setReservations(reservations);
        setProperties(properties);
        setOwners(owners);
        setRooms(rooms);
        setManagers(managers);
        setIncidents(incidents);

        // Calcular KPIs
        const calculatedKPIs = AnalyticsService.calculateKPIs(reservations, properties, owners);
        setKpis(calculatedKPIs);

        // Datos de ocupación
        const occupancy = AnalyticsService.getOccupancyTimeSeries(reservations, properties, 30);
        setOccupancyData(occupancy);

        // Datos de ingresos
        const revenue = AnalyticsService.getRevenueTimeSeries(reservations, 30);
        setRevenueData(revenue);

        // Métricas por propiedad
        const propMetrics = AnalyticsService.getPropertyMetrics(reservations, properties, owners);
        setPropertyMetrics(propMetrics);

        // Métricas por propietario
        const ownerMetricsData = AnalyticsService.getOwnerMetrics(reservations, properties, owners);
        setOwnerMetrics(ownerMetricsData);
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  const handleExportCSV = (type: 'properties' | 'owners' | 'occupancy' | 'revenue') => {
    switch (type) {
      case 'properties':
        AnalyticsService.exportToCSV(propertyMetrics, 'properties-report');
        break;
      case 'owners':
        AnalyticsService.exportToCSV(ownerMetrics, 'owners-report');
        break;
      case 'occupancy':
        AnalyticsService.exportToCSV(occupancyData, 'occupancy-report');
        break;
      case 'revenue':
        AnalyticsService.exportToCSV(revenueData, 'revenue-report');
        break;
    }
  };

  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const diffDays = (start: Date, end: Date) => {
    const ms = end.getTime() - start.getTime();
    return ms > 0 ? Math.ceil(ms / (1000 * 60 * 60 * 24)) : 0;
  };

  const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  const monthBuckets = useMemo(() => {
    const start = parseLocalDate(dateRange.start);
    const end = parseLocalDate(dateRange.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [] as Array<{ key: string; label: string; start: Date; endExclusive: Date; daysInRange: number }>;
    if (end.getTime() < start.getTime()) return [] as Array<{ key: string; label: string; start: Date; endExclusive: Date; daysInRange: number }>;
    const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    const buckets: Array<{ key: string; label: string; start: Date; endExclusive: Date; daysInRange: number }> = [];
    let cursor = new Date(startMonth);
    const rangeStart = start;
    const rangeEndExclusive = addDays(end, 1);
    while (cursor.getTime() <= endMonth.getTime()) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEndExclusive = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const clippedStart = rangeStart > monthStart ? rangeStart : monthStart;
      const clippedEnd = rangeEndExclusive < monthEndExclusive ? rangeEndExclusive : monthEndExclusive;
      const daysInRange = diffDays(clippedStart, clippedEnd);
      buckets.push({
        key: getMonthKey(monthStart),
        label: monthStart.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
        start: clippedStart,
        endExclusive: clippedEnd,
        daysInRange
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return buckets;
  }, [dateRange.start, dateRange.end]);

  const filteredProperties = useMemo(() => {
    let list = properties;
    if (ownerFilter !== 'all') {
      list = list.filter(p => String(p.owner) === String(ownerFilter));
    }
    if (managerFilter !== 'all') {
      list = list.filter(p => String(p.managerId || '') === String(managerFilter));
    }
    if (propertyFilter !== 'all') {
      list = list.filter(p => String(p.id) === String(propertyFilter));
    }
    return list;
  }, [properties, ownerFilter, managerFilter, propertyFilter]);

  const propertyIds = useMemo(() => new Set(filteredProperties.map(p => String(p.id))), [filteredProperties]);

  const matchesPayment = (res: Reservation) => {
    if (paymentFilter === 'all') return true;
    if (paymentFilter === 'pending') return res.paymentMethod === 'pending';
    if (paymentFilter === 'transfer') return res.paymentMethod === 'transfer';
    if (paymentFilter === 'cash') return res.paymentMethod === 'cash';
    if (paymentFilter === 'cash_pending_delivery') return res.paymentMethod === 'cash' && !res.cashDelivered;
    return true;
  };

  const filteredReservations = useMemo(() => {
    const rangeStart = parseLocalDate(dateRange.start);
    const rangeEndExclusive = addDays(parseLocalDate(dateRange.end), 1);
    return reservations.filter(res => {
      if (!propertyIds.has(String(res.propertyId))) return false;
      if (!matchesPayment(res)) return false;
      const resStart = parseLocalDate(res.startDate);
      const resEnd = parseLocalDate(res.endDate);
      if (resEnd <= rangeStart || resStart >= rangeEndExclusive) return false;
      return true;
    });
  }, [reservations, propertyIds, dateRange.start, dateRange.end, paymentFilter]);

  const revenueMatrix = useMemo(() => {
    const monthKeys = new Set(monthBuckets.map(b => b.key));
    const rows = filteredProperties.map(p => ({
      property: p,
      months: Object.fromEntries(monthBuckets.map(b => [b.key, 0])) as Record<string, number>,
      total: 0
    }));
    const rowMap = new Map(rows.map(r => [String(r.property.id), r]));
    const totalsByMonth: Record<string, number> = Object.fromEntries(monthBuckets.map(b => [b.key, 0]));

    const roomsByProperty = new Map<string, Room[]>();
    rooms.forEach(r => {
      const propId = String(r.propertyId);
      if (!roomsByProperty.has(propId)) roomsByProperty.set(propId, []);
      roomsByProperty.get(propId)!.push(r);
    });
    const roomRowsByProperty = new Map<string, Array<{ room: Room; months: Record<string, number>; total: number }>>();
    filteredProperties.forEach(p => {
      const propId = String(p.id);
      const propRooms = roomsByProperty.get(propId) || [];
      const roomRows = propRooms.map(room => ({
        room,
        months: Object.fromEntries(monthBuckets.map(b => [b.key, 0])) as Record<string, number>,
        total: 0
      }));
      roomRowsByProperty.set(propId, roomRows);
    });

    filteredReservations.forEach(res => {
      const start = parseLocalDate(res.startDate);
      const key = getMonthKey(start);
      if (!monthKeys.has(key)) return;
      const row = rowMap.get(String(res.propertyId));
      if (!row) return;
      const amount = Number(res.price ?? res.amount ?? 0) || 0;
      row.months[key] += amount;
      totalsByMonth[key] += amount;

      const propRoomRows = roomRowsByProperty.get(String(res.propertyId));
      if (propRoomRows) {
        const roomRow = propRoomRows.find(r => String(r.room.id) === String(res.roomId));
        if (roomRow) {
          roomRow.months[key] += amount;
        }
      }
    });

    rows.forEach(r => {
      r.total = Object.values(r.months).reduce((acc, v) => acc + v, 0);
    });

    roomRowsByProperty.forEach(list => {
      list.forEach(row => {
        row.total = Object.values(row.months).reduce((acc, v) => acc + v, 0);
      });
    });

    const grandTotal = Object.values(totalsByMonth).reduce((acc, v) => acc + v, 0);

    return { rows, totalsByMonth, grandTotal, roomRowsByProperty };
  }, [filteredReservations, filteredProperties, monthBuckets, dateRange.start, dateRange.end, rooms]);

  const occupancyMatrix = useMemo(() => {
    const monthKeys = monthBuckets.map(b => b.key);
    const roomsByProperty = new Map<string, Room[]>();
    const roomMap = new Map<string, Room>();
    rooms.forEach(r => {
      roomMap.set(String(r.id), r);
      const propId = String(r.propertyId);
      if (!roomsByProperty.has(propId)) roomsByProperty.set(propId, []);
      roomsByProperty.get(propId)!.push(r);
    });

    const propOccupied: Record<string, Record<string, number>> = {};
    const propRoomDays: Record<string, Record<string, number>> = {};
    const roomOccupied: Record<string, Record<string, number>> = {};
    const roomDays: Record<string, Record<string, number>> = {};

    filteredProperties.forEach(p => {
      const propId = String(p.id);
      const propRooms = roomsByProperty.get(propId) || [];
      propOccupied[propId] = {};
      propRoomDays[propId] = {};
      monthBuckets.forEach(b => {
        propOccupied[propId][b.key] = 0;
        propRoomDays[propId][b.key] = (propRooms.length || 0) * b.daysInRange;
      });
      propRooms.forEach(room => {
        const roomId = String(room.id);
        roomOccupied[roomId] = {};
        roomDays[roomId] = {};
        monthBuckets.forEach(b => {
          roomOccupied[roomId][b.key] = 0;
          roomDays[roomId][b.key] = b.daysInRange;
        });
      });
    });

    const getOverlapDays = (resStart: Date, resEnd: Date, rangeStart: Date, rangeEndExclusive: Date) => {
      const resEndExclusive = addDays(resEnd, 1); // endDate is inclusive (last night), so add 1 for exclusive comparison
      const start = resStart > rangeStart ? resStart : rangeStart;
      const end = resEndExclusive < rangeEndExclusive ? resEndExclusive : rangeEndExclusive;
      return diffDays(start, end);
    };

    filteredReservations.forEach(res => {
      const propId = String(res.propertyId);
      if (!propRoomDays[propId]) return;
      const roomId = String(res.roomId);
      if (!roomMap.has(roomId)) return;
      const resStart = parseLocalDate(res.startDate);
      const resEnd = parseLocalDate(res.endDate);
      monthBuckets.forEach(b => {
        if (b.daysInRange <= 0) return;
        const overlap = getOverlapDays(resStart, resEnd, b.start, b.endExclusive);
        if (overlap <= 0) return;
        propOccupied[propId][b.key] += overlap;
        if (roomOccupied[roomId]) roomOccupied[roomId][b.key] += overlap;
      });
    });

    const rows = filteredProperties.map(p => {
      const propId = String(p.id);
      const months: Record<string, number> = {};
      let occupiedTotal = 0;
      let roomDaysTotal = 0;
      monthKeys.forEach(key => {
        const occupied = propOccupied[propId]?.[key] || 0;
        const totalRoomDays = propRoomDays[propId]?.[key] || 0;
        occupiedTotal += occupied;
        roomDaysTotal += totalRoomDays;
        months[key] = totalRoomDays > 0 ? (occupied / totalRoomDays) * 100 : 0;
      });
      const total = roomDaysTotal > 0 ? (occupiedTotal / roomDaysTotal) * 100 : 0;
      return { property: p, months, total };
    });

    const totalsByMonth: Record<string, number> = {};
    const occupiedByMonth: Record<string, number> = {};
    const roomDaysByMonth: Record<string, number> = {};
    monthKeys.forEach(key => {
      occupiedByMonth[key] = 0;
      roomDaysByMonth[key] = 0;
    });

    filteredProperties.forEach(p => {
      const propId = String(p.id);
      monthKeys.forEach(key => {
        occupiedByMonth[key] += propOccupied[propId]?.[key] || 0;
        roomDaysByMonth[key] += propRoomDays[propId]?.[key] || 0;
      });
    });

    monthKeys.forEach(key => {
      totalsByMonth[key] = roomDaysByMonth[key] > 0 ? (occupiedByMonth[key] / roomDaysByMonth[key]) * 100 : 0;
    });

    const totalOccupied = Object.values(occupiedByMonth).reduce((acc, v) => acc + v, 0);
    const totalRoomDays = Object.values(roomDaysByMonth).reduce((acc, v) => acc + v, 0);
    const grandTotal = totalRoomDays > 0 ? (totalOccupied / totalRoomDays) * 100 : 0;

    const roomRowsByProperty = new Map<string, Array<{ room: Room; months: Record<string, number>; total: number }>>();
    filteredProperties.forEach(p => {
      const propId = String(p.id);
      const propRooms = roomsByProperty.get(propId) || [];
      const rows = propRooms.map(room => {
        const roomId = String(room.id);
        const months: Record<string, number> = {};
        let occupiedTotal = 0;
        let daysTotal = 0;
        monthKeys.forEach(key => {
          const occupied = roomOccupied[roomId]?.[key] || 0;
          const totalDays = roomDays[roomId]?.[key] || 0;
          occupiedTotal += occupied;
          daysTotal += totalDays;
          months[key] = totalDays > 0 ? (occupied / totalDays) * 100 : 0;
        });
        const total = daysTotal > 0 ? (occupiedTotal / daysTotal) * 100 : 0;
        return { room, months, total };
      });
      roomRowsByProperty.set(propId, rows);
    });

    return { rows, totalsByMonth, grandTotal, roomRowsByProperty };
  }, [filteredReservations, filteredProperties, rooms, monthBuckets]);

  const monthKeyForDate = (date: Date) => getMonthKey(new Date(date.getFullYear(), date.getMonth(), 1));

  const monthWindowForKey = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    const start = new Date(y, (m || 1) - 1, 1);
    const endExclusive = new Date(y, (m || 1), 1);
    return { start, endExclusive };
  };

  const endDateParsed = parseLocalDate(dateRange.end || formatLocalDate(new Date()));
  const currentMonthKey = monthKeyForDate(endDateParsed);
  const prevMonthKey = monthKeyForDate(new Date(endDateParsed.getFullYear(), endDateParsed.getMonth() - 1, 1));

  const reservationsInMonth = (key: string) => {
    const window = monthWindowForKey(key);
    return filteredReservations.filter(res => {
      const resStart = parseLocalDate(res.startDate);
      const resEnd = parseLocalDate(res.endDate);
      return !(resEnd <= window.start || resStart >= window.endExclusive);
    });
  };

  const revenueForMonth = (key: string) =>
    reservationsInMonth(key).reduce((acc, res) => acc + (Number(res.price ?? res.amount ?? 0) || 0), 0);

  const reservationsCountForMonth = (key: string) => reservationsInMonth(key).length;

  const occupancyForMonth = (key: string) => {
    const total = occupancyMatrix.totalsByMonth[key];
    return typeof total === 'number' ? total : 0;
  };

  const roomsBelow50ForMonth = (key: string) => {
    let count = 0;
    occupancyMatrix.roomRowsByProperty.forEach(list => {
      list.forEach(roomRow => {
        const pct = roomRow.months[key] ?? 0;
        if (pct < 50) count += 1;
      });
    });
    return count;
  };

  const paymentTotalsForMonth = (key: string) => {
    const monthRes = reservationsInMonth(key);
    const totals = { transfer: 0, cash: 0, pending: 0 };
    monthRes.forEach(res => {
      const amount = Number(res.price ?? res.amount ?? 0) || 0;
      if (res.paymentMethod === 'transfer') totals.transfer += amount;
      else if (res.paymentMethod === 'cash') totals.cash += amount;
      else totals.pending += amount;
    });
    return totals;
  };

  const paymentBreakdownRows = useMemo(() => {
    if (!paymentBreakdown) return [] as Array<{ propertyId: string; propertyName: string; total: number }>;
    const windowRes = reservationsInMonth(currentMonthKey);
    const totals = new Map<string, number>();
    windowRes.forEach(res => {
      if (paymentBreakdown === 'transfer' && res.paymentMethod !== 'transfer') return;
      if (paymentBreakdown === 'cash' && res.paymentMethod !== 'cash') return;
      if (paymentBreakdown === 'pending' && res.paymentMethod !== 'pending') return;
      const amount = Number(res.price ?? res.amount ?? 0) || 0;
      const key = String(res.propertyId);
      totals.set(key, (totals.get(key) || 0) + amount);
    });
    return filteredProperties.map(p => ({
      propertyId: String(p.id),
      propertyName: p.name,
      total: totals.get(String(p.id)) || 0
    }));
  }, [paymentBreakdown, filteredProperties, currentMonthKey, filteredReservations]);

  const incidentsTotals = useMemo(() => {
    const rangeStart = parseLocalDate(dateRange.start);
    const rangeEndExclusive = addDays(parseLocalDate(dateRange.end), 1);
    let open = 0;
    let resolved = 0;
    let pendingInvoice = 0;
    let pendingInvoiceAmount = 0;
    incidents.forEach(inc => {
      if (!propertyIds.has(String(inc.propertyId))) return;
      if (inc.createdAt) {
        const created = parseLocalDate(inc.createdAt);
        if (created < rangeStart || created >= rangeEndExclusive) return;
      }
      if (inc.solved) resolved += 1;
      else open += 1;
      if (!inc.refactured) {
        pendingInvoice += 1;
        pendingInvoiceAmount += Number(inc.total || 0) || 0;
      }
    });
    return { open, resolved, pendingInvoice, pendingInvoiceAmount };
  }, [incidents, propertyIds, dateRange.start, dateRange.end]);

  const propertyOptions = useMemo(() => {
    let list = properties;
    if (ownerFilter !== 'all') {
      list = list.filter(p => String(p.owner) === String(ownerFilter));
    }
    if (managerFilter !== 'all') {
      list = list.filter(p => String(p.managerId || '') === String(managerFilter));
    }
    return list;
  }, [properties, ownerFilter, managerFilter]);

  const incidentsByProperty = useMemo(() => {
    const map = new Map<string, { open: number; resolved: number; invoiced: number }>();
    filteredProperties.forEach(p => {
      map.set(String(p.id), { open: 0, resolved: 0, invoiced: 0 });
    });
    incidents.forEach(inc => {
      const propId = String(inc.propertyId);
      const entry = map.get(propId);
      if (!entry) return;
      if (inc.solved) entry.resolved += 1;
      else entry.open += 1;
      if (inc.refactured) entry.invoiced += 1;
    });
    return map;
  }, [incidents, filteredProperties]);

  const allVisiblePropertyIds = useMemo(
    () => filteredProperties.map(p => String(p.id)),
    [filteredProperties]
  );

  const togglePropertyExpansion = (propertyId: string) => {
    setExpandedPropertyIds(prev =>
      prev.includes(propertyId) ? prev.filter(id => id !== propertyId) : [...prev, propertyId]
    );
  };

  const toggleAllExpansions = () => {
    setExpandedPropertyIds(prev => (prev.length === allVisiblePropertyIds.length ? [] : allVisiblePropertyIds));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Analytics & Reportes</h1>
          <p className="text-sm text-gray-500">Dashboard de KPIs, ocupación e ingresos.</p>
        </div>
        <button
          disabled={loading || allVisiblePropertyIds.length === 0}
          onClick={toggleAllExpansions}
          className={`${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all flex items-center`}
        >
          {expandedPropertyIds.length === allVisiblePropertyIds.length ? 'Contraer' : 'Desplegar'}
        </button>
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Desde</label>
            <input
              type="date"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Hasta</label>
            <input
              type="date"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Propietario</label>
            <select
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={ownerFilter}
              onChange={(e) => {
                setOwnerFilter(e.target.value);
                setPropertyFilter('all');
              }}
            >
              <option value="all">Todos</option>
              {owners.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Inmueble</label>
            <select
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              {propertyOptions.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Gestor</label>
            <select
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={managerFilter}
              onChange={(e) => {
                setManagerFilter(e.target.value);
                setPropertyFilter('all');
              }}
            >
              <option value="all">Todos</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Estado de cobro</label>
            <select
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
            >
              <option value="all">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="transfer">Banco</option>
              <option value="cash">Efectivo</option>
              <option value="cash_pending_delivery">Efectivo pendiente de entrega</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-gray-100 bg-white rounded-t-2xl overflow-hidden">
        <button
          onClick={() => setActiveTab('kpis')}
          className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'kpis'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          📊 KPIs
        </button>
        <button
          onClick={() => setActiveTab('revenue')}
          className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'revenue'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          💰 Ingresos
        </button>
        <button
          onClick={() => setActiveTab('incidents')}
          className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'incidents'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          🧯 Incidencias
        </button>
        <button
          onClick={() => setActiveTab('occupancy')}
          className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'occupancy'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          📅 Ocupación
        </button>
      </div>

      {/* TAB 1: KPIs */}
      {activeTab === 'kpis' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-3xl">💰</span>
                <span className="text-xs font-black px-2 py-1 rounded-lg bg-green-100 text-green-700">Ingresos mes</span>
              </div>
              <div>
                <p className="text-3xl font-black text-gray-800">{revenueForMonth(currentMonthKey).toFixed(2)}€</p>
                <p className="text-xs font-bold text-gray-500 mt-1">Mes anterior: {revenueForMonth(prevMonthKey).toFixed(2)}€</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-3xl">🧾</span>
                <span className="text-xs font-black px-2 py-1 rounded-lg bg-blue-100 text-blue-700">Reservas mes</span>
              </div>
              <div>
                <p className="text-3xl font-black text-gray-800">{reservationsCountForMonth(currentMonthKey)}</p>
                <p className="text-xs font-bold text-gray-500 mt-1">Mes anterior: {reservationsCountForMonth(prevMonthKey)}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-3xl">📊</span>
                <span className="text-xs font-black px-2 py-1 rounded-lg bg-purple-100 text-purple-700">Ocupación mes</span>
              </div>
              <div>
                <p className="text-3xl font-black text-gray-800">{occupancyForMonth(currentMonthKey).toFixed(1)}%</p>
                <p className="text-xs font-bold text-gray-500 mt-1">Mes anterior: {occupancyForMonth(prevMonthKey).toFixed(1)}%</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-3xl">🛏️</span>
                <span className="text-xs font-black px-2 py-1 rounded-lg bg-orange-100 text-orange-700">Habitaciones &lt; 50%</span>
              </div>
              <div>
                <p className="text-3xl font-black text-gray-800">{roomsBelow50ForMonth(currentMonthKey)}</p>
                <p className="text-xs font-bold text-gray-500 mt-1">Mes anterior: {roomsBelow50ForMonth(prevMonthKey)}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-3xl">💳</span>
                <span className="text-xs font-black px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">Cobros del mes</span>
              </div>
              {(() => {
                const totals = paymentTotalsForMonth(currentMonthKey);
                return (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setPaymentBreakdown(prev => (prev === 'transfer' ? null : 'transfer'))}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-bold ${paymentBreakdown === 'transfer' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700'}`}
                    >
                      <span>Banco</span>
                      <span>{totals.transfer.toFixed(2)}€</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentBreakdown(prev => (prev === 'cash' ? null : 'cash'))}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-bold ${paymentBreakdown === 'cash' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-700'}`}
                    >
                      <span>Efectivo</span>
                      <span>{totals.cash.toFixed(2)}€</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentBreakdown(prev => (prev === 'pending' ? null : 'pending'))}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-bold ${paymentBreakdown === 'pending' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-white border-gray-200 text-gray-700'}`}
                    >
                      <span>Pendiente</span>
                      <span>{totals.pending.toFixed(2)}€</span>
                    </button>
                  </div>
                );
              })()}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-3xl">🧯</span>
                <span className="text-xs font-black px-2 py-1 rounded-lg bg-red-100 text-red-700">Incidencias</span>
              </div>
              <div className="space-y-2 text-sm font-bold text-gray-700">
                <div className="flex items-center justify-between">
                  <span>Abiertas</span>
                  <span>{incidentsTotals.open}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Solucionadas</span>
                  <span>{incidentsTotals.resolved}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Pendientes facturar</span>
                  <span>{incidentsTotals.pendingInvoice}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Importe pendiente</span>
                  <span>{incidentsTotals.pendingInvoiceAmount.toFixed(2)}€</span>
                </div>
              </div>
            </div>
          </div>

          {paymentBreakdown && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Desglose por inmueble · {paymentBreakdown === 'transfer' ? 'Banco' : paymentBreakdown === 'cash' ? 'Efectivo' : 'Pendiente'}</h3>
                <button
                  type="button"
                  onClick={() => setPaymentBreakdown(null)}
                  className="text-xs font-bold text-gray-500 hover:text-gray-700"
                >
                  Cerrar
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                      <th className="px-4 py-3">Inmueble</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paymentBreakdownRows.map(row => (
                      <tr key={row.propertyId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-800">{row.propertyName}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-700">{row.total.toFixed(2)}€</td>
                      </tr>
                    ))}
                    {paymentBreakdownRows.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-gray-400 italic">
                          No hay datos para este desglose.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OCUPACIÓN */}
      {activeTab === 'occupancy' && (
        <div className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-gray-800">Ocupación por Inmueble (mensual)</h2>
              <p className="text-xs text-gray-500">Doble click en un inmueble para ver el detalle por habitación.</p>
            </div>
            <button
              onClick={() => handleExportCSV('occupancy')}
              className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center"
            >
              📥 Exportar CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="px-4 py-3">Inmueble</th>
                  {monthBuckets.map(b => (
                    <th key={b.key} className="px-4 py-3 text-right">{b.label}</th>
                  ))}
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {occupancyMatrix.rows.map(row => (
                  <React.Fragment key={row.property.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onDoubleClick={() => togglePropertyExpansion(String(row.property.id))}
                    >
                      <td className="px-4 py-3 font-bold text-gray-800">
                        <button
                          type="button"
                          onClick={() => togglePropertyExpansion(String(row.property.id))}
                          className="w-full text-left"
                        >
                          {row.property.name}
                        </button>
                      </td>
                      {monthBuckets.map(b => (
                        <td key={b.key} className="px-4 py-3 text-right text-gray-700">
                          <button
                            type="button"
                            onClick={() => togglePropertyExpansion(String(row.property.id))}
                            className="w-full text-right"
                          >
                            {row.months[b.key].toFixed(1)}%
                          </button>
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-black text-gray-900">
                        <button
                          type="button"
                          onClick={() => togglePropertyExpansion(String(row.property.id))}
                          className="w-full text-right"
                        >
                          {row.total.toFixed(1)}%
                        </button>
                      </td>
                    </tr>
                    {expandedPropertyIds.includes(String(row.property.id)) && (occupancyMatrix.roomRowsByProperty.get(String(row.property.id)) || []).map(roomRow => (
                      <tr key={roomRow.room.id} className="bg-blue-50/40">
                        <td className="px-8 py-2 text-sm text-gray-700">↳ {roomRow.room.name}</td>
                        {monthBuckets.map(b => (
                          <td key={b.key} className="px-4 py-2 text-right text-sm text-gray-700">{roomRow.months[b.key].toFixed(1)}%</td>
                        ))}
                        <td className="px-4 py-2 text-right text-sm font-semibold text-gray-800">{roomRow.total.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {occupancyMatrix.rows.length === 0 && (
                  <tr>
                    <td colSpan={monthBuckets.length + 2} className="px-4 py-8 text-center text-gray-400 italic">
                      No hay datos para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
              {occupancyMatrix.rows.length > 0 && (
                <tfoot className="border-t border-gray-100">
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 font-black text-gray-700">TOTAL</td>
                    {monthBuckets.map(b => (
                      <td key={b.key} className="px-4 py-3 text-right font-bold text-gray-700">{occupancyMatrix.totalsByMonth[b.key]?.toFixed(1)}%</td>
                    ))}
                    <td className="px-4 py-3 text-right font-black text-gray-900">{occupancyMatrix.grandTotal.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INGRESOS */}
      {activeTab === 'revenue' && (
        <div className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-800">Ingresos por Inmueble (mensual)</h2>
            <button
              onClick={() => handleExportCSV('revenue')}
              className="text-sm font-bold text-green-600 hover:text-green-700 flex items-center"
            >
              📥 Exportar CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="px-4 py-3">Inmueble</th>
                  {monthBuckets.map(b => (
                    <th key={b.key} className="px-4 py-3 text-right">{b.label}</th>
                  ))}
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {revenueMatrix.rows.map(row => (
                  <React.Fragment key={row.property.id}>
                    <tr key={row.property.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-800">
                      <button
                        type="button"
                        onClick={() => togglePropertyExpansion(String(row.property.id))}
                        className="w-full text-left"
                      >
                        {row.property.name}
                      </button>
                    </td>
                    {monthBuckets.map(b => (
                      <td key={b.key} className="px-4 py-3 text-right text-gray-700">
                        <button
                          type="button"
                          onClick={() => togglePropertyExpansion(String(row.property.id))}
                          className="w-full text-right"
                        >
                          {row.months[b.key].toFixed(2)}€
                        </button>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-black text-gray-900">
                      <button
                        type="button"
                        onClick={() => togglePropertyExpansion(String(row.property.id))}
                        className="w-full text-right"
                      >
                        {row.total.toFixed(2)}€
                      </button>
                    </td>
                  </tr>
                  {expandedPropertyIds.includes(String(row.property.id)) && (revenueMatrix.roomRowsByProperty.get(String(row.property.id)) || []).map(roomRow => (
                    <tr key={roomRow.room.id} className="bg-blue-50/40">
                      <td className="px-8 py-2 text-sm text-gray-700">↳ {roomRow.room.name}</td>
                      {monthBuckets.map(b => (
                        <td key={b.key} className="px-4 py-2 text-right text-sm text-gray-700">{roomRow.months[b.key].toFixed(2)}€</td>
                      ))}
                      <td className="px-4 py-2 text-right text-sm font-semibold text-gray-800">{roomRow.total.toFixed(2)}€</td>
                    </tr>
                  ))}
                  </React.Fragment>
                ))}
                {revenueMatrix.rows.length === 0 && (
                  <tr>
                    <td colSpan={monthBuckets.length + 2} className="px-4 py-8 text-center text-gray-400 italic">
                      No hay datos para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
              {revenueMatrix.rows.length > 0 && (
                <tfoot className="border-t border-gray-100">
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 font-black text-gray-700">TOTAL</td>
                    {monthBuckets.map(b => (
                      <td key={b.key} className="px-4 py-3 text-right font-bold text-gray-700">{revenueMatrix.totalsByMonth[b.key]?.toFixed(2)}€</td>
                    ))}
                    <td className="px-4 py-3 text-right font-black text-gray-900">{revenueMatrix.grandTotal.toFixed(2)}€</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: INCIDENCIAS */}
      {activeTab === 'incidents' && (
        <div className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-800">Incidencias por Inmueble</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="px-4 py-3">Inmueble</th>
                  <th className="px-4 py-3 text-right">Abiertas</th>
                  <th className="px-4 py-3 text-right">Resueltas</th>
                  <th className="px-4 py-3 text-right">Facturadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProperties.map(p => {
                  const stats = incidentsByProperty.get(String(p.id)) || { open: 0, resolved: 0, invoiced: 0 };
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold text-gray-800">{p.name}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{stats.open}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{stats.resolved}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{stats.invoiced}</td>
                    </tr>
                  );
                })}
                {filteredProperties.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">
                      No hay inmuebles para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
