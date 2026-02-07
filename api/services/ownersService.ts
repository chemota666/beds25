import { RowDataPacket, ResultSetHeader } from 'mysql2';
import mysql from 'mysql2/promise';

export interface Owner {
  id: number;
  name: string;
  dni?: string;
  phone?: string;
  invoiceSeries?: string;
  lastInvoiceNumber?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateOwnerDTO {
  name: string;
  dni?: string;
  phone?: string;
  invoiceSeries?: string;
}

export interface UpdateOwnerDTO {
  name?: string;
  dni?: string;
  phone?: string;
  invoiceSeries?: string;
}

export class OwnersService {
  constructor(private pool: mysql.Pool) {}

  async getAllOwners(): Promise<Owner[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT * FROM owners ORDER BY name'
    );
    return rows as Owner[];
  }

  async getOwnerById(id: number): Promise<Owner | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT * FROM owners WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as Owner) : null;
  }

  async createOwner(data: CreateOwnerDTO): Promise<Owner> {
    const { name, dni, phone, invoiceSeries = 'INV' } = data;
    
    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO owners (name, dni, phone, invoiceSeries, lastInvoiceNumber) 
       VALUES (?, ?, ?, ?, 0?),
      [name, dni, phone, invoiceSeries, 0]
    );

    const newOwner = await this.getOwnerById(result.insertId);
    if (!newOwner) {
      throw new Error('Failed to create owner');
    }
    return newOwner;
  }

  async updateOwner(id: number, data: UpdateOwnerDTO): Promise<Owner> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.dni !== undefined) {
      updates.push('dni = ?');
      values.push(data.dni);
    }
    if (data.phone !== undefined) {
      updates.push('phone = ?');
      values.push(data.phone);
    }
    if (data.invoiceSeries !== undefined) {
      updates.push('invoiceSeries = ?');
      values.push(data.invoiceSeries);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
          await this.pool.query(
        `UPDATE owners SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP mv api/services/ownersService.ts api/services/ownersService.ts.bak
         id = ?`,
        values
      );
    );

    const updated = await this.getOwnerById(id);
    if (!updated) {
      throw new Error('Owner not found after update');
    }
    return updated;
  }

  async deleteOwner(id: number): Promise<void> {
    // Verificar que no tenga propiedades asociadas
    const [properties] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM properties WHERE ownerId = ?',
      [id]
    );

    if (properties[0].count > 0) {
      throw new Error('Cannot delete owner with associated properties');
    }

    await this.pool.query('DELETE FROM owners WHERE id = ?', [id]);
  }

  /**
   * Incrementa lastInvoiceNumber de forma atómica con lock
   * Usa SELECT ... FOR UPDATE para evitar race conditions
   */
  async incrementInvoiceNumber(ownerId: number, connection?: mysql.PoolConnection): Promise<string> {
    const conn = connection || await this.pool.getConnection();
    
    try {
      if (!connection) {
        await conn.beginTransaction();
      }

      // Lock de la fila para actualización atómica
      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT invoiceSeries, lastInvoiceNumber FROM owners WHERE id = ? FOR UPDATE',
        [ownerId]
      );

      if (rows.length === 0) {
        throw new Error('Owner not found');
      }

      const { invoiceSeries, lastInvoiceNumber } = rows[0];
      const newNumber = (lastInvoiceNumber || 0) + 1;

      await conn.query(
        'UPDATE owners SET lastInvoiceNumber = ? WHERE id = ?',
        [newNumber, ownerId]
      );

      const invoiceNumber = `${invoiceSeries || 'INV'}-${String(newNumber).padStart(6, '0')}`;

      if (!connection) {
        await conn.commit();
      }

      return invoiceNumber;
    } catch (error) {
      if (!connection) {
        await conn.rollback();
      }
      throw error;
    } finally {
      if (!connection) {
        conn.release();
      }
    }
  }
}
