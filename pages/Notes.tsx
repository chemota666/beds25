import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { db } from '../services/db';
import { Note } from '../types';

const ToolbarButton: React.FC<{ active?: boolean; onClick: () => void; title: string; children: React.ReactNode }> = ({ active, onClick, title, children }) => (
  <button
    type="button"
    onMouseDown={e => { e.preventDefault(); onClick(); }}
    title={title}
    className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors ${active ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
  >
    {children}
  </button>
);

const TEXT_COLORS = [
  { label: 'Negro', value: '#000000' },
  { label: 'Rojo', value: '#ef4444' },
  { label: 'Naranja', value: '#f97316' },
  { label: 'Verde', value: '#22c55e' },
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Morado', value: '#a855f7' },
  { label: 'Gris', value: '#6b7280' },
];

const HIGHLIGHT_COLORS = [
  { label: 'Amarillo', value: '#fef08a' },
  { label: 'Verde', value: '#bbf7d0' },
  { label: 'Azul', value: '#bfdbfe' },
  { label: 'Rosa', value: '#fbcfe8' },
  { label: 'Naranja', value: '#fed7aa' },
];

const ColorPicker: React.FC<{ colors: { label: string; value: string }[]; activeColor?: string; onSelect: (color: string) => void; onClear: () => void; title: string; icon: React.ReactNode }> = ({ colors, activeColor, onSelect, onClear, title, icon }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); setOpen(!open); }}
        title={title}
        className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors ${activeColor ? 'ring-2 ring-blue-300' : 'text-gray-500 hover:bg-gray-100'}`}
      >
        {icon}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50 flex gap-1">
          {colors.map(c => (
            <button
              key={c.value}
              type="button"
              onMouseDown={e => { e.preventDefault(); onSelect(c.value); setOpen(false); }}
              title={c.label}
              className="w-6 h-6 rounded-full border border-gray-200 hover:scale-110 transition-transform"
              style={{ backgroundColor: c.value }}
            />
          ))}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); onClear(); setOpen(false); }}
            title="Quitar"
            className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 text-xs hover:bg-gray-100"
          >
            x
          </button>
        </div>
      )}
    </div>
  );
};

const Toolbar: React.FC<{ editor: ReturnType<typeof useEditor> }> = ({ editor }) => {
  if (!editor) return null;
  const currentColor = editor.getAttributes('textStyle').color || '';
  const currentHighlight = editor.getAttributes('highlight').color || '';
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 rounded-t-lg flex-wrap">
      <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita">B</ToolbarButton>
      <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva"><i>I</i></ToolbarButton>
      <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado"><u>U</u></ToolbarButton>
      <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado"><s>S</s></ToolbarButton>
      <div className="w-px h-5 bg-gray-300 mx-1" />
      <ColorPicker
        colors={TEXT_COLORS}
        activeColor={currentColor}
        onSelect={(color) => editor.chain().focus().setColor(color).run()}
        onClear={() => editor.chain().focus().unsetColor().run()}
        title="Color de letra"
        icon={<span style={{ color: currentColor || '#000', borderBottom: `2px solid ${currentColor || '#000'}` }} className="text-sm font-bold leading-none">A</span>}
      />
      <ColorPicker
        colors={HIGHLIGHT_COLORS}
        activeColor={currentHighlight}
        onSelect={(color) => editor.chain().focus().toggleHighlight({ color }).run()}
        onClear={() => editor.chain().focus().unsetHighlight().run()}
        title="Subrayar / Resaltar"
        icon={<span style={{ backgroundColor: currentHighlight || '#fef08a', padding: '0 3px', borderRadius: '2px' }} className="text-xs font-bold leading-none">ab</span>}
      />
      <div className="w-px h-5 bg-gray-300 mx-1" />
      <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Titulo">H</ToolbarButton>
      <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
        <span className="text-xs">1.</span>
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Cita">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
      </ToolbarButton>
    </div>
  );
};

const NoteEditor: React.FC<{ content: string; onSave: (html: string) => void; onCancel: () => void; placeholder?: string }> = ({ content, onSave, onCancel, placeholder }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: placeholder || 'Escribe aqui...' }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] px-3 py-2',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          const html = editor?.getHTML() || '';
          if (html && html !== '<p></p>') onSave(html);
          return true;
        }
        return false;
      },
    },
  });

  const handleSave = useCallback(() => {
    const html = editor?.getHTML() || '';
    if (html && html !== '<p></p>') onSave(html);
  }, [editor, onSave]);

  return (
    <div>
      <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:border-blue-400">
        <Toolbar editor={editor} />
        <EditorContent editor={editor} />
      </div>
      <div className="flex justify-between items-center mt-3">
        <span className="text-xs text-gray-400">Ctrl+Enter para guardar</span>
        <div className="flex space-x-2">
          <button onClick={onCancel} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg text-sm">Cancelar</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 text-sm">Guardar</button>
        </div>
      </div>
    </div>
  );
};

export const Notes: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const currentUser = (() => {
    try {
      const u = localStorage.getItem('roomflow_auth_user');
      if (u) { const p = JSON.parse(u); return p.username || 'Sistema'; }
    } catch {}
    return 'Sistema';
  })();

  const loadNotes = async () => {
    try {
      const data = await db.getNotes();
      setNotes(data.sort((a, b) => new Date(b.updatedAt || b.createdAt || '').getTime() - new Date(a.updatedAt || a.createdAt || '').getTime()));
    } catch (err) {
      console.error('Error loading notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadNotes(); }, []);

  const handleCreate = async (html: string) => {
    try {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await db.saveNote({ id: 'temp_' + Date.now(), content: html, author: currentUser, createdAt: now, updatedAt: now });
      setShowNew(false);
      await loadNotes();
    } catch (err: any) {
      alert(err?.message || 'Error al crear nota');
    }
  };

  const handleUpdate = async (note: Note, html: string) => {
    try {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await db.saveNote({ ...note, content: html, updatedAt: now });
      setEditingId(null);
      await loadNotes();
    } catch (err: any) {
      alert(err?.message || 'Error al actualizar nota');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta nota?')) return;
    try {
      await db.deleteNote(id);
      await loadNotes();
    } catch (err: any) {
      alert(err?.message || 'Error al eliminar nota');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror { min-height: 100px; }
        .ProseMirror:focus { outline: none; }
        .ProseMirror h2 { font-size: 1.25rem; font-weight: 700; margin: 0.5rem 0; }
        .ProseMirror ul { list-style: disc; padding-left: 1.5rem; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.5rem; }
        .ProseMirror blockquote { border-left: 3px solid #d1d5db; padding-left: 1rem; color: #6b7280; margin: 0.5rem 0; }
        .ProseMirror p { margin: 0.25rem 0; }
        .note-html h2 { font-size: 1.25rem; font-weight: 700; margin: 0.5rem 0; }
        .note-html ul { list-style: disc; padding-left: 1.5rem; }
        .note-html ol { list-style: decimal; padding-left: 1.5rem; }
        .note-html blockquote { border-left: 3px solid #d1d5db; padding-left: 1rem; color: #6b7280; margin: 0.5rem 0; }
        .note-html p { margin: 0.25rem 0; }
      `}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">NOTAS</h1>
          <p className="text-gray-400 text-sm">Notas compartidas del equipo</p>
        </div>
        <button
          onClick={() => { setShowNew(true); setEditingId(null); }}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:bg-blue-700 transition-colors"
        >
          + Nueva nota
        </button>
      </div>

      {showNew && (
        <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-5">
          <NoteEditor
            content=""
            placeholder="Escribe tu nota aqui..."
            onSave={handleCreate}
            onCancel={() => setShowNew(false)}
          />
        </div>
      )}

      {notes.length === 0 && !showNew && (
        <div className="text-center py-16">
          <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
          <p className="text-gray-400">No hay notas. Crea la primera.</p>
        </div>
      )}

      <div className="space-y-3">
        {notes.map(note => (
          <div key={note.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
            {editingId === String(note.id) ? (
              <NoteEditor
                content={note.content || ''}
                onSave={(html) => handleUpdate(note, html)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <div
                  className="cursor-pointer note-html text-sm text-gray-800 leading-relaxed"
                  onClick={() => setEditingId(String(note.id))}
                  dangerouslySetInnerHTML={{ __html: note.content || '' }}
                />
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <span className="text-xs font-bold uppercase">{(note.author || '?')[0]}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-500">{note.author || 'Sistema'}</span>
                    <span className="text-xs text-gray-400">{formatDate(note.updatedAt || note.createdAt)}</span>
                  </div>
                  <button onClick={() => handleDelete(String(note.id))} className="text-red-400 hover:text-red-600 text-xs font-bold">Eliminar</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
