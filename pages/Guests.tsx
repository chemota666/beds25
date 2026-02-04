
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Guest, Sex } from '../types';

export const Guests: React.FC = () => {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGuests = async () => {
      setLoading(true);
      const data = await db.getGuests();
      setGuests(data);
      setLoading(false);
    };
    loadGuests();
  }, []);

  const filteredGuests = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return guests.filter(g => 
      g.name.toLowerCase().includes(lower) || 
      g.surname.toLowerCase().includes(lower) || 
      g.dni.toLowerCase().includes(lower)
    ).sort((a, b) => {
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      return idA - idB;
    });
  }, [guests, searchTerm]);

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGuest) {
      setLoading(true);
      await db.saveGuest(editingGuest);
      // We force a small delay because Apps Script takes a moment to process Drive uploads
      setTimeout(async () => {
        const data = await db.getGuests();
        setGuests(data);
        setLoading(false);
        setIsModalOpen(false);
        setEditingGuest(null);
      }, 1500);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'dniFile' | 'contractFile' | 'depositReceiptFile') => {
    const file = e.target.files?.[0];
    if (file && editingGuest) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingGuest({ ...editingGuest, [field]: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const smartDownload = (data: string, filename: string) => {
    if (!data) return;
    // Si empieza con http, es una URL de Drive
    if (data.startsWith('http')) {
      window.open(data, '_blank');
    } else {
      // Es base64
      const a = document.createElement('a');
      a.href = data;
      a.download = filename;
      a.click();
    }
  };

  const isNewGuest = editingGuest && editingGuest.id.startsWith('temp_');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Base de Huéspedes</h1>
          <p className="text-sm text-gray-500">Documentación centralizada y sincronizada con Google Drive.</p>
        </div>
        <button 
          disabled={loading}
          onClick={() => {
            setEditingGuest({ 
              id: 'temp_' + Date.now(), 
              name: '', 
              surname: '', 
              dni: '', 
              nationality: 'Española', 
              sex: 'Masculino', 
              isRegistered: false,
              email: '',
              phone: '',
              notes: ''
            });
            setIsModalOpen(true);
          }}
          className={`${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all flex items-center`}
        >
          {loading ? (
            <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Sincronizando...</>
          ) : (
            'Nuevo Huésped'
          )}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
        <div className="p-4 border-b border-gray-50 bg-gray-50/50">
          <input 
            type="text" 
            placeholder="Buscar por nombre, apellidos o DNI..."
            className="w-full max-w-md bg-white border border-gray-200 rounded-xl px-4 py-2 outline-none focus:ring-4 focus:ring-blue-50 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Huésped</th>
                <th className="px-6 py-4">Contacto</th>
                <th className="px-6 py-4">Estado Docs</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredGuests.length > 0 ? filteredGuests.map(g => (
                <tr key={g.id} className="hover:bg-blue-50/30 group transition-colors">
                  <td className="px-6 py-4">
                    <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2.5 py-1 rounded-lg border border-blue-100">
                      #{g.id}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-800">{g.name} {g.surname}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase">DNI: {g.dni}</div>
                    {g.notes && (
                      <div className="text-[10px] text-gray-400 italic mt-1 max-w-[200px] truncate">
                        "{g.notes.length > 50 ? g.notes.substring(0, 50) + '...' : g.notes}"
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="font-semibold text-gray-700">{g.phone || '—'}</div>
                    <div className="text-gray-400">{g.email || '—'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-1.5">
                       {g.dniFile && <div className="w-2 h-2 rounded-full bg-green-500" title="DNI Subido"></div>}
                       {g.contractFile && <div className="w-2 h-2 rounded-full bg-blue-500" title="Contrato Subido"></div>}
                       {g.depositReceiptFile && <div className="w-2 h-2 rounded-full bg-orange-500" title="Fianza Subida"></div>}
                       {!g.dniFile && !g.contractFile && !g.depositReceiptFile && <span className="text-[10px] text-gray-300 italic">Sin documentos</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-4">
                      <button onClick={() => { setEditingGuest(g); setIsModalOpen(true); }} className="text-blue-600 font-bold text-xs uppercase tracking-wider hover:text-blue-800">Editar</button>
                      <button onClick={async () => { if(confirm('¿Seguro que quieres eliminar este huésped?')) { setLoading(true); await db.deleteGuest(g.id); setGuests(await db.getGuests()); setLoading(false); } }} className="text-red-300 hover:text-red-600 font-bold text-xs uppercase tracking-wider transition-colors">Borrar</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-400 italic">No se han encontrado huéspedes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && editingGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-auto overflow-hidden border border-gray-100">
             <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Ficha del Huésped</h2>
                  <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest mt-1 inline-block">
                    {isNewGuest ? 'Nueva Ficha' : `Huésped #${editingGuest.id}`}
                  </span>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
             </div>
             
             <form onSubmit={handleSaveGuest} className="p-8 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre</label>
                    <input required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingGuest.name || ""} onChange={e => setEditingGuest({...editingGuest, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Apellidos</label>
                    <input required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingGuest.surname || ""} onChange={e => setEditingGuest({...editingGuest, surname: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">DNI / NIE</label>
                    <input required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingGuest.dni || ""} onChange={e => setEditingGuest({...editingGuest, dni: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sexo</label>
                    <select className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingGuest.sex || ""} onChange={e => setEditingGuest({...editingGuest, sex: e.target.value as Sex})}>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nacionalidad</label>
                    <input required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingGuest.nationality || ""} onChange={e => setEditingGuest({...editingGuest, nationality: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Teléfono</label>
                    <input type="tel" className="w-full bg-white border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingGuest.phone || ''} onChange={e => setEditingGuest({...editingGuest, phone: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
                    <input type="email" className="w-full bg-white border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingGuest.email || ''} onChange={e => setEditingGuest({...editingGuest, email: e.target.value})} />
                  </div>
                </div>

                <div className="flex items-center space-x-4 bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-100">
                   <div className="flex items-center justify-center w-6 h-6">
                    <input 
                      type="checkbox" 
                      id="empadronado"
                      className="w-5 h-5 text-blue-900 rounded focus:ring-offset-0 focus:ring-0 border-none cursor-pointer" 
                      checked={editingGuest.isRegistered === '1' || editingGuest.isRegistered === 1} 
                      onChange={e => setEditingGuest({...editingGuest, isRegistered: e.target.checked})} 
                    />
                   </div>
                   <label htmlFor="empadronado" className="text-sm font-black text-white uppercase tracking-wider cursor-pointer">Huésped empadronado en el municipio</label>
                </div>

                {/* NUEVO CAMPO: NOTAS */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Notas del Huésped</label>
                    <span className={`text-[10px] font-black ${(editingGuest.notes || '').length > 180 ? 'text-red-500' : 'text-gray-400'}`}>
                      {(editingGuest.notes || '').length}/200
                    </span>
                  </div>
                  <textarea 
                    maxLength={200}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 font-medium text-gray-700 focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none h-24"
                    placeholder="Escribe aquí observaciones relevantes (máximo 200 caracteres)..."
                    value={editingGuest.notes || ''}
                    onChange={e => setEditingGuest({...editingGuest, notes: e.target.value})}
                  />
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Expediente Digital</h3>
                    <div className="flex items-center text-[10px] text-blue-600 font-bold">
                       <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 8.586V3z"></path><path d="M4 16a2 2 0 012-2h8a2 2 0 012 2v2H4v-2z"></path></svg>
                       Sincronizado con Drive
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { field: 'dniFile' as const, label: 'DNI / NIE', color: 'green' },
                      { field: 'contractFile' as const, label: 'Contrato', color: 'blue' },
                      { field: 'depositReceiptFile' as const, label: 'Recibo Fianza', color: 'orange' }
                    ].map((doc) => (
                      <div key={doc.field} className={`p-4 rounded-2xl border-2 transition-all ${editingGuest[doc.field] ? `bg-${doc.color}-50 border-${doc.color}-100` : 'bg-gray-50 border-gray-100'}`}>
                        <p className={`text-[10px] font-black uppercase mb-3 ${editingGuest[doc.field] ? `text-${doc.color}-600` : 'text-gray-400'}`}>{doc.label}</p>
                        
                        {editingGuest[doc.field] ? (
                          <div className="space-y-2">
                            <div className="flex items-center text-xs font-bold text-gray-700">
                               <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                               Listo
                            </div>
                            <button 
                              type="button" 
                              onClick={() => smartDownload(editingGuest[doc.field]!, `${doc.label}_${editingGuest.id}`)} 
                              className={`w-full py-2 bg-white border border-${doc.color}-200 text-${doc.color}-600 text-[10px] font-black rounded-lg hover:shadow-md transition-all uppercase`}
                            >
                              Ver / Descargar
                            </button>
                            <label className="block w-full py-2 text-center text-[9px] font-bold text-gray-400 cursor-pointer hover:underline uppercase">
                              Reemplazar
                              <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, doc.field)} />
                            </label>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-white hover:border-blue-400 transition-all group">
                            <svg className="w-6 h-6 text-gray-300 group-hover:text-blue-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            <span className="text-[10px] font-black text-gray-400 uppercase">Subir</span>
                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, doc.field)} />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 flex justify-end space-x-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-xs tracking-widest">Cancelar</button>
                  <button type="submit" disabled={loading} className="px-12 py-3 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:bg-gray-400 transform hover:-translate-y-0.5 transition-all uppercase text-xs tracking-widest">
                    {loading ? 'Guardando...' : 'Actualizar Ficha'}
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
