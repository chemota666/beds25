
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Property, Room, Owner, Manager } from '../types';

export const Properties: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [showNewOwnerForm, setShowNewOwnerForm] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState('');
  const [creatingOwner, setCreatingOwner] = useState(false);
  type PropertyDocType = 'insurance' | 'electricity' | 'water' | 'internet' | 'gas' | 'management';
  const PROPERTY_DOCS: Array<{ type: PropertyDocType; label: string }> = [
    { type: 'insurance', label: 'Seguro' },
    { type: 'electricity', label: 'Luz' },
    { type: 'water', label: 'Agua' },
    { type: 'internet', label: 'Internet' },
    { type: 'gas', label: 'Gas' },
    { type: 'management', label: 'Contrato Gestión' }
  ];
  interface PropertyFileInfo {
    filename: string;
    size: number;
    uploadDate: string;
    path: string;
    type?: string;
  }
  const createEmptyDocMap = () => PROPERTY_DOCS.reduce((acc, doc) => {
    acc[doc.type] = [];
    return acc;
  }, {} as Record<PropertyDocType, PropertyFileInfo[]>);
  const createEmptyFlagMap = (value: boolean) => PROPERTY_DOCS.reduce((acc, doc) => {
    acc[doc.type] = value;
    return acc;
  }, {} as Record<PropertyDocType, boolean>);
  const createEmptyErrorMap = () => PROPERTY_DOCS.reduce((acc, doc) => {
    acc[doc.type] = null;
    return acc;
  }, {} as Record<PropertyDocType, string | null>);
  const [propertyFiles, setPropertyFiles] = useState<Record<PropertyDocType, PropertyFileInfo[]>>(createEmptyDocMap);
  const [docUploading, setDocUploading] = useState<Record<PropertyDocType, boolean>>(() => createEmptyFlagMap(false));
  const [docError, setDocError] = useState<Record<PropertyDocType, string | null>>(createEmptyErrorMap);

  // Load properties and owners
  useEffect(() => {
    const loadData = async () => {
      const props = await db.getProperties();
      const ownersList = await db.getOwners();
      const managersList = await db.getManagers();
      setProperties(props);
      setOwners(ownersList);
      setManagers(managersList);
    };
    loadData();
  }, []);

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProperty) {
      try {
        await db.saveProperty(editingProperty);
        const props = await db.getProperties();
        setProperties(props);
        setIsPropertyModalOpen(false);
        setEditingProperty(null);
        alert('Inmueble guardado correctamente');
      } catch (error: any) {
        alert('Error al guardar inmueble: ' + (error?.message || 'Error desconocido'));
      }
    }
  };

  const handleNewProperty = () => {
    setEditingProperty({
      id: 'temp_' + Date.now(),
      name: '',
      address: '',
      city: '',
      owner: owners.length > 0 ? String(owners[0].id) : '',
      managerId: managers.length > 0 ? String(managers[0].id) : '',
      numRooms: 0
    });
    setShowNewOwnerForm(false);
    setIsPropertyModalOpen(true);
  };

  const handleDeleteProperty = async (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este inmueble y todas sus habitaciones?')) {
      await db.deleteProperty(id);
      const props = await db.getProperties();
      setProperties(props);
    }
  };

  const handleCreateNewOwner = async () => {
    if (!newOwnerName.trim()) {
      alert('Por favor ingresa el nombre del propietario');
      return;
    }

    try {
      setCreatingOwner(true);
      const newOwner: Owner = {
        id: 'temp_' + Date.now(),
        name: newOwnerName,
        dni: '',
        phone: '',
        taxId: '',
        commission: 0,
        invoiceSeries: '',
        lastInvoiceNumber: 0
      };
      await db.saveOwner(newOwner);
      const updatedOwners = await db.getOwners();
      setOwners(updatedOwners);
      
      // Set the new owner as selected
      const createdOwner = updatedOwners.find(o => o.name === newOwnerName);
      if (editingProperty && createdOwner) {
        setEditingProperty({
          ...editingProperty,
          owner: String(createdOwner.id)
        });
      }
      
      setNewOwnerName('');
      setShowNewOwnerForm(false);
      alert('Propietario creado exitosamente');
    } catch (error: any) {
      alert('Error al crear propietario: ' + (error?.message || 'Error desconocido'));
    } finally {
      setCreatingOwner(false);
    }
  };

  const isNewProperty = editingProperty && String(editingProperty.id).startsWith('temp_');

  const getDocTypeFromFilename = (filename: string): PropertyDocType | null => {
    const first = filename.split('-')[0] || '';
    const match = PROPERTY_DOCS.find(doc => doc.type === first);
    return match ? match.type : null;
  };

  const loadPropertyFiles = async (propertyId: string) => {
    try {
      const response = await fetch(`/api/files/property/${propertyId}`);
      if (!response.ok) {
        setPropertyFiles(createEmptyDocMap());
        return;
      }
      const data = await response.json();
      const files = Array.isArray(data?.files) ? data.files : [];
      const mapped = createEmptyDocMap();
      files.forEach((file: PropertyFileInfo) => {
        const type = (file.type as PropertyDocType) || getDocTypeFromFilename(file.filename) || null;
        if (type && mapped[type]) {
          mapped[type].push(file);
        }
      });
      setPropertyFiles(mapped);
    } catch (error: any) {
      setPropertyFiles(createEmptyDocMap());
    }
  };

  const handlePropertyDocUpload = async (type: PropertyDocType, file: File) => {
    if (!editingProperty) return;
    const propertyId = String(editingProperty.id || '');
    if (!propertyId || propertyId.startsWith('temp_')) {
      alert('Guarda el inmueble antes de subir documentos.');
      return;
    }
    setDocUploading(prev => ({ ...prev, [type]: true }));
    setDocError(prev => ({ ...prev, [type]: null }));
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('file', file);
      const response = await fetch(`/api/upload/property/${propertyId}?type=${encodeURIComponent(type)}`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al subir documento');
      }
      await loadPropertyFiles(propertyId);
    } catch (error: any) {
      setDocError(prev => ({ ...prev, [type]: error?.message || 'Error al subir documento' }));
    } finally {
      setDocUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handlePropertyDocDelete = async (type: PropertyDocType, filename: string) => {
    if (!editingProperty) return;
    if (!confirm('¿Eliminar este archivo?')) return;
    const propertyId = String(editingProperty.id || '');
    try {
      const response = await fetch(`/api/files/property/${propertyId}/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (!response.ok && response.status !== 404) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo eliminar el archivo');
      }
      await loadPropertyFiles(propertyId);
    } catch (error: any) {
      setDocError(prev => ({ ...prev, [type]: error?.message || 'Error al eliminar el archivo' }));
    }
  };

  useEffect(() => {
    if (!isPropertyModalOpen || !editingProperty) return;
    const propertyId = String(editingProperty.id || '');
    if (!propertyId || propertyId.startsWith('temp_')) {
      setPropertyFiles(createEmptyDocMap());
      setDocError(createEmptyErrorMap());
      return;
    }
    loadPropertyFiles(propertyId);
  }, [isPropertyModalOpen, editingProperty?.id]);

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
        {properties.map(p => {
          const ownerData = owners.find(o => String(o.id) === String(p.owner));
          const managerData = managers.find(m => String(m.id) === String(p.managerId));
          return (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
              <div className="flex justify-between items-start">
                 <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                 </div>
                 <div className="flex space-x-1">
                    <button onClick={() => { setEditingProperty(p); setShowNewOwnerForm(false); setIsPropertyModalOpen(true); }} className="p-2 text-gray-400 hover:text-blue-600">
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
                <span className="text-gray-400">Propietario: {ownerData?.name || p.owner}</span>
              </div>
              <div className="text-xs text-gray-500">Gestor: {managerData?.name || 'Sin asignar'}</div>
            </div>
          );
        })}
      </div>

      {isPropertyModalOpen && editingProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
             <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Inmueble</h2>
                <button onClick={() => setIsPropertyModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
             </div>
             <form onSubmit={handleSaveProperty} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
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
                  {!showNewOwnerForm ? (
                    <div className="space-y-2">
                      <select 
                        required className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                        value={editingProperty.owner} 
                        onChange={e => setEditingProperty({...editingProperty, owner: e.target.value})}
                      >
                        <option value="">Selecciona un propietario</option>
                        {owners.map(owner => (
                          <option key={owner.id} value={String(owner.id)}>
                            {owner.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowNewOwnerForm(true)}
                        className="w-full text-xs text-blue-600 font-semibold hover:text-blue-800 p-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition-all"
                      >
                        + Crear Nuevo Propietario
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Nombre del propietario"
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                        value={newOwnerName}
                        onChange={e => setNewOwnerName(e.target.value)}
                      />
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={handleCreateNewOwner}
                          disabled={creatingOwner}
                          className="flex-1 bg-green-600 text-white text-xs font-semibold p-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                        >
                          {creatingOwner ? 'Creando...' : 'Crear'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewOwnerForm(false);
                            setNewOwnerName('');
                          }}
                          className="flex-1 bg-gray-300 text-gray-700 text-xs font-semibold p-2 rounded-lg hover:bg-gray-400"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Gestor</label>
                  <select
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                    value={editingProperty.managerId || ''}
                    onChange={e => setEditingProperty({ ...editingProperty, managerId: e.target.value })}
                  >
                    <option value="">Sin asignar</option>
                    {managers.map(manager => (
                      <option key={manager.id} value={String(manager.id)}>
                        {manager.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Número de Habitaciones</label>
                  <input 
                    required type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                    value={editingProperty.numRooms} onChange={e => setEditingProperty({...editingProperty, numRooms: Number(e.target.value)})}
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-600 uppercase tracking-widest">Documentos del inmueble</h3>
                    {isNewProperty && (
                      <span className="text-[10px] text-gray-400">Guarda el inmueble antes de subir documentos.</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {PROPERTY_DOCS.map(doc => (
                      <div key={doc.type} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-700 uppercase">{doc.label}</span>
                        </div>
                        <input
                          type="file"
                          disabled={isNewProperty || docUploading[doc.type]}
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePropertyDocUpload(doc.type, file);
                            e.currentTarget.value = '';
                          }}
                          className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {docUploading[doc.type] && (
                          <p className="text-[11px] text-blue-600 mt-1">Subiendo...</p>
                        )}
                        {docError[doc.type] && (
                          <p className="text-[11px] text-red-600 mt-1">{docError[doc.type]}</p>
                        )}
                        {propertyFiles[doc.type]?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {propertyFiles[doc.type].map(file => (
                              <div key={file.filename} className="flex items-center justify-between gap-2">
                                <a
                                  className="text-[11px] font-semibold text-blue-700 hover:underline truncate"
                                  href={`/api${file.path}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {file.filename}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handlePropertyDocDelete(doc.type, file.filename)}
                                  className="text-[10px] font-bold text-red-600 hover:underline"
                                >
                                  Borrar
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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

export default Properties;
