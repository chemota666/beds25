import { RowDataPacket, ResultSetHeader } from 'mysql2';
import mysql from 'mysql2/promise';
import { OwnersService } from './ownersService';

export interface Invoice {
  id: number;
  reservationId: number;
  invoiceNumber: string;
  issueDate: Date;
  paidDate: Date;
  amount: number;
  paymentMethod: 'cash' | 'bank';
  createdAt?: Date;
}

export interface MarkPaidAndInvoiceDTO {
  reservationId: number;
  paymentMethod: 'cash' | 'bank';
  amount: number;
}

export class InvoicesService {
  constructor(
    private pool: mysql.Pool,
    private ownersService: OwnersService
  ) {}

  /**
   * OPERACIÓN CRÍTICA: Marcar reserva como pagada y generar factura
   * Todo se ejecuta en una transacción atómica para evitar:
   * - Facturas duplicadas
   * - Saltos en numeración
   * - Inconsistencias entre reserva y factura
   * 
   * Usa SELECT ... FOR UPDATE en owner para lock de numeración
   */
  async markPaidAndCreateInvoice(data: MarkPaidAndInvoiceDTO): Promise<Invoice> {
    const conn = await this.pool.getConnection();
    
    try {
      await conn.beginTransaction();

      // 1. Obtener la reserva y verificar estado
      const [reservations] = await conn.query<RowDataPacket[]>(
        'SELECT r.*, p.ownerId FROM reservations r JOIN properties p ON r.propertyId = p.id WHERE r.id = ? FOR UPDATE',
        [data.reservationId]
      );

      if (reservations.length === 0) {
        throw new Error('Reservation not found');
      }

      const reservation = reservations[0];

      if (reservation.status === 'paid') {
        throw new Error('Reservation is already paid');
      }

      const ownerId = reservation.ownerId;

      // 2. Generar número de factura (con lock atómico en owner)
      const invoiceNumber = await this.ownersService.incrementInvoiceNumber(ownerId, conn);

      // 3. Crear factura
      const now = new Date();
      const [invoiceResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO invoices (reservationId, invoiceNumber, issueDate, paidDate, amount, paymentMethod)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [data.reservationId, invoiceNumber, now, now, data.amount, data.paymentMethod]
      );

      // 4. Actualizar reserva a 'paid'
      await conn.query(
        'UPDATE reservations SET status = ?, paymentMethod = ? WHERE id = ?',
        ['paid', data.paymentMethod, data.reservationId]
      );

      await conn.commit();

      // 5. Obtener la factura creada
      const [invoices] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM invoices WHERE id = ?',
        [invoiceResult.insertId]
      );

      return invoices[0] as Invoice;

    } catch (error) {
      await conn.rollback();
      console.error('Error in markPaidAndCreateInvoice:', error);
      throw error;
    } finally {
      conn.release();
    }
  }

  async getInvoiceById(id: number): Promise<Invoice | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT * FROM invoices WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as Invoice) : null;
  }

  async getInvoicesByReservation(reservationId: number): Promise<Invoice[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT * FROM invoices WHERE reservationId = ? ORDER BY issueDate DESC',
      [reservationId]
    );
    return rows as Invoice[];
  }

  async getAllInvoices(limit: number = 100, offset: number = 0): Promise<Invoice[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT * FROM invoices ORDER BY issueDate DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return rows as Invoice[];
  }
}
