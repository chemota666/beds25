import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Owner } from '../types';

export const Owners: React.FC = () => {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [contractUploadError, setContractUploadError] = useState<string | null>(null);
  const [contractFileName, setContractFileName] = useState<string | null>(null);
  const [contractFiles, setContractFiles] = useState<Array<{ filename: string; url: string }>>([]);

  useEffect(() => {
    loadOwners();
  }, []);

  const loadOwners = async () => {
    setLoading(true);
    const data = await db.getOwners();
    setOwners(data);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOwner) {
      try {
        setLoading(true);
        await db.saveOwner(editingOwner);
        await loadOwners();
        setIsModalOpen(false);
        setEditingOwner(null);
        alert('✅ Propietario guardado correctamente');
      } catch (error: any) {
        alert('❌ Error al guardar propietario: ' + (error?.message || 'Error desconocido'));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleNew = () => {
    const newId = 'temp_' + Math.random().toString(36).substr(2, 9);
    setEditingOwner({
      id: newId,
      name: '',
      dni: '',
      phone: '',
      invoiceSeries: '',
      lastInvoiceNumber: 0,
      taxId: '',
      taxAddress: '',
      commission: 0
    });
    setContractFiles([]);
    setContractUploadError(null);
    setContractFileName(null);
    setIsModalOpen(true);
  };

  const handleEdit = (owner: Owner) => {
    setEditingOwner({...owner});
    setContractUploadError(null);
    setContractFileName(null);
    setContractFiles([]);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Seguro que quieres eliminar este propietario?')) {
      setLoading(true);
      await db.deleteOwner(id);
      await loadOwners();
    }
  };

  const handleContractUpload = async (file: File) => {
    if (!editingOwner) return;
    const ownerId = String(editingOwner.id || '');
    if (!ownerId || ownerId.startsWith('temp_')) {
      alert('Guarda el propietario antes de subir el contrato.');
      return;
    }

    setUploadingContract(true);
    setContractUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/upload/owner/${ownerId}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al subir el contrato');
      }

      const result = await response.json();
      setContractFileName(result?.originalName || file.name);
      await loadOwnerContracts(ownerId);
      alert('✅ Contrato subido correctamente');
    } catch (error: any) {
      setContractUploadError(error?.message || 'Error al subir el contrato');
    } finally {
      setUploadingContract(false);
    }
  };

  const loadOwnerContracts = async (ownerId: string) => {
    try {
      const response = await fetch(`/api/files/owner/${ownerId}`);
      if (response.status === 404) {
        setContractFiles([]);
        return;
      }
      if (!response.ok) throw new Error('No se pudo obtener la lista de contratos');
      const data = await response.json();
      const files = Array.isArray(data?.files) ? data.files : [];
      const normalized = files.map((file: any) => ({
        filename: file.filename,
        url: file.path || `/uploads/owners/${ownerId}/${file.filename}`
      }));
      setContractFiles(normalized);
    } catch (error: any) {
      setContractFiles([]);
      setContractUploadError(error?.message || 'Error al cargar contratos');
    }
  };

  const handleDeleteContract = async (ownerId: string, filename: string) => {
    if (!confirm('¿Eliminar este archivo?')) return;
    try {
      const response = await fetch(`/api/files/owner/${ownerId}/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (response.status === 404) {
        await loadOwnerContracts(ownerId);
        return;
      }
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo eliminar el archivo');
      }
      await loadOwnerContracts(ownerId);
    } catch (error: any) {
      setContractUploadError(error?.message || 'Error al eliminar el archivo');
    }
  };

  useEffect(() => {
    if (!isModalOpen || !editingOwner) return;
    const ownerId = String(editingOwner.id || '');
    if (!ownerId || ownerId.startsWith('temp_')) {
      setContractFiles([]);
      return;
    }
    loadOwnerContracts(ownerId);
  }, [isModalOpen, editingOwner?.id]);

  const isNewOwner = editingOwner && String(editingOwner.id).startsWith('temp_');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Gestión de Propietarios</h1>
          <p className="text-sm text-gray-500">Administra los datos fiscales, bancarios y comisiones.</p>
        </div>
        <button disabled={loading} onClick={handleNew} className={`${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all flex items-center`}>
          {loading ? (
            <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Cargando...</>
          ) : (
            'Nuevo Propietario'
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {owners.map(o => (
          <div key={o.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div className="bg-blue-100 text-blue-600 p-3 rounded-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => handleEdit(o)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button onClick={() => handleDelete(o.id)} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">{o.name}</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase">ID: {o.id}</p>
              {o.taxId && <p className="text-sm text-gray-600 mt-1">🏛️ {o.taxId}</p>}
            </div>
            <div className="space-y-1 text-sm pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">DNI:</span>
                <span className="font-semibold text-gray-800">{o.dni || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Tel:</span>
                <span className="font-semibold text-gray-800">{o.phone || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Comisión:</span>
                <span className="font-black text-blue-600">{o.commission || 0}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Serie:</span>
                <span className="font-mono text-gray-700">{o.invoiceSeries}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && editingOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-auto overflow-hidden border border-gray-100">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Ficha del Propietario</h2>
                <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest mt-1 inline-block">
                  {isNewOwner ? 'Nuevo Propietario' : `Propietario #${editingOwner.id}`}
                </span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-8">
              {/* SECCIÓN 1: DATOS PERSONALES */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">📋 Datos Personales</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre</label>
                    <input required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingOwner.name} onChange={e => setEditingOwner({...editingOwner, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">DNI / NIE</label>
                    <input required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingOwner.dni} onChange={e => setEditingOwner({...editingOwner, dni: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Teléfono</label>
                    <input type="tel" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingOwner.phone || ''} onChange={e => setEditingOwner({...editingOwner, phone: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: DATOS FISCALES */}
              <div className="space-y-4 p-6 bg-orange-50 rounded-2xl border border-orange-200">
                <h3 className="text-xs font-black text-orange-600 uppercase tracking-[0.2em]">🏛️ Datos Fiscales</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-1">CIF / NIF</label>
                    <input type="text" className="w-full bg-white border border-orange-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-orange-50 outline-none transition-all" placeholder="Número de identificación fiscal" value={editingOwner.taxId || ''} onChange={e => setEditingOwner({...editingOwner, taxId: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-1">Dirección Fiscal</label>
                    <input type="text" className="w-full bg-white border border-orange-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-orange-50 outline-none transition-all" placeholder="Dirección fiscal" value={editingOwner.taxAddress || ''} onChange={e => setEditingOwner({...editingOwner, taxAddress: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-1">Comisión (%)</label>
                    <input type="number" min="0" max="100" step="0.5" className="w-full bg-white border border-orange-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-orange-50 outline-none transition-all" value={editingOwner.commission || 0} onChange={e => setEditingOwner({...editingOwner, commission: parseFloat(e.target.value)})} />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: SERIE DE FACTURACIÓN (ID PROPIETARIO) */}
              <div className="space-y-4 p-6 bg-purple-50 rounded-2xl border border-purple-200">
                <h3 className="text-xs font-black text-purple-600 uppercase tracking-[0.2em]">📝 Serie de Facturación (ID Propietario)</h3>
                <p className="text-xs text-purple-600 italic mb-4">La serie se genera automáticamente basada en el ID del propietario. Primera factura: {String(editingOwner.id)}/001</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-purple-600 uppercase tracking-widest ml-1">Serie (Solo Lectura)</label>
                    <div className="w-full bg-purple-100 border border-purple-300 rounded-xl p-3 font-mono font-bold text-gray-800">
                      {String(editingOwner.id)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-purple-600 uppercase tracking-widest ml-1">Próximo Número</label>
                    <div className="w-full bg-purple-100 border border-purple-300 rounded-xl p-3 font-mono font-bold text-gray-800">
                      {String((editingOwner.lastInvoiceNumber || 0) + 1).padStart(3, '0')}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 4: CONTRATO */}
              <div className="space-y-4 p-6 bg-blue-50 rounded-2xl border border-blue-200">
                <h3 className="text-xs font-black text-blue-600 uppercase tracking-[0.2em]">📄 Contrato del Propietario</h3>
                <p className="text-xs text-blue-600 italic">Formatos permitidos: PDF, DOC, DOCX (máx. 10MB)</p>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    disabled={uploadingContract}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleContractUpload(file);
                      e.currentTarget.value = '';
                    }}
                    className="w-full bg-white border border-blue-200 rounded-xl p-3 font-semibold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                  />
                  {uploadingContract && (
                    <p className="text-xs font-bold text-blue-600">Subiendo contrato...</p>
                  )}
                  {contractFileName && (
                    <p className="text-xs font-bold text-green-600">Archivo subido: {contractFileName}</p>
                  )}
                  {contractUploadError && (
                    <p className="text-xs font-bold text-red-600">{contractUploadError}</p>
                  )}
                  {isNewOwner && (
                    <p className="text-xs text-gray-500">Guarda el propietario antes de subir el contrato.</p>
                  )}
                  {!isNewOwner && contractFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Contratos guardados</p>
                      <ul className="space-y-1">
                        {contractFiles.map(file => (
                          <li key={file.filename} className="flex items-center justify-between gap-3">
                            <a
                              className="text-xs font-bold text-blue-700 hover:underline truncate"
                              href={`/api${file.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {file.filename}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteContract(String(editingOwner.id), file.filename)}
                              className="text-[10px] font-black text-red-600 hover:underline"
                            >
                              Borrar
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 flex justify-end space-x-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-xs tracking-widest">Cancelar</button>
                <button type="submit" disabled={loading} className="px-12 py-3 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:bg-gray-400 transform hover:-translate-y-0.5 transition-all uppercase text-xs tracking-widest">
                  {loading ? 'Guardando...' : 'Guardar Propietario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Owners;
