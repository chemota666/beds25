
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Property, Room } from '../types';

export const Properties: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);

  // FIX: Wrapped async call in a function within useEffect
  useEffect(() => {
    const loadProperties = async () => {
      const props = await db.getProperties();
      setProperties(props);
    };
    loadProperties();
  }, []);

  // FIX: Made handleSaveProperty async to await database operations
  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProperty) {
      await db.saveProperty(editingProperty);
      const props = await db.getProperties();
      setProperties(props);
      setIsPropertyModalOpen(false);
      setEditingProperty(null);
    }
  };

  const handleNewProperty = () => {
    setEditingProperty({
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      address: '',
      city: '',
      owner: '',
      numRooms: 0
    });
    setIsPropertyModalOpen(true);
  };

  // FIX: Made handleDeleteProperty async to await database operations
  const handleDeleteProperty = async (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este inmueble y todas sus habitaciones?')) {
      await db.deleteProperty(id);
      const props = await db.getProperties();
      setProperties(props);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Inmuebles</h1>
          <p className="text-sm text-gray-500">Configura tus edificios y el número de habitaciones disponibles.</p>
        </div>
        <button 
          onClick={handleNewProperty}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-blue-700"
        >
          Añadir Inmueble
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.map(p => (
          <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex justify-between items-start">
               <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
               </div>
               <div className="flex space-x-1">
                  <button onClick={() => { setEditingProperty(p); setIsPropertyModalOpen(true); }} className="p-2 text-gray-400 hover:text-blue-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  </button>
                  <button onClick={() => handleDeleteProperty(p.id)} className="p-2 text-gray-400 hover:text-red-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
               </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">{p.name}</h3>
              <p className="text-sm text-gray-500">{p.address}, {p.city}</p>
            </div>
            <div className="flex justify-between items-center text-sm pt-4 border-t border-gray-100">
              <span className="font-medium text-gray-600">Habitaciones: {p.numRooms}</span>
              <span className="text-gray-400">Propietario: {p.owner}</span>
            </div>
          </div>
        ))}
      </div>

      {isPropertyModalOpen && editingProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
             <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Inmueble</h2>
                <button onClick={() => setIsPropertyModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
             </div>
             <form onSubmit={handleSaveProperty} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nombre Inmueble</label>
                  <input 
                    required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                    value={editingProperty.name} onChange={e => setEditingProperty({...editingProperty, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Dirección</label>
                  <input 
                    required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                    value={editingProperty.address} onChange={e => setEditingProperty({...editingProperty, address: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Ciudad</label>
                  <input 
                    required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                    value={editingProperty.city} onChange={e => setEditingProperty({...editingProperty, city: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Propietario</label>
                  <input 
                    required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                    value={editingProperty.owner} onChange={e => setEditingProperty({...editingProperty, owner: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Número de Habitaciones</label>
                  <input 
                    required type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                    value={editingProperty.numRooms} onChange={e => setEditingProperty({...editingProperty, numRooms: Number(e.target.value)})}
                  />
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button type="button" onClick={() => setIsPropertyModalOpen(false)} className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg">Cancelar</button>
                  <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">Guardar</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
