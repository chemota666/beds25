import { Reservation, Guest, Property, Owner } from '../types';

export interface KPI {
  label: string;
  value: string | number;
  trend?: number; // porcentaje de cambio
  icon?: string;
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple';
}

export interface OccupancyData {
  date: string;
  occupancy: number;
  booked: number;
  total: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  reservations: number;
}

export interface PropertyMetrics {
  propertyId: string;
  propertyName: string;
  occupancy: number;
  revenue: number;
  reservations: number;
  averagePrice: number;
}

export interface OwnerMetrics {
  ownerId: string;
  ownerName: string;
  revenue: number;
  commission: number;
  reservations: number;
  properties: number;
}

export class AnalyticsService {
  /**
   * Calcular KPIs generales del sistema
   */
  static calculateKPIs(
    reservations: Reservation[],
    properties: Property[],
    owners: Owner[]
  ): KPI[] {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Reservas este mes
    const thisMonthReservations = reservations.filter(r => {
      const start = new Date(r.startDate);
      return start.getMonth() === currentMonth && start.getFullYear() === currentYear;
    });

    // Ingresos este mes
    const thisMonthRevenue = thisMonthReservations.reduce((sum, r) => sum + (r.amount || 0), 0);

    // Ocupación promedio
    const avgOccupancy = this.calculateAverageOccupancy(reservations, properties);

    // Huéspedes únicos
    const uniqueGuests = new Set(reservations.map(r => r.guestId)).size;

    // Reservas pendientes de pago
    const pendingPayments = reservations.filter(r => r.status !== 'paid').length;

    return [
      {
        label: 'Ingresos Este Mes',
        value: `${thisMonthRevenue.toFixed(2)}€`,
        icon: '💰',
        color: 'green'
      },
      {
        label: 'Reservas Este Mes',
        value: thisMonthReservations.length,
        icon: '📅',
        color: 'blue'
      },
      {
        label: 'Ocupación Promedio',
        value: `${avgOccupancy.toFixed(1)}%`,
        icon: '📊',
        color: 'purple'
      },
      {
        label: 'Huéspedes Únicos',
        value: uniqueGuests,
        icon: '👥',
        color: 'orange'
      },
      {
        label: 'Pagos Pendientes',
        value: pendingPayments,
        icon: '⏳',
        color: 'red'
      },
      {
        label: 'Propiedades Activas',
        value: properties.length,
        icon: '🏠',
        color: 'blue'
      }
    ];
  }

  /**
   * Calcular ocupación promedio del período
   */
  static calculateAverageOccupancy(reservations: Reservation[], properties: Property[]): number {
    if (properties.length === 0) return 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const daysInMonth = endOfMonth.getDate();
    let totalOccupancy = 0;

    properties.forEach(prop => {
      const propReservations = reservations.filter(r => r.propertyId === prop.id);
      let occupiedDays = 0;

      propReservations.forEach(res => {
        const start = new Date(res.startDate);
        const end = new Date(res.endDate);

        if (start <= endOfMonth && end >= startOfMonth) {
          const resStart = Math.max(start.getTime(), startOfMonth.getTime());
          const resEnd = Math.min(end.getTime(), endOfMonth.getTime());
          const days = Math.ceil((resEnd - resStart) / (1000 * 60 * 60 * 24));
          occupiedDays += Math.max(0, days);
        }
      });

      const propOccupancy = (occupiedDays / daysInMonth) * 100;
      totalOccupancy += Math.min(propOccupancy, 100);
    });

    return totalOccupancy / properties.length;
  }

  /**
   * Datos de ocupación diaria para gráfico
   */
  static getOccupancyTimeSeries(
    reservations: Reservation[],
    properties: Property[],
    days: number = 30
  ): OccupancyData[] {
    const data: OccupancyData[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      let bookedRooms = 0;
      const totalRooms = properties.reduce((sum, p) => sum + p.numRooms, 0);

      reservations.forEach(res => {
        const start = new Date(res.startDate);
        const end = new Date(res.endDate);
        if (start <= date && end > date) {
          bookedRooms++;
        }
      });

      data.push({
        date: dateStr,
        booked: bookedRooms,
        total: totalRooms,
        occupancy: totalRooms > 0 ? (bookedRooms / totalRooms) * 100 : 0
      });
    }

    return data;
  }

  /**
   * Datos de ingresos para gráfico
   */
  static getRevenueTimeSeries(
    reservations: Reservation[],
    days: number = 30
  ): RevenueData[] {
    const data: { [key: string]: { revenue: number; reservations: number } } = {};
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      data[dateStr] = { revenue: 0, reservations: 0 };
    }

    reservations.forEach(res => {
      const startDate = res.invoiceDate || res.startDate;
      const dateStr = startDate.split('T')[0];

      if (data[dateStr]) {
        data[dateStr].revenue += res.amount || 0;
        data[dateStr].reservations += 1;
      }
    });

    return Object.entries(data).map(([date, { revenue, reservations }]) => ({
      date,
      revenue,
      reservations
    }));
  }

  /**
   * Métricas por propiedad
   */
  static getPropertyMetrics(
    reservations: Reservation[],
    properties: Property[],
    owners: Owner[]
  ): PropertyMetrics[] {
    return properties.map(prop => {
      const propReservations = reservations.filter(r => r.propertyId === prop.id);
      const revenue = propReservations.reduce((sum, r) => sum + (r.amount || 0), 0);
      const avgPrice = propReservations.length > 0 ? revenue / propReservations.length : 0;

      // Calcular ocupación
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const daysInMonth = endOfMonth.getDate();

      let occupiedDays = 0;
      propReservations.forEach(res => {
        const start = new Date(res.startDate);
        const end = new Date(res.endDate);

        if (start <= endOfMonth && end >= startOfMonth) {
          const resStart = Math.max(start.getTime(), startOfMonth.getTime());
          const resEnd = Math.min(end.getTime(), endOfMonth.getTime());
          const days = Math.ceil((resEnd - resStart) / (1000 * 60 * 60 * 24));
          occupiedDays += Math.max(0, days);
        }
      });

      const occupancy = (occupiedDays / daysInMonth) * 100;

      return {
        propertyId: prop.id,
        propertyName: prop.name,
        occupancy: Math.min(occupancy, 100),
        revenue,
        reservations: propReservations.length,
        averagePrice: avgPrice
      };
    });
  }

  /**
   * Métricas por propietario
   */
  static getOwnerMetrics(
    reservations: Reservation[],
    properties: Property[],
    owners: Owner[]
  ): OwnerMetrics[] {
    return owners.map(owner => {
      const ownerProperties = properties.filter(p => p.owner === owner.id);
      const ownerReservations = reservations.filter(r =>
        ownerProperties.some(p => p.id === r.propertyId)
      );

      const revenue = ownerReservations.reduce((sum, r) => sum + (r.amount || 0), 0);
      const commission = (revenue * (owner.commission || 0)) / 100;

      return {
        ownerId: owner.id,
        ownerName: owner.name,
        revenue,
        commission,
        reservations: ownerReservations.length,
        properties: ownerProperties.length
      };
    });
  }

  /**
   * Exportar datos a CSV
   */
  static exportToCSV(
    data: any[],
    filename: string
  ): void {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
