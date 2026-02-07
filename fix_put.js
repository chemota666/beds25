const fs = require('fs');
let lines = fs.readFileSync('server.cjs', 'utf8').split('\n');

// Find the PUT handler start (line with '// PUT update')
let putStart = -1;
let putEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// PUT update')) putStart = i;
  if (putStart >= 0 && i > putStart && lines[i].trim() === '});') {
    putEnd = i;
    break;
  }
}

console.log('PUT handler found at lines', putStart+1, 'to', putEnd+1);

const newPut = [
  '// PUT update (handles non-numeric temp IDs by doing INSERT)',
  "app.put('/:table/:id', async (req, res) => {",
  '  const { table: t, id } = req.params;',
  "  if (!VALID_TABLES.includes(t)) return res.status(404).json({ error: 'Not found' });",
  '  try {',
  '    const data = { ...req.body };',
  '    delete data.id;',
  '    delete data.createdAt;',
  '    delete data.updatedAt;',
  '    // If id is non-numeric, treat as INSERT instead of UPDATE',
  '    if (isNaN(Number(id))) {',
  "      console.log('[PUT->INSERT]', t, 'non-numeric id:', id);",
  '      const cols = Object.keys(data);',
  '      const vals = Object.values(data);',
  "      const ph = cols.map(() => '?').join(', ');",
  "      const sql = 'INSERT INTO ' + t + ' (' + cols.join(', ') + ') VALUES (' + ph + ')';",
  "      console.log('[INSERT via PUT]', t, sql, vals);",
  '      const [result] = await pool.query(sql, vals);',
  '      return res.json({ id: result.insertId, ...data });',
  '    }',
  '    const cols = Object.keys(data);',
  '    const vals = Object.values(data);',
  "    const sql = 'UPDATE ' + t + ' SET ' + cols.map(c => c + ' = ?').join(', ') + ' WHERE id = ?';",
  "    console.log('[PUT]', t, sql, [...vals, id]);",
  '    await pool.query(sql, [...vals, id]);',
  '    res.json({ id, ...data });',
  "  } catch (e) { console.error('[PUT]', t, id, e.message); res.status(500).json({ error: e.message }); }",
  '});'
];

if (putStart >= 0 && putEnd >= 0) {
  lines.splice(putStart, putEnd - putStart + 1, ...newPut);
  fs.writeFileSync('server.cjs', lines.join('\n'));
  console.log('PUT handler replaced successfully');
} else {
  console.log('Could not find PUT handler boundaries');
}
