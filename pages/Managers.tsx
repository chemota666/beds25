import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Manager } from '../types';

export const Managers: React.FC = () => {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadManagers = async () => {
    setLoading(true);
    const data = await db.getManagers();
    setManagers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadManagers();
  }, []);

  const handleNew = () => {
    setEditingManager({
      id: 'temp_' + Math.random().toString(36).slice(2, 9),
      name: '',
      phone: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleEdit = (manager: Manager) => {
    setEditingManager({ ...manager });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingManager) return;

    try {
      setLoading(true);
      await db.saveManager(editingManager);
      await loadManagers();
      setIsModalOpen(false);
      setEditingManager(null);
      alert('✅ Gestor guardado correctamente');
    } catch (error: any) {
      alert('❌ Error al guardar gestor: ' + (error?.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que quieres eliminar este gestor?')) return;
    setLoading(true);
    await db.deleteManager(id);
    await loadManagers();
  };

  const isNewManager = editingManager && String(editingManager.id).startsWith('temp_');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Gestión de Gestores</h1>
          <p className="text-sm text-gray-500">Administra los gestores que cobran en efectivo.</p>
        </div>
        <button disabled={loading} onClick={handleNew} className={`${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all`}>
          {loading ? 'Cargando...' : 'Nuevo Gestor'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {managers.map(m => (
          <div key={m.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div className="bg-emerald-100 text-emerald-600 p-3 rounded-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A9 9 0 1119 6.196M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => handleEdit(m)} className="p-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button onClick={() => handleDelete(m.id)} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">{m.name}</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase">ID: {m.id}</p>
              {m.phone && <p className="text-sm text-gray-600 mt-1">📞 {m.phone}</p>}
            </div>
            {m.notes && (
              <div className="text-xs text-gray-500 border-t border-gray-100 pt-3">{m.notes}</div>
            )}
          </div>
        ))}
      </div>

      {isModalOpen && editingManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl my-auto overflow-hidden border border-gray-100">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Ficha del Gestor</h2>
                <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest mt-1 inline-block">
                  {isNewManager ? 'Nuevo Gestor' : `Gestor #${editingManager.id}`}
                </span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-emerald-50 outline-none transition-all"
                    value={editingManager.name}
                    onChange={e => setEditingManager({ ...editingManager, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Teléfono</label>
                  <input
                    type="tel"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-emerald-50 outline-none transition-all"
                    value={editingManager.phone || ''}
                    onChange={e => setEditingManager({ ...editingManager, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Notas</label>
                  <textarea
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-emerald-50 outline-none transition-all"
                    rows={3}
                    value={editingManager.notes || ''}
                    onChange={e => setEditingManager({ ...editingManager, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Managers;
