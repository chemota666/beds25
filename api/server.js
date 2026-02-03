import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'roomflow',
  password: 'roomflow123',
  database: 'roomflow_pms',
  waitForConnections: true,
  connectionLimit: 10
});

app.get('/:table', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM \`${req.params.table}\``);
    res.json(rows);
  } catch (err) {
    console.error('GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/:table', async (req, res) => {
  try {
    console.log('POST body:', JSON.stringify(req.body));
    const data = { ...req.body };
    // Remove id if it's a temp id
    if (data.id && String(data.id).startsWith('temp_')) {
      delete data.id;
    }
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO \`${req.params.table}\` (${keys.map(k => '\`'+k+'\`').join(', ')}) VALUES (${placeholders})`;
    console.log('SQL:', sql);
    const [result] = await pool.query(sql, values);
    res.json({ ...data, id: result.insertId });
  } catch (err) {
    console.error('POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/:table/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(k => '\`'+k+'\` = ?').join(', ');
    await pool.query(`UPDATE \`${req.params.table}\` SET ${setClause} WHERE id = ?`, [...values, req.params.id]);
    res.json({ ...req.body, id: parseInt(req.params.id) });
  } catch (err) {
    console.error('PUT error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/:table/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM \`${req.params.table}\` WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, '127.0.0.1', () => {
  console.log('API server running on port 3001');
});
