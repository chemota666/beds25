import { RowDataPacket, ResultSetHeader } from 'mysql2';
import mysql from 'mysql2/promise';

export interface Property {
  id: number;
  ownerId: number;
  name: string;
  address?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Room {
  id: number;
  propertyId: number;
  name: string;
  type?: string;
  pricePerNight?: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreatePropertyDTO {
  ownerId: number;
  name: string;
  address?: string;
  rooms?: Array<{ name: string; type?: string; pricePerNight?: number }>;
}

export interface UpdatePropertyDTO {
  name?: string;
  address?: string;
}

export class PropertiesService {
  constructor(private pool: mysql.Pool) {}

  async getAllProperties(ownerId?: number): Promise<Property[]> {
    if (ownerId) {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        'SELECT * FROM properties WHERE ownerId = ? ORDER BY name',
        [ownerId]
      );
      return rows as Property[];
    }
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT * FROM properties ORDER BY name'
    );
    return rows as Property[];
  }

  async getPropertyById(id: number): Promise<Property | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT * FROM properties WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as Property) : null;
  }

  async createProperty(data: CreatePropertyDTO): Promise<Property> {
    const conn = await this.pool.getConnection();
    
    try {
      await conn.beginTransaction();

      // Crear property
      const [result] = await conn.query<ResultSetHeader>(
        'INSERT INTO properties (ownerId, name, address) VALUES (?, ?, ?)',
        [data.ownerId, data.name, data.address]
      );

      const propertyId = result.insertId;

      // Crear rooms si se proporcionan
      if (data.rooms && data.rooms.length > 0) {
        for (const room of data.rooms) {
          await conn.query(
            'INSERT INTO rooms (propertyId, name, type, pricePerNight, isActive) VALUES (?, ?, ?, ?, ?)',
            [propertyId, room.name, room.type, room.pricePerNight, true]
          );
        }
      }

      await conn.commit();

      const newProperty = await this.getPropertyById(propertyId);
      if (!newProperty) {
        throw new Error('Failed to create property');
      }
      return newProperty;

    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async updateProperty(id: number, data: UpdatePropertyDTO): Promise<Property> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.address !== undefined) {
      updates.push('address = ?');
      values.push(data.address);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    await this.pool.query(
      `UPDATE properties SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    const updated = await this.getPropertyById(id);
    if (!updated) {
      throw new Error('Property not found');
    }
    return updated;
  }

  async deleteProperty(id: number): Promise<void> {
    // Verificar que no tenga reservas activas
    const [reservations] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM reservations WHERE propertyId = ? AND status != "cancelled"',
      [id]
    );

    if (reservations[0].count > 0) {
      throw new Error('Cannot delete property with active reservations');
    }

    await this.pool.query('DELETE FROM properties WHERE id = ?', [id]);
  }

  async getRoomsByProperty(propertyId: number): Promise<Room[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT * FROM rooms WHERE propertyId = ? ORDER BY name',
      [propertyId]
    );
    return rows as Room[];
  }
}
