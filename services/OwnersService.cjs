const mysql = require('mysql2/promise');
require('dotenv').config();

class OwnersService {
  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'roomflow_pms',
      waitForConnections: true,
      connectionLimit: 10
    });
  }

  async getAll() {
    const [rows] = await this.pool.query('SELECT * FROM owners ORDER BY id DESC');
    return rows;
  }

  async create(data) {
    const { name, dni, phone, invoiceSeries, lastInvoiceNumber } = data;
    const [result] = await this.pool.query(
      'INSERT INTO owners (name, dni, phone, invoiceSeries, lastInvoiceNumber) VALUES (?, ?, ?, ?, ?)',
      [name, dni || null, phone || null, invoiceSeries || null, lastInvoiceNumber || 0]
    );
    return { id: result.insertId, ...data };
  }

  async update(id, data) {
    const { name, dni, phone, invoiceSeries, lastInvoiceNumber } = data;
    await this.pool.query(
      'UPDATE owners SET name=?, dni=?, phone=?, invoiceSeries=?, lastInvoiceNumber=? WHERE id=?',
      [name, dni || null, phone || null, invoiceSeries || null, lastInvoiceNumber || 0, id]
    );
    return { id, ...data };
  }

  async delete(id) {
    await this.pool.query('DELETE FROM owners WHERE id=?', [id]);
    return { success: true };
  }
}

module.exports = OwnersService;
