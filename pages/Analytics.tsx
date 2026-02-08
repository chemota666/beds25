import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { AnalyticsService, KPI, OccupancyData, RevenueData, PropertyMetrics, OwnerMetrics } from '../services/analytics';
import { Reservation, Property, Owner } from '../types';

export const Analytics: React.FC = () => {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [occupancyData, setOccupancyData] = useState<OccupancyData[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [propertyMetrics, setPropertyMetrics] = useState<PropertyMetrics[]>([]);
  const [ownerMetrics, setOwnerMetrics] = useState<OwnerMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'kpis' | 'occupancy' | 'revenue' | 'properties' | 'owners'>('kpis');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true);
      try {
        const [reservations, properties, owners] = await Promise.all([
          db.getReservations(),
          db.getProperties(),
          db.getOwners()
        ]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Analytics & Reportes</h1>
          <p className="text-sm text-gray-500">Dashboard de KPIs, ocupación e ingresos.</p>
        </div>
        <button 
          disabled={loading}
          onClick={() => window.location.reload()}
          className={`${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all flex items-center`}
        >
          {loading ? (
            <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Cargando...</>
          ) : (
            '🔄 Actualizar'
          )}
        </button>
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
          onClick={() => setActiveTab('occupancy')}
          className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'occupancy'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          📅 Ocupación
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
          onClick={() => setActiveTab('properties')}
          className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'properties'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          🏠 Propiedades
        </button>
        <button
          onClick={() => setActiveTab('owners')}
          className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'owners'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          👤 Propietarios
        </button>
      </div>

      {/* TAB 1: KPIs */}
      {activeTab === 'kpis' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpis.map((kpi, idx) => (
              <div key={idx} className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3 hover:shadow-md transition-all`}>
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{kpi.icon || '📊'}</span>
                  <span className={`text-xs font-black px-2 py-1 rounded-lg ${
                    kpi.color === 'green' ? 'bg-green-100 text-green-700' :
                    kpi.color === 'red' ? 'bg-red-100 text-red-700' :
                    kpi.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                    kpi.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {kpi.label}
                  </span>
                </div>
                <div>
                  <p className="text-3xl font-black text-gray-800">{kpi.value}</p>
                  {kpi.trend !== undefined && (
                    <p className={`text-xs font-bold mt-1 ${kpi.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {kpi.trend >= 0 ? '↑' : '↓'} {Math.abs(kpi.trend).toFixed(1)}% vs mes anterior
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: OCUPACIÓN */}
      {activeTab === 'occupancy' && (
        <div className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-800">Ocupación Últimos 30 Días</h2>
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
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Habitaciones Ocupadas</th>
                  <th className="px-4 py-3">Total de Habitaciones</th>
                  <th className="px-4 py-3">Ocupación %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {occupancyData.map((data, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{data.date}</td>
                    <td className="px-4 py-3 text-gray-700">{data.booked}</td>
                    <td className="px-4 py-3 text-gray-700">{data.total}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${data.occupancy}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 font-bold text-gray-800">{data.occupancy.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INGRESOS */}
      {activeTab === 'revenue' && (
        <div className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-800">Ingresos Últimos 30 Días</h2>
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
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Ingresos</th>
                  <th className="px-4 py-3">Num. Reservas</th>
                  <th className="px-4 py-3">Ingreso Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {revenueData.map((data, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{data.date}</td>
                    <td className="px-4 py-3 font-bold text-green-600">{data.revenue.toFixed(2)}€</td>
                    <td className="px-4 py-3 text-gray-700">{data.reservations}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {data.reservations > 0 ? (data.revenue / data.reservations).toFixed(2) : '0.00'}€
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PROPIEDADES */}
      {activeTab === 'properties' && (
        <div className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-800">Métricas por Propiedad</h2>
            <button
              onClick={() => handleExportCSV('properties')}
              className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center"
            >
              📥 Exportar CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="px-4 py-3">Propiedad</th>
                  <th className="px-4 py-3">Ocupación</th>
                  <th className="px-4 py-3">Reservas</th>
                  <th className="px-4 py-3">Ingresos</th>
                  <th className="px-4 py-3">Promedio/Reserva</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {propertyMetrics.map((metric) => (
                  <tr key={metric.propertyId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-800">{metric.propertyName}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: `${metric.occupancy}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 font-bold text-gray-800">{metric.occupancy.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{metric.reservations}</td>
                    <td className="px-4 py-3 font-bold text-green-600">{metric.revenue.toFixed(2)}€</td>
                    <td className="px-4 py-3 text-gray-700">{metric.averagePrice.toFixed(2)}€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PROPIETARIOS */}
      {activeTab === 'owners' && (
        <div className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-800">Métricas por Propietario</h2>
            <button
              onClick={() => handleExportCSV('owners')}
              className="text-sm font-bold text-orange-600 hover:text-orange-700 flex items-center"
            >
              📥 Exportar CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="px-4 py-3">Propietario</th>
                  <th className="px-4 py-3">Propiedades</th>
                  <th className="px-4 py-3">Reservas</th>
                  <th className="px-4 py-3">Ingresos</th>
                  <th className="px-4 py-3">Comisión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ownerMetrics.map((metric) => (
                  <tr key={metric.ownerId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-800">{metric.ownerName}</td>
                    <td className="px-4 py-3 text-gray-700">{metric.properties}</td>
                    <td className="px-4 py-3 text-gray-700">{metric.reservations}</td>
                    <td className="px-4 py-3 font-bold text-green-600">{metric.revenue.toFixed(2)}€</td>
                    <td className="px-4 py-3 font-bold text-orange-600">{metric.commission.toFixed(2)}€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
