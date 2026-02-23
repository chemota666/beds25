import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../services/db';
import { Reservation, Guest, Property, Owner, PaymentMethod, Room, Manager } from '../types';
import { ReservationModal } from '../components/ReservationModal';

export const Reservations: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [selectedManagerId, setSelectedManagerId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'guest'>('date');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'transfer' | 'cash' | 'cash_pending_delivery'>('all');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  // Cargar datos
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [resList, guestList, propList, ownerList, roomList, managerList] = await Promise.all([
          db.getReservations(),
          db.getGuests(),
          db.getProperties(),
          db.getOwners(),
          db.getRooms(),
          db.getManagers()
        ]);
        setReservations(resList);
        setGuests(guestList);
        setProperties(propList);
        setOwners(ownerList);
        setRooms(roomList);
        setManagers(managerList);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getOwnerName = (propertyId: string | number) => {
    const prop = properties.find(p => String(p.id) === String(propertyId));
    if (!prop) return 'N/A';
    const owner = owners.find(o => String(o.id) === String(prop.owner));
    return owner ? owner.name : 'N/A';
  };

  const getGuestName = (guestId: string | number) => {
    const guest = guests.find(g => String(g.id) === String(guestId));
    return guest ? `${guest.name} ${guest.surname}`.trim() : 'Desconocido';
  };

  const getPropertyName = (propertyId: string | number) => {
    const prop = properties.find(p => String(p.id) === String(propertyId));
    return prop ? prop.name : 'N/A';
  };

  const getManagerName = (propertyId: string | number) => {
    const prop = properties.find(p => String(p.id) === String(propertyId));
    if (!prop?.managerId) return 'Sin asignar';
    const manager = managers.find(m => String(m.id) === String(prop.managerId));
    return manager ? manager.name : 'Sin asignar';
  };

  const getPropertiesForOwner = (ownerId: string) => {
    return properties.filter(p => String(p.owner) === ownerId);
  };

  const isPaid = (paymentMethod: PaymentMethod) => paymentMethod === 'transfer' || paymentMethod === 'cash';

  const getPaymentLabel = (paymentMethod: PaymentMethod) => {
    if (paymentMethod === 'transfer') return 'Banco';
    if (paymentMethod === 'cash') return 'Efectivo';
    return 'Pendiente';
  };

  // Filtrar reservas
  const filteredReservations = reservations.filter(res => {
    // Filtro por propietario
    if (selectedOwnerId !== 'all') {
      const prop = properties.find(p => String(p.id) === String(res.propertyId));
      if (!prop || String(prop.owner) !== selectedOwnerId) return false;
    }

    // Filtro por propiedad
    if (selectedPropertyId !== 'all') {
      if (String(res.propertyId) !== selectedPropertyId) return false;
    }

    // Filtro por rango de fechas (check-in)
    if (startDate) {
      const resStart = new Date(res.startDate);
      const filterStart = new Date(startDate);
      if (resStart < filterStart) return false;
    }

    if (endDate) {
      const resStart = new Date(res.startDate);
      const filterEnd = new Date(endDate);
      if (resStart > filterEnd) return false;
    }

    // Filtro por gestor
    if (selectedManagerId !== 'all') {
      const prop = properties.find(p => String(p.id) === String(res.propertyId));
      if (selectedManagerId === 'unassigned') {
        if (prop?.managerId) return false;
      } else {
        if (!prop || String(prop.managerId) !== selectedManagerId) return false;
      }
    }

    // Filtro por estado de cobro
    if (paymentFilter !== 'all') {
      if (paymentFilter === 'pending' && res.paymentMethod !== 'pending') return false;
      if (paymentFilter === 'transfer' && res.paymentMethod !== 'transfer') return false;
      if (paymentFilter === 'cash' && res.paymentMethod !== 'cash') return false;
      if (paymentFilter === 'cash_pending_delivery') {
        if (res.paymentMethod !== 'cash' || res.cashDelivered) return false;
      }
    }

    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'amount':
        return (Number(b.price) || 0) - (Number(a.price) || 0);
      case 'guest': {
        const guestA = guests.find(g => String(g.id) === String(a.guestId));
        const guestB = guests.find(g => String(g.id) === String(b.guestId));
        const nameA = guestA ? `${guestA.name} ${guestA.surname}`.trim() : '';
        const nameB = guestB ? `${guestB.name} ${guestB.surname}`.trim() : '';
        return nameA.localeCompare(nameB);
      }
      case 'date':
      default:
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    }
  });

  const totalPending = filteredReservations
    .filter(res => res.paymentMethod === 'pending')
    .reduce((sum, res) => sum + (Number(res.price) || 0), 0);

  const totalPaidBank = filteredReservations
    .filter(res => res.paymentMethod === 'transfer')
    .reduce((sum, res) => sum + (Number(res.price) || 0), 0);

  const totalPaidCash = filteredReservations
    .filter(res => res.paymentMethod === 'cash')
    .reduce((sum, res) => sum + (Number(res.price) || 0), 0);

  const totalCashDelivered = filteredReservations
    .filter(res => res.paymentMethod === 'cash' && res.cashDelivered)
    .reduce((sum, res) => sum + (Number(res.price) || 0), 0);

  const totalCashPendingDelivery = totalPaidCash - totalCashDelivered;

  const handleEditReservation = (res: Reservation) => {
    setEditingReservation(res);
    setIsModalOpen(true);
  };

  const handleSaveReservation = async (updatedRes: Reservation) => {
    try {
      await db.saveReservation(updatedRes);
      const updated = await db.getReservations();
      setReservations(updated);
      setIsModalOpen(false);
      setEditingReservation(null);
    } catch (err: any) {
      alert(err?.message || 'Error al guardar la reserva');
    }
  };

  const handleReservationUpdated = (updatedRes: Reservation) => {
    setReservations(prev => prev.map(r => String(r.id) === String(updatedRes.id) ? { ...r, ...updatedRes } : r));
    setEditingReservation(updatedRes);
  };

  const handleCashDeliveredToggle = async (res: Reservation) => {
    try {
      const newValue = !res.cashDelivered;
      await db.updateReservationFields(String(res.id), { cashDelivered: newValue });
      const updated = await db.getReservations();
      setReservations(updated);
    } catch (err) {
      console.error('Error updating cash delivered:', err);
      alert('No se pudo actualizar el estado de entrega de efectivo.');
    }
  };

  const managerSummaries = managers.map(manager => {
    const propIds = new Set(properties.filter(p => String(p.managerId) === String(manager.id)).map(p => String(p.id)));
    const managerReservations = filteredReservations.filter(r => propIds.has(String(r.propertyId)));
    const cashPaid = managerReservations.filter(r => r.paymentMethod === 'cash')
      .reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    const cashDelivered = managerReservations.filter(r => r.paymentMethod === 'cash' && r.cashDelivered)
      .reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    const unpaid = managerReservations.filter(r => r.paymentMethod === 'pending')
      .reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    return {
      id: String(manager.id),
      name: manager.name,
      cashPaid,
      cashDelivered,
      cashPending: cashPaid - cashDelivered,
      unpaid
    };
  });

  const unassignedSummary = (() => {
    const assignedPropIds = new Set(properties.filter(p => p.managerId).map(p => String(p.id)));
    const unassignedReservations = filteredReservations.filter(r => !assignedPropIds.has(String(r.propertyId)));
    if (unassignedReservations.length === 0) return null;
    const cashPaid = unassignedReservations.filter(r => r.paymentMethod === 'cash')
      .reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    const cashDelivered = unassignedReservations.filter(r => r.paymentMethod === 'cash' && r.cashDelivered)
      .reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    const unpaid = unassignedReservations.filter(r => r.paymentMethod === 'pending')
      .reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    return {
      id: 'unassigned',
      name: 'Sin asignar',
      cashPaid,
      cashDelivered,
      cashPending: cashPaid - cashDelivered,
      unpaid
    };
  })();

  const handleDeleteReservation = async (id: string) => {
    try {
      await db.deleteReservation(id);
      const updated = await db.getReservations();
      setReservations(updated);
      setIsModalOpen(false);
      setEditingReservation(null);
    } catch (err: any) {
      alert(err?.message || 'Error al eliminar la reserva');
    }
  };

  const handleExportExcel = () => {
    const rows = filteredReservations.map(res => {
      const paid = isPaid(res.paymentMethod);
      return {
        Huésped: getGuestName(res.guestId),
        Gestor: getManagerName(res.propertyId),
        Propietario: getOwnerName(res.propertyId),
        Propiedad: getPropertyName(res.propertyId),
        'Check-in': new Date(res.startDate).toLocaleDateString('es-ES'),
        'Check-out': new Date(res.endDate).toLocaleDateString('es-ES'),
        Importe: Number(res.price || 0),
        Estado: paid ? 'Abonada' : 'Pendiente',
        'Método de pago': paid ? getPaymentLabel(res.paymentMethod) : 'Pendiente',
        'Efectivo entregado': res.paymentMethod === 'cash' ? (res.cashDelivered ? 'Sí' : 'No') : '-',
        Factura: paid ? (res.invoiceNumber || 'Sin factura') : '-',
        Notas: res.notes || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reservas');

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `reservas_filtradas_${today}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Reservas</h1>
          <p className="text-sm text-gray-500 mt-1">Pendientes y abonadas</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div onClick={() => { setPaymentFilter('pending'); setSelectedManagerId('all'); }} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-all">
            <div className="text-xs font-bold text-yellow-600 uppercase">Pendiente Cobro</div>
            <div className="text-2xl font-black text-yellow-700">€{totalPending.toFixed(2)}</div>
          </div>
          <div onClick={() => { setPaymentFilter('transfer'); setSelectedManagerId('all'); }} className="bg-blue-50 border border-blue-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-all">
            <div className="text-xs font-bold text-blue-600 uppercase">Abonado Banco</div>
            <div className="text-2xl font-black text-blue-700">€{totalPaidBank.toFixed(2)}</div>
          </div>
          <div onClick={() => { setPaymentFilter('cash'); setSelectedManagerId('all'); }} className="bg-green-50 border border-green-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-all">
            <div className="text-xs font-bold text-green-600 uppercase">Abonado Efectivo</div>
            <div className="text-2xl font-black text-green-700">€{totalPaidCash.toFixed(2)}</div>
          </div>
          <div onClick={() => { setPaymentFilter('cash_pending_delivery'); setSelectedManagerId('all'); }} className="bg-amber-50 border border-amber-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-all">
            <div className="text-xs font-bold text-amber-600 uppercase">Efectivo Pendiente Entrega</div>
            <div className="text-2xl font-black text-amber-700">€{totalCashPendingDelivery.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {(managerSummaries.length > 0 || unassignedSummary) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-sm font-black text-gray-700 uppercase">Resumen por Gestor</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Gestor</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">Efectivo Cobrado</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">Efectivo Entregado</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">Efectivo Pendiente</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">Pendiente Cobro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {managerSummaries.map(summary => (
                  <tr key={summary.id}>
                    <td className="px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:text-blue-600" onClick={() => { setSelectedManagerId(summary.id); setPaymentFilter('all'); }}>{summary.name}</td>
                    <td className="px-4 py-3 text-right text-gray-700 cursor-pointer hover:text-blue-600" onClick={() => { setSelectedManagerId(summary.id); setPaymentFilter('cash'); }}>€{summary.cashPaid.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-700 cursor-pointer hover:text-blue-600" onClick={() => { setSelectedManagerId(summary.id); setPaymentFilter('cash'); }}>€{summary.cashDelivered.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-amber-700 font-semibold cursor-pointer hover:text-blue-600" onClick={() => { setSelectedManagerId(summary.id); setPaymentFilter('cash_pending_delivery'); }}>€{summary.cashPending.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-yellow-700 font-semibold cursor-pointer hover:text-blue-600" onClick={() => { setSelectedManagerId(summary.id); setPaymentFilter('pending'); }}>€{summary.unpaid.toFixed(2)}</td>
                  </tr>
                ))}
                {unassignedSummary && (
                  <tr>
                    <td className="px-4 py-3 font-semibold text-gray-500 cursor-pointer hover:text-blue-600" onClick={() => { setSelectedManagerId('unassigned'); setPaymentFilter('all'); }}>{unassignedSummary.name}</td>
                    <td className="px-4 py-3 text-right text-gray-500 cursor-pointer hover:text-blue-600" onClick={() => { setSelectedManagerId('unassigned'); setPaymentFilter('cash'); }}>€{unassignedSummary.cashPaid.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 cursor-pointer hover:text-blue-600" onClick={() => { setSelectedManagerId('unassigned'); setPaymentFilter('cash'); }}>€{unassignedSummary.cashDelivered.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 cursor-pointer hover:text-blue-600" onClick={() => { setSelectedManagerId('unassigned'); setPaymentFilter('cash_pending_delivery'); }}>€{unassignedSummary.cashPending.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 cursor-pointer hover:text-blue-600" onClick={() => { setSelectedManagerId('unassigned'); setPaymentFilter('pending'); }}>€{unassignedSummary.unpaid.toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          {/* Propietario */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Propietario</label>
            <select
              value={selectedOwnerId}
              onChange={(e) => {
                setSelectedOwnerId(e.target.value);
                setSelectedPropertyId('all');
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              {owners.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          {/* Gestor */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Gestor</label>
            <select
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              {managers.map(m => (
                <option key={m.id} value={String(m.id)}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Propiedad */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Propiedad</label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas</option>
              {selectedOwnerId === 'all'
                ? properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))
                : getPropertiesForOwner(selectedOwnerId).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))
              }
            </select>
          </div>

          {/* Desde */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Hasta */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Ordenar por */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Ordenar por</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Fecha Check-in</option>
              <option value="amount">Importe (Mayor)</option>
              <option value="guest">Huésped (A-Z)</option>
            </select>
          </div>

          {/* Estado de cobro */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Estado de cobro</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas</option>
              <option value="pending">Pendientes de cobro</option>
              <option value="transfer">Abonadas banco</option>
              <option value="cash">Abonado efectivo</option>
              <option value="cash_pending_delivery">Efectivo pendiente de entrega</option>
            </select>
          </div>
        </div>

        {/* Botón Limpiar filtros */}
        <div className="flex flex-wrap justify-end gap-3">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold uppercase hover:bg-emerald-700"
          >
            Descargar Excel
          </button>
          <button
            onClick={() => {
              setSelectedOwnerId('all');
              setSelectedPropertyId('all');
              setSelectedManagerId('all');
              setStartDate('');
              setEndDate('');
              setSortBy('date');
              setPaymentFilter('all');
            }}
            className="text-xs font-bold text-gray-500 hover:text-gray-700 uppercase"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Tabla de Reservas */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="inline-block animate-spin">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-500 mt-2">Cargando datos...</p>
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p className="text-gray-500 font-semibold">No hay reservas</p>
          <p className="text-sm text-gray-400">No hay reservas que coincidan con los filtros</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Huésped</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Gestor</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Propietario</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Propiedad</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Check-in</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Check-out</th>
                  <th className="px-6 py-3 text-right text-xs font-black text-gray-600 uppercase tracking-wider">Importe</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Método</th>
                  <th className="px-6 py-3 text-center text-xs font-black text-gray-600 uppercase tracking-wider">Efectivo Entregado</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Factura</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Notas</th>
                  <th className="px-6 py-3 text-center text-xs font-black text-gray-600 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReservations.map((res) => {
                  const paid = isPaid(res.paymentMethod);
                  return (
                    <tr
                      key={res.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onDoubleClick={() => handleEditReservation(res)}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{getGuestName(res.guestId)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{getManagerName(res.propertyId)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{getOwnerName(res.propertyId)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{getPropertyName(res.propertyId)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(res.startDate).toLocaleDateString('es-ES')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(res.endDate).toLocaleDateString('es-ES')}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-right">
                        <span className={paid ? 'text-green-600' : 'text-red-600'}>€{Number(res.price || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          paid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {paid ? 'Abonada' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {paid ? getPaymentLabel(res.paymentMethod) : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {res.paymentMethod === 'cash' ? (
                          <input
                            type="checkbox"
                            checked={!!res.cashDelivered}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleCashDeliveredToggle(res);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 text-emerald-600 rounded border-gray-300"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        {paid ? (
                          res.invoiceNumber ? (
                            <a
                              href={`/api/invoices/${res.invoiceNumber.replace('/', '-')}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {res.invoiceNumber}
                            </a>
                          ) : (
                            <span className="text-gray-400">Sin factura</span>
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{res.notes || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditReservation(res);
                          }}
                          className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={6} className="px-6 py-3 text-right text-xs font-black text-gray-600 uppercase">Total</td>
                  <td className="px-6 py-3 text-right text-sm font-black text-gray-900">€{filteredReservations.reduce((sum, r) => sum + (Number(r.price) || 0), 0).toFixed(2)}</td>
                  <td colSpan={6}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Modal de edición */}
      {isModalOpen && editingReservation && (
        <ReservationModal
          rooms={rooms}
          propertyId={String(editingReservation.propertyId ?? (selectedPropertyId === 'all' ? (rooms[0]?.propertyId ?? '') : selectedPropertyId))}
          initialReservation={editingReservation}
          initialData={null}
          onClose={() => {
            setIsModalOpen(false);
            setEditingReservation(null);
          }}
          onSave={handleSaveReservation}
          onDelete={handleDeleteReservation}
          onReservationUpdated={handleReservationUpdated}
        />
      )}
    </div>
  );
};
