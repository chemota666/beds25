
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Guest } from '../types';

export const Guests: React.FC = () => {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setGuests(db.getGuests());
  }, []);

  const filteredGuests = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return guests.filter(g => 
      g.name.toLowerCase().includes(lower) || 
      g.surname.toLowerCase().includes(lower) || 
      g.dni.toLowerCase().includes(lower)
    );
  }, [guests, searchTerm]);

  const handleSaveGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGuest) {
      db.saveGuest(editingGuest);
      setGuests(db.getGuests());
      setIsModalOpen(false);
      setEditingGuest(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'dniFile' | 'contractFile') => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Base de Huéspedes</h1>
          <p className="text-sm text-gray-500">Gestiona la información y documentos de tus clientes.</p>
        </div>
        <button 
          onClick={() => {
            setEditingGuest({ id: Math.random().toString(36).substr(2, 9), name: '', surname: '', dni: '', nationality: 'Española' });
            setIsModalOpen(true);
          }}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-blue-700"
        >
          Nuevo Huésped
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50">
          <input 
            type="text" 
            placeholder="Buscar..."
            className="w-full max-w-md bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs font-black text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">Huésped</th>
                <th className="px-6 py-4">Documentos</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredGuests.map(g => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-800">{g.name} {g.surname}</div>
                    <div className="text-xs text-gray-500">{g.dni}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                       {g.dniFile && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded">DNI OK</span>}
                       {g.contractFile && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">CONTRATO OK</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => { setEditingGuest(g); setIsModalOpen(true); }} className="text-blue-600 font-bold hover:underline mr-4">Editar / Archivos</button>
                    <button onClick={() => { if(confirm('¿Eliminar?')) { db.deleteGuest(g.id); setGuests(db.getGuests()); } }} className="text-red-500 font-bold hover:underline">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && editingGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
             <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h2 className="text-xl font-bold text-gray-800">Ficha y Archivos</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
             </div>
             <form onSubmit={handleSaveGuest} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nombre</label>
                    <input required type="text" className="w-full border rounded-lg p-2.5 outline-none" value={editingGuest.name} onChange={e => setEditingGuest({...editingGuest, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Apellidos</label>
                    <input required type="text" className="w-full border rounded-lg p-2.5 outline-none" value={editingGuest.surname} onChange={e => setEditingGuest({...editingGuest, surname: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">DNI / NIE</label>
                  <input required type="text" className="w-full border rounded-lg p-2.5 outline-none" value={editingGuest.dni} onChange={e => setEditingGuest({...editingGuest, dni: e.target.value})} />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest">Gestión de Documentos</h3>
                  
                  <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-gray-500">Documento de Identidad (DNI/Foto)</p>
                    <div className="flex items-center gap-3">
                      <input type="file" onChange={(e) => handleFileUpload(e, 'dniFile')} className="text-xs" />
                      {editingGuest.dniFile && (
                        <button type="button" onClick={() => downloadFile(editingGuest.dniFile!, `DNI_${editingGuest.name}.png`)} className="bg-blue-600 text-white text-[10px] font-bold px-3 py-2 rounded-lg">Descargar</button>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-gray-500">Contrato de Alquiler (PDF/Foto)</p>
                    <div className="flex items-center gap-3">
                      <input type="file" onChange={(e) => handleFileUpload(e, 'contractFile')} className="text-xs" />
                      {editingGuest.contractFile && (
                        <button type="button" onClick={() => downloadFile(editingGuest.contractFile!, `Contrato_${editingGuest.name}.pdf`)} className="bg-blue-600 text-white text-[10px] font-bold px-3 py-2 rounded-lg">Descargar</button>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 italic">Nota: Al subir un nuevo archivo se sustituirá el anterior.</p>
                </div>

                <div className="pt-4 flex justify-end space-x-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Cancelar</button>
                  <button type="submit" className="px-8 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-lg">Guardar Huésped</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
