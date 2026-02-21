import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../services/db';
import { Owner } from '../types';

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  reservationId: string;
  createdAt: string;
  invoiceDate: string;
  startDate: string;
  endDate: string;
  price: number;
  paymentMethod: string;
  guestName: string;
  guestSurname: string;
  guestDni: string;
  propertyId: string;
  propertyName: string;
  ownerId: string;
  ownerName: string;
  ownerTaxId: string;
}

const getPdfUrl = (invoiceNumber: string) => `/api/invoices/${invoiceNumber.replace('/', '-')}/pdf`;

const calcIva = (price: number) => {
  const total = Number(price) || 0;
  const base = +(total / 1.10).toFixed(2);
  const iva = +(total - base).toFixed(2);
  return { base, iva, total };
};

export const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);

  // Display filters
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Sort
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Batch generation filters
  const [batchFromDate, setBatchFromDate] = useState<string>('');
  const [batchToDate, setBatchToDate] = useState<string>('');
  const [batchOwnerId, setBatchOwnerId] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [invList, ownerList] = await Promise.all([
          db.getInvoices(),
          db.getOwners()
        ]);
        setInvoices(invList);
        setOwners(ownerList);
      } catch (err) {
        console.error('Error loading invoices:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (selectedOwnerId !== 'all' && String(inv.ownerId) !== selectedOwnerId) return false;
      const invDate = inv.invoiceDate || '';
      if (startDate && invDate < startDate) return false;
      if (endDate && invDate > endDate) return false;
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        const match =
          `${inv.guestName} ${inv.guestSurname}`.toLowerCase().includes(lower) ||
          inv.invoiceNumber.toLowerCase().includes(lower) ||
          inv.propertyName.toLowerCase().includes(lower) ||
          (inv.guestDni || '').toLowerCase().includes(lower);
        if (!match) return false;
      }
      return true;
    });
  }, [invoices, selectedOwnerId, startDate, endDate, searchTerm]);

  const totals = useMemo(() => {
    let base = 0, iva = 0, total = 0;
    filteredInvoices.forEach(inv => {
      const calc = calcIva(Number(inv.price) || 0);
      base += calc.base;
      iva += calc.iva;
      total += calc.total;
    });
    return { base: +base.toFixed(2), iva: +iva.toFixed(2), total: +total.toFixed(2) };
  }, [filteredInvoices]);

  const sortedInvoices = useMemo(() => {
    return [...filteredInvoices].sort((a, b) => {
      const aParts = a.invoiceNumber.split('/');
      const bParts = b.invoiceNumber.split('/');
      const aSeries = aParts[0] || '';
      const bSeries = bParts[0] || '';
      const aSeq = Number(aParts[1]) || 0;
      const bSeq = Number(bParts[1]) || 0;
      const cmp = aSeries.localeCompare(bSeries) || aSeq - bSeq;
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredInvoices, sortAsc]);

  const handleBatchGenerate = async () => {
    const filters: { fromDate?: string; toDate?: string; ownerId?: string } = {};
    if (batchFromDate) filters.fromDate = batchFromDate;
    if (batchToDate) filters.toDate = batchToDate;
    if (batchOwnerId !== 'all') filters.ownerId = batchOwnerId;

    const count = await db.getPendingInvoiceCount(filters);
    if (count === 0) {
      alert('No hay reservas pendientes de facturar con los filtros seleccionados.');
      return;
    }

    const filterDesc = [];
    if (batchFromDate) filterDesc.push(`desde ${batchFromDate}`);
    if (batchToDate) filterDesc.push(`hasta ${batchToDate}`);
    if (batchOwnerId !== 'all') {
      const ownerName = owners.find(o => String(o.id) === batchOwnerId)?.name || batchOwnerId;
      filterDesc.push(`propietario: ${ownerName}`);
    }
    const filterText = filterDesc.length > 0 ? ` (${filterDesc.join(', ')})` : '';

    if (!confirm(`Se van a generar ${count} facturas${filterText}. ¿Continuar?`)) return;

    setBatchLoading(true);
    try {
      const result = await db.generateBatchInvoices(filters);
      alert(`Facturas generadas: ${result.generated}${result.errors.length > 0 ? `\nErrores: ${result.errors.length}` : ''}`);
      const updated = await db.getInvoices();
      setInvoices(updated);
    } catch (err: any) {
      alert('Error: ' + (err?.message || 'Error desconocido'));
    } finally {
      setBatchLoading(false);
    }
  };

  const handleExportExcel = () => {
    const rows = filteredInvoices.map(inv => {
      const { base, iva, total } = calcIva(inv.price);
      return {
        'N\u00ba Factura': inv.invoiceNumber,
        'Fecha': inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('es-ES') : '',
        'Huesped': `${inv.guestName} ${inv.guestSurname}`.trim(),
        'DNI': inv.guestDni || '',
        'Propiedad': inv.propertyName,
        'Propietario': inv.ownerName,
        'Base Imponible': base,
        'IVA 10%': iva,
        'Total': total,
        'Metodo': inv.paymentMethod === 'transfer' ? 'Banco' : inv.paymentMethod === 'cash' ? 'Efectivo' : inv.paymentMethod,
        'Periodo': `${inv.startDate ? new Date(inv.startDate).toLocaleDateString('es-ES') : ''} - ${inv.endDate ? new Date(inv.endDate).toLocaleDateString('es-ES') : ''}`
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
    XLSX.writeFile(wb, `facturas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const clearFilters = () => {
    setSelectedOwnerId('all');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Facturas</h1>
          <p className="text-sm text-gray-500 mt-1">Listado de facturas emitidas</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="text-xs font-bold text-green-600 uppercase">Base Imponible</div>
            <div className="text-xl font-black text-green-700">{'\u20AC'}{totals.base.toFixed(2)}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="text-xs font-bold text-orange-600 uppercase">IVA 10%</div>
            <div className="text-xl font-black text-orange-700">{'\u20AC'}{totals.iva.toFixed(2)}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="text-xs font-bold text-purple-600 uppercase">Total Facturado</div>
            <div className="text-xl font-black text-purple-700">{'\u20AC'}{totals.total.toFixed(2)}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs font-bold text-blue-600 uppercase">Facturas</div>
            <div className="text-xl font-black text-blue-700">{filteredInvoices.length}</div>
          </div>
        </div>
      </div>

      {/* Batch generation panel */}
      <div className="bg-purple-50 rounded-2xl shadow-sm border border-purple-200 p-6 space-y-4">
        <h2 className="text-sm font-black text-purple-700 uppercase tracking-wide">Generar facturas pendientes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-purple-500 uppercase mb-2">Propietario</label>
            <select
              value={batchOwnerId}
              onChange={(e) => setBatchOwnerId(e.target.value)}
              className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todos</option>
              {owners.map(o => (
                <option key={o.id} value={String(o.id)}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-purple-500 uppercase mb-2">Fecha Desde</label>
            <input
              type="date"
              value={batchFromDate}
              onChange={(e) => setBatchFromDate(e.target.value)}
              className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-purple-500 uppercase mb-2">Fecha Hasta</label>
            <input
              type="date"
              value={batchToDate}
              onChange={(e) => setBatchToDate(e.target.value)}
              className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleBatchGenerate}
              disabled={batchLoading}
              className="w-full px-5 py-2.5 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
            >
              {batchLoading ? 'Generando...' : 'Generar facturas'}
            </button>
          </div>
        </div>
      </div>

      {/* Display Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Propietario</label>
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              {owners.map(o => (
                <option key={o.id} value={String(o.id)}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Fecha Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Fecha Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Buscar</label>
            <input
              type="text"
              placeholder="Nombre, DNI, propiedad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={clearFilters} className="flex-1 px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              Limpiar
            </button>
            <button
              onClick={handleExportExcel}
              className="flex-1 px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-sm text-gray-400">No hay facturas que coincidan con los filtros</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider cursor-pointer select-none hover:text-purple-700" onClick={() => setSortAsc(!sortAsc)}>N{'\u00ba'} Factura {sortAsc ? '\u25B2' : '\u25BC'}</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Huesped</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Propietario</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Propiedad</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Periodo</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-gray-600 uppercase tracking-wider">Base</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-gray-600 uppercase tracking-wider">IVA 10%</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-gray-600 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-black text-gray-600 uppercase tracking-wider">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedInvoices.map((inv) => {
                  const { base, iva, total } = calcIva(inv.price);
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 text-sm font-bold text-purple-700">{inv.invoiceNumber}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('es-ES') : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                        {`${inv.guestName} ${inv.guestSurname}`.trim()}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{inv.ownerName}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{inv.propertyName}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {inv.startDate ? new Date(inv.startDate).toLocaleDateString('es-ES') : ''} - {inv.endDate ? new Date(inv.endDate).toLocaleDateString('es-ES') : ''}
                      </td>
                      <td className="px-4 py-4 text-sm text-right text-gray-700">
                        {'\u20AC'}{base.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-sm text-right text-orange-600">
                        {'\u20AC'}{iva.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-right text-green-600">
                        {'\u20AC'}{total.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <a
                          href={getPdfUrl(inv.invoiceNumber)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          title="Descargar PDF"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
