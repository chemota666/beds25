
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
    );
  }, [guests, searchTerm]);

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGuest) {
      setLoading(true);
      await db.saveGuest(editingGuest);
      const data = await db.getGuests();
      setGuests(data);
      setLoading(false);
      setIsModalOpen(false);
      setEditingGuest(null);
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

  const downloadFile = (data: string, filename: string) => {
    const a = document.createElement('a');
    a.href = data;
    a.download = filename;
    a.click();
  };

  const clearFile = (field: 'dniFile' | 'contractFile' | 'depositReceiptFile') => {
    if (editingGuest) {
      setEditingGuest({ ...editingGuest, [field]: undefined });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Base de Huéspedes</h1>
          <p className="text-sm text-gray-500">Gestiona la información y documentos sincronizados con Google Sheets.</p>
        </div>
        <button 
          disabled={loading}
          onClick={() => {
            setEditingGuest({ 
              id: Math.random().toString(36).substr(2, 9), 
              name: '', 
              surname: '', 
              dni: '', 
              nationality: 'Española', 
              sex: 'Masculino', 
              isRegistered: false 
            });
            setIsModalOpen(true);
          }}
          className={`${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all`}
        >
          {loading ? 'Sincronizando...' : 'Nuevo Huésped'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
        {loading && <div className="p-4 text-center text-blue-500 font-bold bg-blue-50 animate-pulse">Actualizando datos...</div>}
        <div className="p-4 border-b border-gray-50">
          <input 
            type="text" 
            placeholder="Buscar por nombre, apellidos o DNI..."
            className="w-full max-w-md bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs font-black text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">Huésped</th>
                <th className="px-6 py-4">Detalles</th>
                <th className="px-6 py-4">Documentos</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredGuests.map(g => (
                <tr key={g.id} className="hover:bg-gray-50 group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-800">{g.name} {g.surname}</div>
                    <div className="text-xs text-gray-500">DNI: {g.dni}</div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="text-gray-700">{g.phone || 'Sin tlf'} • {g.sex}</div>
                    <div className={g.isRegistered ? 'text-green-600 font-bold' : 'text-gray-400 italic'}>
                      {g.isRegistered ? 'Empadronado' : 'No empadronado'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                       {g.dniFile && <span className="bg-green-100 text-green-700 text-[9px] font-black px-2 py-0.5 rounded-md uppercase border border-green-200">DNI</span>}
                       {g.contractFile && <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded-md uppercase border border-blue-200">Contrato</span>}
                       {g.depositReceiptFile && <span className="bg-orange-100 text-orange-700 text-[9px] font-black px-2 py-0.5 rounded-md uppercase border border-orange-200">Fianza</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-3">
                      <button onClick={() => { setEditingGuest(g); setIsModalOpen(true); }} className="text-blue-600 font-bold hover:underline">Editar</button>
                      <button onClick={async () => { if(confirm('¿Eliminar?')) { setLoading(true); await db.deleteGuest(g.id); setGuests(await db.getGuests()); setLoading(false); } }} className="text-red-400 hover:text-red-600 font-bold">Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && editingGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-auto overflow-hidden">
             <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h2 className="text-2xl font-black text-gray-800 tracking-tight">Ficha del Huésped</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
             </div>
             <form onSubmit={handleSaveGuest} className="p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-1 tracking-widest">Nombre</label>
                    <input required type="text" className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 border" value={editingGuest.name} onChange={e => setEditingGuest({...editingGuest, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-1 tracking-widest">Apellidos</label>
                    <input required type="text" className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 border" value={editingGuest.surname} onChange={e => setEditingGuest({...editingGuest, surname: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-1 tracking-widest">DNI / NIE</label>
                    <input required type="text" className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 border" value={editingGuest.dni} onChange={e => setEditingGuest({...editingGuest, dni: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-1 tracking-widest">Sexo</label>
                    <select className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 border" value={editingGuest.sex} onChange={e => setEditingGuest({...editingGuest, sex: e.target.value as Sex})}>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-1 tracking-widest">Nacionalidad</label>
                    <input required type="text" className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 border" value={editingGuest.nationality} onChange={e => setEditingGuest({...editingGuest, nationality: e.target.value})} />
                  </div>
                </div>

                <div className="flex items-center space-x-3 bg-blue-50 p-4 rounded-2xl">
                   <input 
                    type="checkbox" 
                    id="empadronado"
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                    checked={editingGuest.isRegistered} 
                    onChange={e => setEditingGuest({...editingGuest, isRegistered: e.target.checked})} 
                   />
                   <label htmlFor="empadronado" className="text-sm font-bold text-blue-700">¿Está empadronado?</label>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4">Documentos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-2">DNI / NIE</p>
                      <input type="file" className="text-[10px] mb-3" onChange={(e) => handleFileUpload(e, 'dniFile')} />
                      {editingGuest.dniFile && <button type="button" onClick={() => downloadFile(editingGuest.dniFile!, 'dni.png')} className="bg-blue-600 text-white text-[9px] font-bold px-2 py-1 rounded">Descargar</button>}
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Contrato</p>
                      <input type="file" className="text-[10px] mb-3" onChange={(e) => handleFileUpload(e, 'contractFile')} />
                      {editingGuest.contractFile && <button type="button" onClick={() => downloadFile(editingGuest.contractFile!, 'contrato.pdf')} className="bg-blue-600 text-white text-[9px] font-bold px-2 py-1 rounded">Descargar</button>}
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Fianza</p>
                      <input type="file" className="text-[10px] mb-3" onChange={(e) => handleFileUpload(e, 'depositReceiptFile')} />
                      {editingGuest.depositReceiptFile && <button type="button" onClick={() => downloadFile(editingGuest.depositReceiptFile!, 'fianza.png')} className="bg-blue-600 text-white text-[9px] font-bold px-2 py-1 rounded">Descargar</button>}
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex justify-end space-x-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancelar</button>
                  <button type="submit" disabled={loading} className="px-10 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-xl hover:bg-blue-700 disabled:bg-gray-400">
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
