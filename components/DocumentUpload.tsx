import React, { useState, useEffect, useRef } from 'react';

interface DocumentUploadProps {
  ownerId: string;
}

interface FileInfo {
  filename: string;
  originalName: string;
  uploadDate: string;
  size: number;
}

export default function DocumentUpload({ ownerId }: DocumentUploadProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadFiles = async () => {
    try {
      const response = await fetch(`/api/files/owner/${ownerId}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error('Error loading files:', err);
    }
  };

  useEffect(() => {
    if (ownerId) {
      loadFiles();
    }
  }, [ownerId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/upload/owner/${ownerId}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await loadFiles();
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        const data = await response.json();
        setError(data.error || 'Error al subir el archivo');
      }
    } catch (err) {
      setError('Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm('¿Seguro que quieres eliminar este archivo?')) return;

    try {
      const response = await fetch(`/api/files/owner/${ownerId}/${filename}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadFiles();
      }
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="mt-6 border-t pt-4">
      <h3 className="text-lg font-medium text-gray-700 mb-3">Documentos del Propietario</h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Subir Contrato u Otro Documento</label>
        <label
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file && fileInputRef.current) {
              const dt = new DataTransfer();
              dt.items.add(file);
              fileInputRef.current.files = dt.files;
              fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }}
        >
          <svg className={`w-6 h-6 mb-1 ${dragOver ? 'text-blue-500' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
          <span className="text-xs font-bold text-gray-400">{uploading ? 'Subiendo...' : 'Arrastra un archivo o haz click'}</span>
          <span className="text-[10px] text-gray-400 mt-1">PDF, DOC, JPG, PNG</span>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            className="hidden"
          />
        </label>
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-600">Archivos subidos:</h4>
          {files.map((file) => (
            <div key={file.filename} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <a
                    href={`/api/uploads/owners/${ownerId}/${file.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {file.originalName}
                  </a>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)} - {new Date(file.uploadDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(file.filename)}
                className="text-red-500 hover:text-red-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
