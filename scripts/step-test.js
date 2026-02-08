const BASE='http://127.0.0.1:3003';

async function api(path, opts){
  const r = await fetch(`${BASE}${path}`, { headers: {'Content-Type':'application/json'}, ...opts });
  const txt = await r.text(); try{return JSON.parse(txt);}catch{return txt;}
}

(async()=>{
  const owner = await api('/owners', { method: 'POST', body: JSON.stringify({ name: 'TMP2', dni:'0', phone:'0' }) });
  console.log('owner', owner);
  const prop = await api('/properties', { method: 'POST', body: JSON.stringify({ name: 'P2', address:'A', city:'C', owner: String(owner.id), numRooms:1 }) });
  console.log('prop', prop);
  const res = await api('/reservations', { method: 'POST', body: JSON.stringify({ reservationNumber:0, propertyId: String(prop.id), roomId:1, guestId:1, price:'55.00', startDate:'2026-02-10', endDate:'2026-02-11', paymentMethod:'pending' }) });
  console.log('res created', res);
  const id = res.id;
  // Use server endpoint to generate invoice atomically
  const gen = await api('/invoices/generate', { method: 'POST', body: JSON.stringify({ reservationId: id }) });
  console.log('generate invoice result', gen);
  const all = await api('/reservations');
  console.log('found after put', all.find(x=>String(x.id)===String(id)));
  const del = await api('/reservations/' + id, { method: 'DELETE' });
  console.log('delete result', del);
})().catch(e=>console.error(e));
