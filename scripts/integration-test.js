const BASE = 'http://127.0.0.1:3003';

async function api(path, opts) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function run() {
  console.log('1) Creating owner');
  const owner = await api('/owners', { method: 'POST', body: JSON.stringify({ name: 'TEST OWNER', dni: '0000', phone: '000' }) });
  console.log('owner created:', owner);
  const ownerId = owner && owner.id ? String(owner.id) : null;
  if (!ownerId) return console.error('Owner id missing, aborting tests');

  console.log('2) Creating property referencing owner');
  const prop = await api('/properties', { method: 'POST', body: JSON.stringify({ name: 'Test Prop', address: 'Addr', city: 'City', owner: ownerId, numRooms: 3 }) });
  console.log('property created:', prop);
  const propId = prop && prop.id ? String(prop.id) : null;
  if (!propId) return console.error('Prop id missing, aborting tests');

  console.log('3) Creating reservation (pending)');
  // use existing roomId/guestId and 'price' column matching DB schema
  const res = await api('/reservations', { method: 'POST', body: JSON.stringify({ reservationNumber: 0, propertyId: propId, roomId: 1, guestId: 1, price: '100.00', startDate: '2026-02-10', endDate: '2026-02-20', paymentMethod: 'pending' }) });
  console.log('reservation created:', res);
  const resId = res && res.id ? String(res.id) : null;
  if (!resId) return console.error('Reservation id missing, aborting tests');

  console.log('4) Marking reservation as paid: transfer -> Generate invoice by client logic (simulate)');
  // Fetch owner and increment lastInvoiceNumber
  const owners = await api('/owners');
  const foundOwner = owners.find(o => String(o.id) === String(ownerId));
  const last = Number(foundOwner.lastInvoiceNumber || 0) + 1;
  const seq = String(last).padStart(3,'0');
  const series = `FR${String(ownerId).padStart(2,'0')}`;
  const invoiceNumber = `${series}/${seq}`;
  const invoiceDate = new Date().toISOString().split('T')[0];

  // update owner
  await api(`/owners/${ownerId}`, { method: 'PUT', body: JSON.stringify({ ...foundOwner, lastInvoiceNumber: last }) });

  // update reservation with invoice
  await api(`/reservations/${resId}`, { method: 'PUT', body: JSON.stringify({ invoiceNumber, invoiceDate, paymentMethod: 'transfer' }) });

  console.log('Invoice assigned:', invoiceNumber, invoiceDate);

  console.log('5) Attempt to delete invoiced reservation (should fail if checked)');
  const del = await api(`/reservations/${resId}`, { method: 'DELETE' });
  console.log('delete response:', del);

  console.log('6) Clean-up (attempt delete created data if possible)');
  try { await api(`/properties/${propId}`, { method: 'DELETE' }); } catch (e) {}
  try { await api(`/owners/${ownerId}`, { method: 'DELETE' }); } catch (e) {}

  console.log('Integration test finished');
}

run().catch(err => { console.error('TEST ERROR', err); process.exit(1); });
