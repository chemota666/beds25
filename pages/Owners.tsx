import { db } from '../services/db';
import { Owner } from '../types';
import { useState, useEffect } from 'react';
import DocumentUpload from '../components/DocumentUpload';

export const Owners: React.FC = () => {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadOwners();
  }, []);

  const loadOwners = async () => {
    const data = await db.getOwners();
    setOwners(data);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOwner) {
      await db.saveOwner(editingOwner);
      await loadOwners();
      setIsModalOpen(false);
      setEditingOwner(null);
    }
  };

  const handleNew = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setEditingOwner({
      id: newId,
      name: '',
      dni: '',
      phone: '',
      invoiceSeries: 'F' + newId.substring(0, 4).toUpperCase(),
      lastInvoiceNumber: 0
    });
    setIsModalOpen(true);
  };

  const handleEdit = (owner: Owner) => {
    setEditingOwner({...owner});
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Seguro que quieres eliminar este propietario?')) {
      await db.deleteOwner(id);
      await loadOwners();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Propietarios</h1>
          <p className="text-sm text-gray-500">Administra los propietarios de los inmuebles.</p>
        </div>
        <button onClick={handleNew} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-blue-700">
          Añadir Propietario
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {owners.map(o => (
          <div key={o.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              </div>
              <div className="flex space-x-1">
                <button onClick={() => handleEdit(o)} className="p-2 text-gray-400 hover:text-blue-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button onClick={() => handleDelete(o.id)} className="p-2 text-gray-400 hover:text-red-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">{o.name}</h3>
              <p className="text-sm text-gray-500">DNI: {o.dni || '-'}</p>
            </div>
            <div className="flex justify-between items-center text-sm pt-4 border-t border-gray-100">
              <span className="font-medium text-gray-600">Tel: {o.phone || '-'}</span>
              <span className="text-gray-400">Serie: {o.invoiceSeries}</span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && editingOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Propietario</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" required value={editingOwner.name} onChange={e => setEditingOwner({...editingOwner, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
                <input type="text" value={editingOwner.dni || ''} onChange={e => setEditingOwner({...editingOwner, dni: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input type="text" value={editingOwner.phone || ''} onChange={e => setEditingOwner({...editingOwner, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serie Facturación</label>
                <input type="text" value={editingOwner.invoiceSeries || ''} onChange={e => setEditingOwner({...editingOwner, invoiceSeries: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
              </div>
                {editingOwner?.id && <DocumentUpload ownerId={editingOwner.id} />}
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Owners;
