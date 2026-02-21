
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Guest, Sex, Reservation, Property, Room } from '../types';
import { ReservationModal } from '../components/ReservationModal';

type GuestDocField = 'dniFile' | 'contractFile' | 'depositReceiptFile';

export const Guests: React.FC = () => {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [guestReservations, setGuestReservations] = useState<Reservation[]>([]);
  const [listTab, setListTab] = useState<'active' | 'archived'>('active');
  const [activeTab, setActiveTab] = useState<'datos' | 'historial' | 'documentos'>('datos');
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [docUploading, setDocUploading] = useState<Record<GuestDocField, boolean>>({
    dniFile: false,
    contractFile: false,
    depositReceiptFile: false
  });
  const [docError, setDocError] = useState<Record<GuestDocField, string | null>>({
    dniFile: null,
    contractFile: null,
    depositReceiptFile: null
  });
  const [resModalOpen, setResModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  useEffect(() => {
    const loadGuests = async () => {
      setLoading(true);
      const [guestData, propertyData, roomData] = await Promise.all([
        db.getGuests(),
        db.getProperties(),
        db.getRooms()
      ]);
      const normalizedGuests = guestData.map((g: Guest) => ({
        ...g,
        archived: Boolean(g.archived)
      }));
      setGuests(normalizedGuests);
      setProperties(propertyData);
      setRooms(roomData);
      setLoading(false);
    };
    loadGuests();
  }, []);

  useEffect(() => {
    const loadGuestReservations = async () => {
      try {
        if (editingGuest) {
          const allReservations = await db.getReservations();
          const filtered = allReservations.filter(r => String(r.guestId) === String(editingGuest.id));
          setGuestReservations(filtered);
        } else {
          setGuestReservations([]);
        }
      } catch (error) {
        console.error('Error cargando reservas del huésped:', error);
        setGuestReservations([]);
      }
    };
    loadGuestReservations();
  }, [editingGuest?.id]);

  const isGuestDocsComplete = (guest: Guest) => !!(guest.dniFile && guest.contractFile && guest.depositReceiptFile);

  const completeCount = useMemo(() => guests.filter(isGuestDocsComplete).length, [guests]);
  const incompleteCount = useMemo(() => guests.length - completeCount, [guests, completeCount]);
  const activeGuestsList = useMemo(() => guests.filter(g => !g.archived), [guests]);
  const archivedGuestsList = useMemo(() => guests.filter(g => g.archived), [guests]);
  const activeCount = useMemo(() => activeGuestsList.length, [activeGuestsList]);
  const archivedCount = useMemo(() => archivedGuestsList.length, [archivedGuestsList]);
  const activeCompleteCount = useMemo(() => activeGuestsList.filter(isGuestDocsComplete).length, [activeGuestsList]);
  const activeIncompleteCount = useMemo(() => activeCount - activeCompleteCount, [activeCount, activeCompleteCount]);
  const archivedCompleteCount = useMemo(() => archivedGuestsList.filter(isGuestDocsComplete).length, [archivedGuestsList]);
  const archivedIncompleteCount = useMemo(() => archivedCount - archivedCompleteCount, [archivedCount, archivedCompleteCount]);

  const filteredGuests = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return guests.filter(g => {
      if (listTab === 'active' && g.archived) return false;
      if (listTab === 'archived' && !g.archived) return false;
      if (showIncompleteOnly && isGuestDocsComplete(g)) return false;
      return (
        g.name.toLowerCase().includes(lower) || 
        g.surname.toLowerCase().includes(lower) || 
        g.dni.toLowerCase().includes(lower)
      );
    }).sort((a, b) => {
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      return idA - idB;
    });
  }, [guests, searchTerm, showIncompleteOnly, listTab]);

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGuest) {
      try {
        setLoading(true);
        await db.saveGuest(editingGuest);
        const data = await db.getGuests();
        setGuests(data);
        setIsModalOpen(false);
        setEditingGuest(null);
        alert('✅ Huésped guardado correctamente');
      } catch (error: any) {
        alert('❌ Error al guardar huésped: ' + (error?.message || 'Error desconocido'));
      } finally {
        setLoading(false);
      }
    }
  };

  const updateGuestInState = (updated: Guest) => {
    setEditingGuest(updated);
    setGuests(prev => prev.map(g => String(g.id) === String(updated.id) ? { ...g, ...updated } : g));
  };

  const handleToggleArchive = async (guest: Guest, archived: boolean) => {
    try {
      setLoading(true);
      const updated = { ...guest, archived };
      await db.saveGuest(updated as Guest);
      updateGuestInState(updated as Guest);
    } catch (error: any) {
      alert('❌ Error al actualizar estado del huésped: ' + (error?.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const getGuestId = () => String(editingGuest?.id || '');

  const ensureGuestSaved = () => {
    const guestId = getGuestId();
    if (!guestId || guestId.startsWith('temp_')) {
      alert('Guarda el huésped antes de subir documentos.');
      return false;
    }
    return true;
  };

  const uploadGuestDocument = async (field: GuestDocField, file: File) => {
    if (!editingGuest) return;
    if (!ensureGuestSaved()) return;

    const guestId = getGuestId();
    setDocUploading(prev => ({ ...prev, [field]: true }));
    setDocError(prev => ({ ...prev, [field]: null }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/upload/guest/${guestId}` , {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al subir el documento');
      }

      const result = await response.json();
      const filePath = result?.file?.path || result?.path || result?.url;
      const updatedGuest = { ...editingGuest, [field]: filePath || '' } as Guest;

      await db.saveGuest(updatedGuest);
      updateGuestInState(updatedGuest);
    } catch (error: any) {
      setDocError(prev => ({ ...prev, [field]: error?.message || 'Error al subir el documento' }));
    } finally {
      setDocUploading(prev => ({ ...prev, [field]: false }));
    }
  };

  const extractGuestFilename = (value: string) => {
    if (!value) return null;
    try {
      const pathValue = value.startsWith('http') ? new URL(value).pathname : value;
      const parts = pathValue.split('/').filter(Boolean);
      return parts.length ? parts[parts.length - 1] : null;
    } catch {
      const parts = value.split('/').filter(Boolean);
      return parts.length ? parts[parts.length - 1] : null;
    }
  };

  const handleDeleteDocument = async (field: GuestDocField) => {
    if (!editingGuest) return;
    const currentValue = editingGuest[field];
    if (!currentValue) return;
    if (!confirm('¿Seguro que quieres eliminar este documento?')) return;

    const guestId = getGuestId();
    const filename = extractGuestFilename(currentValue);

    try {
      if (filename && currentValue.includes('/uploads/guests/')) {
        const response = await fetch(`/api/files/guest/${guestId}/${encodeURIComponent(filename)}`, {
          method: 'DELETE'
        });
        if (!response.ok && response.status !== 404) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'No se pudo eliminar el documento');
        }
      }

      const updatedGuest = { ...editingGuest, [field]: '' } as Guest;
      await db.saveGuest(updatedGuest);
      updateGuestInState(updatedGuest);
    } catch (error: any) {
      setDocError(prev => ({ ...prev, [field]: error?.message || 'Error al eliminar el documento' }));
    }
  };

  const smartDownload = async (data: string, filename: string) => {
    if (!data) return;
    const fallbackBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'https://n8n-contabo.ddns.net:8444'
      : '';
    // Si es URL (Drive o uploads), abrir en nueva pestaña
    if (data.startsWith('http')) {
      try {
        const url = new URL(data);
        if (url.pathname.startsWith('/uploads/')) {
          const downloadUrl = `${url.origin}/api${url.pathname}`;
          const response = await fetch(downloadUrl);
          if (!response.ok) throw new Error('No se pudo descargar el documento');
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(blobUrl);
        } else {
          window.open(data, '_blank');
        }
      } catch {
        try {
          const url = new URL(data);
          if (url.pathname.startsWith('/uploads/')) {
            const localUrl = `${url.origin}/api${url.pathname}`;
            window.open(localUrl, '_blank');
          } else {
            window.open(data, '_blank');
          }
        } catch {
          window.open(data, '_blank');
        }
      }
    } else if (data.startsWith('/uploads/')) {
      try {
        const downloadUrl = `/api${data}`;
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error('No se pudo descargar el documento');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
      } catch {
        if (fallbackBase) {
          window.open(`${fallbackBase}/api${data}`, '_blank');
        } else {
          window.open(`/api${data}`, '_blank');
        }
      }
    } else {
      // Es base64
      const a = document.createElement('a');
      a.href = data;
      a.download = filename;
      a.click();
    }
  };

  const isNewGuest = editingGuest && String(editingGuest.id).startsWith('temp_');
  const roomsForDefaultProperty = useMemo(() => {
    if (!editingGuest?.defaultPropertyId) return [];
    return rooms.filter(r => String(r.propertyId) === String(editingGuest.defaultPropertyId));
  }, [rooms, editingGuest?.defaultPropertyId]);

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
            try {
              setEditingGuest({ 
                id: 'temp_' + Date.now(), 
                name: '', 
                surname: '', 
                dni: '', 
                nationality: 'Española', 
                sex: 'Masculino', 
                isRegistered: false,
                archived: false,
                defaultPropertyId: '',
                defaultRoomId: '',
                email: '',
                phone: '',
                notes: ''
              });
              setActiveTab('datos');
              setTimeout(() => {
                setIsModalOpen(true);
              }, 0);
            } catch (error) {
              console.error('Error creando nuevo huésped:', error);
              alert('Error al crear nuevo huésped');
            }
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
        {/* Tabs Activos / Archivados */}
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
            Huéspedes Activos ({activeCount})
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
            Huéspedes Archivados ({archivedCount})
          </button>
        </div>
        {/* Filtros de documentación + búsqueda */}
        <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowIncompleteOnly(false)}
            className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${
              !showIncompleteOnly ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700'
            }`}
          >
            Docs completas: {listTab === 'active' ? activeCompleteCount : archivedCompleteCount}
          </button>
          <button
            type="button"
            onClick={() => setShowIncompleteOnly(true)}
            className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${
              showIncompleteOnly ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700'
            }`}
          >
            Docs incompletas: {listTab === 'active' ? activeIncompleteCount : archivedIncompleteCount}
          </button>
          <input
            type="text"
            placeholder="Buscar por nombre, apellidos o DNI..."
            className="flex-1 min-w-[200px] bg-white border border-gray-200 rounded-xl px-4 py-2 outline-none focus:ring-4 focus:ring-blue-50 transition-all"
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
                      <button onClick={() => { 
                        try {
                          const guestData = {
                            ...g,
                            sex: g.sex || 'Masculino',
                            nationality: g.nationality || 'Española',
                            isRegistered: g.isRegistered || false,
                            archived: Boolean(g.archived)
                          };
                          setEditingGuest(guestData);
                          setActiveTab('datos');
                          // Usar setTimeout para garantizar que el estado se actualice primero
                          setTimeout(() => {
                            setIsModalOpen(true);
                          }, 0);
                        } catch (error) {
                          console.error('Error abriendo modal:', error);
                          alert('Error al abrir el formulario');
                        }
                      }} className="text-blue-600 font-bold text-xs uppercase tracking-wider hover:text-blue-800">Editar</button>
                      {g.archived ? (
                        <button
                          onClick={() => handleToggleArchive(g, false)}
                          className="text-emerald-600 font-bold text-xs uppercase tracking-wider hover:text-emerald-800"
                        >
                          Activar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleArchive(g, true)}
                          className="text-gray-500 font-bold text-xs uppercase tracking-wider hover:text-gray-700"
                        >
                          Archivar
                        </button>
                      )}
                      <button onClick={async () => { if(confirm('¿Seguro que quieres eliminar este huésped?')) { setLoading(true); try { await db.deleteGuest(g.id); setGuests(await db.getGuests()); } catch (err: any) { alert(err?.message || 'Error al eliminar huésped'); } finally { setLoading(false); } } }} className="text-red-300 hover:text-red-600 font-bold text-xs uppercase tracking-wider transition-colors">Borrar</button>
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

             {/* TABS NAVIGATION */}
             <div className="flex border-b border-gray-100 px-8">
               <button
                 onClick={() => setActiveTab('datos')}
                 className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                   activeTab === 'datos'
                     ? 'border-blue-600 text-blue-600'
                     : 'border-transparent text-gray-400 hover:text-gray-600'
                 }`}
               >
                 📋 Datos Personales
               </button>
               <button
                 onClick={() => setActiveTab('historial')}
                 className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                   activeTab === 'historial'
                     ? 'border-blue-600 text-blue-600'
                     : 'border-transparent text-gray-400 hover:text-gray-600'
                 }`}
               >
                 📅 Historial de Reservas
               </button>
               <button
                 onClick={() => setActiveTab('documentos')}
                 className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                   activeTab === 'documentos'
                     ? 'border-blue-600 text-blue-600'
                     : 'border-transparent text-gray-400 hover:text-gray-600'
                 }`}
               >
                 📁 Documentos
               </button>
             </div>
             
             <form onSubmit={handleSaveGuest} className="p-8 space-y-8">
               {/* TAB: DATOS PERSONALES */}
               {activeTab === 'datos' && (
                 <div className="space-y-8">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                     <div className="space-y-1">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre</label>
                       <input required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingGuest.name} onChange={e => setEditingGuest({...editingGuest, name: e.target.value})} />
                     </div>
                     <div className="space-y-1">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Apellidos</label>
                       <input required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingGuest.surname} onChange={e => setEditingGuest({...editingGuest, surname: e.target.value})} />
                     </div>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                     <div className="space-y-1">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">DNI / NIE</label>
                       <input required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingGuest.dni} onChange={e => setEditingGuest({...editingGuest, dni: e.target.value})} />
                     </div>
                     <div className="space-y-1">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sexo</label>
                       <select className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingGuest.sex || 'Masculino'} onChange={e => setEditingGuest({...editingGuest, sex: e.target.value as Sex})}>
                         <option value="Masculino">Masculino</option>
                         <option value="Femenino">Femenino</option>
                         <option value="Otro">Otro</option>
                       </select>
                     </div>
                     <div className="space-y-1">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nacionalidad</label>
                       <input required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all" value={editingGuest.nationality || 'Española'} onChange={e => setEditingGuest({...editingGuest, nationality: e.target.value})} />
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

                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-blue-50 rounded-2xl border border-blue-100">
                     <div className="space-y-1">
                       <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Inmueble predeterminado</label>
                       <select
                         className="w-full bg-white border border-blue-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                         value={editingGuest.defaultPropertyId || ''}
                         onChange={e => {
                           const nextPropertyId = e.target.value;
                           const nextRooms = rooms.filter(r => String(r.propertyId) === String(nextPropertyId));
                           const nextRoomId = nextRooms.find(r => String(r.id) === String(editingGuest.defaultRoomId))
                             ? editingGuest.defaultRoomId
                             : (nextRooms[0]?.id || '');
                           setEditingGuest({
                             ...editingGuest,
                             defaultPropertyId: nextPropertyId,
                             defaultRoomId: nextPropertyId ? (nextRoomId || '') : ''
                           });
                         }}
                       >
                         <option value="">Sin asignar</option>
                         {properties.map(p => (
                           <option key={p.id} value={p.id}>{p.name}</option>
                         ))}
                       </select>
                     </div>
                     <div className="space-y-1">
                       <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Habitación predeterminada</label>
                       <select
                         className="w-full bg-white border border-blue-200 rounded-xl p-3 font-bold text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                         value={editingGuest.defaultRoomId || ''}
                         disabled={!editingGuest.defaultPropertyId}
                         onChange={e => setEditingGuest({ ...editingGuest, defaultRoomId: e.target.value })}
                       >
                         <option value="">Sin asignar</option>
                         {roomsForDefaultProperty.map(r => (
                           <option key={r.id} value={r.id}>{r.name}</option>
                         ))}
                       </select>
                     </div>
                   </div>

                   <div className="flex items-center space-x-4 bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-100">
                      <div className="flex items-center justify-center w-6 h-6">
                       <input 
                         type="checkbox" 
                         id="empadronado"
                         className="w-5 h-5 text-blue-900 rounded focus:ring-offset-0 focus:ring-0 border-none cursor-pointer" 
                         checked={editingGuest.isRegistered} 
                         onChange={e => setEditingGuest({...editingGuest, isRegistered: e.target.checked})} 
                       />
                      </div>
                      <label htmlFor="empadronado" className="text-sm font-black text-white uppercase tracking-wider cursor-pointer">Huésped empadronado en el municipio</label>
                   </div>

                   {/* NOTAS */}
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
                 </div>
               )}

               {/* TAB: HISTORIAL DE RESERVAS */}
               {activeTab === 'historial' && (
                 <div className="space-y-4">
                   {guestReservations.length > 0 ? (
                     <div className="space-y-3">
                       {guestReservations.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).map(res => {
                        const prop = properties.find(p => String(p.id) === String(res.propertyId));
                        const room = rooms.find(r => String(r.id) === String(res.roomId));
                        const isPaid = res.paymentMethod === 'cash' || res.paymentMethod === 'transfer';
                        return (
                         <div key={res.id} className="p-4 bg-gradient-to-r from-blue-50 to-transparent border-l-4 border-blue-500 rounded-lg cursor-pointer hover:shadow-md hover:from-blue-100 transition-all" onClick={() => { setEditingReservation(res); setResModalOpen(true); }}>
                           <div className="flex justify-between items-start">
                             <div>
                               <p className="font-bold text-gray-800">{prop?.name || 'Propiedad desconocida'}</p>
                               <p className="text-[10px] text-gray-500 mt-1">Habitación: {room?.name || 'N/A'}</p>
                               <p className="text-xs text-gray-600 mt-2">
                                 📅 {new Date(res.startDate).toLocaleDateString()} - {new Date(res.endDate).toLocaleDateString()}
                               </p>
                               <p className="text-xs font-bold text-gray-700 mt-1">
                                 💰 {res.price ?? 0}€
                                 {isPaid && ' ✅ Pagado'}
                                 {!isPaid && ' ⏳ Pendiente'}
                               </p>
                             </div>
                             <span className={`text-[10px] font-black px-2 py-1 rounded ${
                               isPaid 
                                 ? 'bg-green-100 text-green-700' 
                                 : 'bg-yellow-100 text-yellow-700'
                             }`}>
                               {isPaid ? 'PAGADA' : 'PENDIENTE'}
                             </span>
                           </div>
                         </div>
                        );
                       })}
                     </div>
                   ) : (
                     <div className="text-center py-12">
                       <p className="text-gray-400 text-sm">No hay reservas para este huésped.</p>
                     </div>
                   )}
                 </div>
               )}

               {/* TAB: DOCUMENTOS */}
               {activeTab === 'documentos' && (
                 <div className="space-y-6">
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
                         { field: 'dniFile' as const, label: 'DNI / NIE', color: 'green', bgClass: 'bg-green-50', borderClass: 'border-green-100', textClass: 'text-green-600', btnBorderClass: 'border-green-200', btnTextClass: 'text-green-600' },
                         { field: 'contractFile' as const, label: 'Contrato', color: 'blue', bgClass: 'bg-blue-50', borderClass: 'border-blue-100', textClass: 'text-blue-600', btnBorderClass: 'border-blue-200', btnTextClass: 'text-blue-600' },
                         { field: 'depositReceiptFile' as const, label: 'Recibo Fianza', color: 'orange', bgClass: 'bg-orange-50', borderClass: 'border-orange-100', textClass: 'text-orange-600', btnBorderClass: 'border-orange-200', btnTextClass: 'text-orange-600' }
                       ].map((doc) => (
                         <div key={doc.field} className={`p-4 rounded-2xl border-2 transition-all ${editingGuest[doc.field] ? `${doc.bgClass} ${doc.borderClass}` : 'bg-gray-50 border-gray-100'}`}>
                           <p className={`text-[10px] font-black uppercase mb-3 ${editingGuest[doc.field] ? doc.textClass : 'text-gray-400'}`}>{doc.label}</p>
                           
                           {editingGuest[doc.field] ? (
                             <div className="space-y-2">
                               <div className="flex items-center text-xs font-bold text-gray-700">
                                  <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                                  Listo
                               </div>
                               <button 
                                 type="button" 
                                 onClick={() => smartDownload(editingGuest[doc.field]!, `${doc.label}_${editingGuest.id}`)} 
                                 className={`w-full py-2 bg-white border ${doc.btnBorderClass} ${doc.btnTextClass} text-[10px] font-black rounded-lg hover:shadow-md transition-all uppercase`}
                               >
                                 Ver / Descargar
                               </button>
                               <button
                                 type="button"
                                 onClick={() => handleDeleteDocument(doc.field)}
                                 className="w-full py-2 bg-white border border-red-200 text-red-600 text-[10px] font-black rounded-lg hover:shadow-md transition-all uppercase"
                               >
                                 Borrar
                               </button>
                               <label className="block w-full py-2 text-center text-[9px] font-bold text-gray-400 cursor-pointer hover:underline uppercase">
                                 Reemplazar
                                 <input
                                   type="file"
                                   className="hidden"
                                   onChange={(e) => {
                                     const file = e.target.files?.[0];
                                     if (file) uploadGuestDocument(doc.field, file);
                                     e.currentTarget.value = '';
                                   }}
                                 />
                               </label>
                               {docUploading[doc.field] && (
                                 <p className="text-[10px] font-bold text-blue-600">Subiendo...</p>
                               )}
                               {docError[doc.field] && (
                                 <p className="text-[10px] font-bold text-red-600">{docError[doc.field]}</p>
                               )}
                             </div>
                           ) : (
                             <label className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-white hover:border-blue-400 transition-all group">
                               <svg className="w-6 h-6 text-gray-300 group-hover:text-blue-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                               <span className="text-[10px] font-black text-gray-400 uppercase">Subir</span>
                               <input
                                 type="file"
                                 className="hidden"
                                 onChange={(e) => {
                                   const file = e.target.files?.[0];
                                   if (file) uploadGuestDocument(doc.field, file);
                                   e.currentTarget.value = '';
                                 }}
                               />
                               {docUploading[doc.field] && (
                                 <p className="text-[10px] font-bold text-blue-600 mt-2">Subiendo...</p>
                               )}
                               {docError[doc.field] && (
                                 <p className="text-[10px] font-bold text-red-600 mt-2">{docError[doc.field]}</p>
                               )}
                             </label>
                           )}
                         </div>
                       ))}
                     </div>
                   </div>
                 </div>
               )}

               {/* BOTONES DE ACCIÓN */}
               <div className="pt-6 flex justify-end space-x-4 border-t border-gray-100">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-xs tracking-widest">Cancelar</button>
                 <button type="submit" disabled={loading} className="px-12 py-3 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:bg-gray-400 transform hover:-translate-y-0.5 transition-all uppercase text-xs tracking-widest">
                   {loading ? 'Guardando...' : 'Actualizar Ficha'}
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}

      {resModalOpen && editingReservation && (
        <ReservationModal
          rooms={rooms.filter(r => String(r.propertyId) === String(editingReservation.propertyId))}
          propertyId={String(editingReservation.propertyId)}
          initialReservation={editingReservation}
          initialData={null}
          onClose={() => { setResModalOpen(false); setEditingReservation(null); }}
          onSave={async (res) => {
            await db.saveReservation(res);
            const allRes = await db.getReservations();
            setGuestReservations(allRes.filter(r => String(r.guestId) === String(editingGuest?.id)));
            setResModalOpen(false);
            setEditingReservation(null);
          }}
          onDelete={async (id) => {
            await db.deleteReservation(id);
            setGuestReservations(prev => prev.filter(r => String(r.id) !== String(id)));
            setResModalOpen(false);
            setEditingReservation(null);
          }}
          onReservationUpdated={(updatedRes) => {
            setGuestReservations(prev => prev.map(r => String(r.id) === String(updatedRes.id) ? { ...r, ...updatedRes } : r));
            setEditingReservation(updatedRes);
          }}
        />
      )}
    </div>
  );
};
