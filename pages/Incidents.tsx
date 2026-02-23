import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../services/db';
import { Incident, IncidentLine, Property } from '../types';

export const Incidents: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const [listTab, setListTab] = useState<'active' | 'archived'>('active');
  const [filterPropertyId, setFilterPropertyId] = useState('all');
  const [filterSolved, setFilterSolved] = useState<'all' | 'yes' | 'no'>('all');
  const [filterRefactured, setFilterRefactured] = useState<'all' | 'yes' | 'no'>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [incidentFiles, setIncidentFiles] = useState<Array<{ filename: string; url: string }>>([]);
  const [incidentDragOver, setIncidentDragOver] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [incidentList, propertyList] = await Promise.all([
        db.getIncidents(),
        db.getProperties()
      ]);
      setIncidents(incidentList);
      setProperties(propertyList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!editingIncident) return;
    if (!editingIncident.propertyId && properties.length > 0) {
      setEditingIncident(prev => prev ? { ...prev, propertyId: String(properties[0].id) } : prev);
    }
  }, [properties, editingIncident?.propertyId]);

  const activeCount = useMemo(() => incidents.filter(i => !i.archived).length, [incidents]);
  const archivedCount = useMemo(() => incidents.filter(i => i.archived).length, [incidents]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter(incident => {
      if (listTab === 'active' && incident.archived) return false;
      if (listTab === 'archived' && !incident.archived) return false;
      if (filterPropertyId !== 'all' && String(incident.propertyId) !== String(filterPropertyId)) return false;
      if (filterSolved !== 'all' && incident.solved !== (filterSolved === 'yes')) return false;
      if (filterRefactured !== 'all' && incident.refactured !== (filterRefactured === 'yes')) return false;
      if (filterStartDate) {
        const created = incident.createdAt ? new Date(incident.createdAt) : null;
        const start = new Date(filterStartDate);
        if (created && created < start) return false;
      }
      if (filterEndDate) {
        const created = incident.createdAt ? new Date(incident.createdAt) : null;
        const end = new Date(filterEndDate);
        if (created && created > end) return false;
      }
      return true;
    });
  }, [incidents, listTab, filterPropertyId, filterSolved, filterRefactured, filterStartDate, filterEndDate]);

  const totalPendingRefacture = useMemo(() => {
    return filteredIncidents
      .filter(incident => !incident.refactured)
      .reduce((sum, incident) => sum + (Number(incident.total) || 0), 0);
  }, [filteredIncidents]);

  const getPropertyName = (propertyId: string) => {
    const prop = properties.find(p => String(p.id) === String(propertyId));
    return prop ? prop.name : 'N/A';
  };

  const handleNew = () => {
    const newId = 'temp_' + Math.random().toString(36).substr(2, 9);
    const defaultPropertyId = properties.length > 0 ? String(properties[0].id) : '';
    setEditingIncident({
      id: newId,
      propertyId: defaultPropertyId,
      title: '',
      solved: false,
      refactured: false,
      archived: false,
      lines: [{ description: '', amount: 0 }],
      total: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setIncidentFiles([]);
    setUploadError(null);
    setIsModalOpen(true);
  };

  const handleEdit = (incident: Incident) => {
    setEditingIncident({
      ...incident,
      lines: incident.lines && incident.lines.length > 0 ? incident.lines : [{ description: '', amount: 0 }]
    });
    setIncidentFiles([]);
    setUploadError(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que quieres eliminar esta incidencia?')) return;
    try {
      await db.deleteIncident(id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Error al eliminar incidencia');
    }
  };

  const handleToggleArchive = async (incident: Incident, archived: boolean) => {
    try {
      await db.saveIncident({ ...incident, archived });
      setIncidents(prev => prev.map(i => String(i.id) === String(incident.id) ? { ...i, archived } : i));
    } catch (err: any) {
      alert(err?.message || 'Error al actualizar incidencia');
    }
  };

  const totalAmount = useMemo(() => {
    if (!editingIncident) return 0;
    return (editingIncident.lines || []).reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  }, [editingIncident]);

  const updateLine = (index: number, patch: Partial<IncidentLine>) => {
    if (!editingIncident) return;
    const updatedLines = editingIncident.lines.map((line, i) => i === index ? { ...line, ...patch } : line);
    setEditingIncident({ ...editingIncident, lines: updatedLines });
  };

  const addLine = () => {
    if (!editingIncident) return;
    setEditingIncident({
      ...editingIncident,
      lines: [...editingIncident.lines, { description: '', amount: 0 }]
    });
  };

  const removeLine = (index: number) => {
    if (!editingIncident) return;
    const updated = editingIncident.lines.filter((_, i) => i !== index);
    setEditingIncident({ ...editingIncident, lines: updated.length ? updated : [{ description: '', amount: 0 }] });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIncident) return;
    if (!editingIncident.title.trim()) {
      alert('Introduce un nombre para la incidencia.');
      return;
    }
    if (!editingIncident.propertyId || String(editingIncident.propertyId).trim() === '') {
      alert('Selecciona un inmueble.');
      return;
    }

    const toSave: Incident = {
      ...editingIncident,
      total: totalAmount,
      updatedAt: new Date().toISOString()
    };

    try {
      await db.saveIncident(toSave);
      await loadData();
      setIsModalOpen(false);
      setEditingIncident(null);
    } catch (err: any) {
      alert(err?.message || 'Error al guardar incidencia');
    }
  };

  const loadIncidentFiles = async (incidentId: string) => {
    try {
      const response = await fetch(`/api/files/incident/${incidentId}`);
      if (!response.ok) {
        setIncidentFiles([]);
        return;
      }
      const data = await response.json();
      const files = Array.isArray(data?.files) ? data.files : [];
      const normalized = files.map((file: any) => ({
        filename: file.filename,
        url: file.path || `/uploads/incidents/${incidentId}/${file.filename}`
      }));
      setIncidentFiles(normalized);
    } catch (error: any) {
      setIncidentFiles([]);
      setUploadError(error?.message || 'Error al cargar documentos');
    }
  };

  useEffect(() => {
    if (!isModalOpen || !editingIncident) return;
    const incidentId = String(editingIncident.id || '');
    if (!incidentId || incidentId.startsWith('temp_')) {
      setIncidentFiles([]);
      return;
    }
    loadIncidentFiles(incidentId);
  }, [isModalOpen, editingIncident?.id]);

  const handleIncidentUpload = async (file: File) => {
    if (!editingIncident) return;
    const incidentId = String(editingIncident.id || '');
    if (!incidentId || incidentId.startsWith('temp_')) {
      alert('Guarda la incidencia antes de subir documentos.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/upload/incident/${incidentId}`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al subir documento');
      }
      await loadIncidentFiles(incidentId);
    } catch (error: any) {
      setUploadError(error?.message || 'Error al subir documento');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (incidentId: string, filename: string) => {
    if (!confirm('¿Eliminar este archivo?')) return;
    try {
      const response = await fetch(`/api/files/incident/${incidentId}/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (!response.ok && response.status !== 404) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo eliminar el archivo');
      }
      await loadIncidentFiles(incidentId);
    } catch (error: any) {
      setUploadError(error?.message || 'Error al eliminar el archivo');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Incidencias</h1>
          <p className="text-sm text-gray-500">Registro de incidencias por inmueble</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
            <div className="text-[10px] font-black text-amber-600 uppercase">Pendiente de Refacturar</div>
            <div className="text-xl font-black text-amber-700">€{totalPendingRefacture.toFixed(2)}</div>
          </div>
          <button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all">
            Nueva Incidencia
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Inmueble</label>
            <select
              value={filterPropertyId}
              onChange={e => setFilterPropertyId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Solucionado</label>
            <select
              value={filterSolved}
              onChange={e => setFilterSolved(e.target.value as 'all' | 'yes' | 'no')}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="yes">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Refacturado</label>
            <select
              value={filterRefactured}
              onChange={e => setFilterRefactured(e.target.value as 'all' | 'yes' | 'no')}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="yes">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Desde</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={e => setFilterStartDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Hasta</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={e => setFilterEndDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button
            type="button"
            onClick={() => setListTab('active')}
            className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
              listTab === 'active'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Activas ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setListTab('archived')}
            className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
              listTab === 'archived'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Archivadas ({archivedCount})
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase">Incidencia</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase">Inmueble</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase">Creación</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase">Solucionado</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase">Refacturado</th>
                <th className="px-6 py-3 text-right text-xs font-black text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map(incident => (
                <tr key={incident.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{incident.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{getPropertyName(incident.propertyId)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {incident.createdAt ? new Date(incident.createdAt).toLocaleDateString('es-ES') : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-blue-600">€{Number(incident.total || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${incident.solved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {incident.solved ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${incident.refactured ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                      {incident.refactured ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm space-x-2">
                    <button
                      onClick={() => handleEdit(incident)}
                      className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors"
                    >
                      Editar
                    </button>
                    {incident.archived ? (
                      <button
                        onClick={() => handleToggleArchive(incident, false)}
                        className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-colors"
                      >
                        Activar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleArchive(incident, true)}
                        className="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                      >
                        Archivar
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(incident.id)}
                      className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredIncidents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-6 text-center text-sm text-gray-500">
                    {listTab === 'active' ? 'No hay incidencias activas' : 'No hay incidencias archivadas'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && editingIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-auto overflow-hidden border border-gray-100">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Incidencia</h2>
                <span className="text-xs text-gray-400">{editingIncident.id}</span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                    value={editingIncident.title}
                    onChange={e => setEditingIncident({ ...editingIncident, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Inmueble</label>
                  <select
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                    value={String(editingIncident.propertyId || '')}
                    onChange={e => setEditingIncident({ ...editingIncident, propertyId: e.target.value })}
                  >
                    <option value="">Selecciona un inmueble</option>
                    {properties.map(p => (
                      <option key={p.id} value={String(p.id)}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="flex items-center space-x-2 text-sm font-bold text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={editingIncident.solved}
                    onChange={e => setEditingIncident({ ...editingIncident, solved: e.target.checked })}
                  />
                  <span>Solucionado</span>
                </label>
                <label className="flex items-center space-x-2 text-sm font-bold text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={editingIncident.refactured}
                    onChange={e => setEditingIncident({ ...editingIncident, refactured: e.target.checked })}
                  />
                  <span>Refacturado</span>
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Líneas</h3>
                  <button type="button" onClick={addLine} className="text-xs font-bold text-blue-600 hover:underline">Añadir línea</button>
                </div>
                <div className="space-y-3">
                  {editingIncident.lines.map((line, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-center">
                      <input
                        type="text"
                        className="col-span-7 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-semibold text-gray-800"
                        placeholder="Concepto"
                        value={line.description}
                        onChange={e => updateLine(index, { description: e.target.value })}
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        className="col-span-3 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-semibold text-gray-800"
                        placeholder="Importe"
                        value={line.amount}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9.,]/g, '');
                          updateLine(index, { amount: raw });
                        }}
                        onBlur={e => {
                          const num = Number(String(e.target.value).replace(',', '.')) || 0;
                          updateLine(index, { amount: num });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="col-span-2 text-xs font-bold text-red-600 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end text-sm font-black text-gray-800">
                  Total: €{totalAmount.toFixed(2)}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Documentos</h3>
                <label
                  className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${incidentDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-white'}`}
                  onDragOver={(e) => { e.preventDefault(); setIncidentDragOver(true); }}
                  onDragLeave={() => setIncidentDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIncidentDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleIncidentUpload(file);
                  }}
                >
                  <svg className={`w-6 h-6 mb-1 ${incidentDragOver ? 'text-blue-500' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                  <span className="text-xs font-bold text-gray-400">{uploading ? 'Subiendo...' : 'Arrastra un archivo o haz click'}</span>
                  <input
                    type="file"
                    disabled={uploading}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleIncidentUpload(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
                {uploadError && <p className="text-xs font-bold text-red-600">{uploadError}</p>}
                {String(editingIncident.id).startsWith('temp_') && (
                  <p className="text-xs text-gray-500">Guarda la incidencia antes de subir documentos.</p>
                )}
                {incidentFiles.length > 0 && (
                  <div className="space-y-1">
                    {incidentFiles.map(file => (
                      <div key={file.filename} className="flex items-center justify-between gap-3">
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
                          onClick={() => handleDeleteFile(String(editingIncident.id), file.filename)}
                          className="text-[10px] font-black text-red-600 hover:underline"
                        >
                          Borrar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-6 flex justify-end space-x-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-xs tracking-widest">Cancelar</button>
                <button type="submit" className="px-12 py-3 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 transform hover:-translate-y-0.5 transition-all uppercase text-xs tracking-widest">
                  Guardar Incidencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
