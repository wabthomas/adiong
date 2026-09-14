import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api.js';
import { IconClose } from './Icons.jsx';

function LibraryPanel({ onPick, onClose, embedded = false }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  const [altEdit, setAltEdit] = useState(null);
  const [altDraft, setAltDraft] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(() => {
    api.media.list(q).then(setItems).catch((e) => setError(e.message));
  }, [q]);

  useEffect(() => { load(); }, [load]);

  const doUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const media = await api.media.upload(file);
      setItems((prev) => [media, ...prev]);
      if (onPick) onPick(media.url);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(new URL(url, window.location.origin).href);
      setCopied(url);
      setTimeout(() => setCopied(''), 1500);
    } catch {  }
  };

  const remove = async (m) => {
    if (!confirm(`Supprimer « ${m.filename} » de la bibliothèque ?`)) return;
    try {
      await api.media.remove(m.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const saveAlt = async (m) => {
    try {
      const updated = await api.media.update(m.id, { alt: altDraft.trim() });
      setItems((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
      setAltEdit(null);
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className={embedded ? 'rounded-3xl bg-white shadow-soft ring-1 ring-ink-950/5' : 'rounded-3xl bg-white shadow-lift'}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-7 py-5">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-900">Bibliothèque d'images</h2>
          <p className="text-xs text-ink-400">Optimisation automatique : redimensionnement 1600px + compression + miniature</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input !w-48 !py-2 text-sm"
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button onClick={() => fileRef.current?.click()} className="btn-primary !px-4 !py-2 text-sm">
            {uploading ? 'Upload…' : '⬆ Upload'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              [...e.target.files].forEach(doUpload);
              e.target.value = '';
            }}
          />
          {!embedded && (
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-ink-50 text-ink-500 hover:bg-ink-100">
              <IconClose className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className={embedded ? 'max-h-[calc(100vh-280px)] overflow-y-auto p-7' : 'max-h-[65vh] overflow-y-auto p-7'}>
        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        {uploading && (
          <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
            Optimisation de l'image en cours…
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => (
            <div key={m.id} className="group relative overflow-hidden rounded-2xl ring-1 ring-ink-100">
              <button
                className="block w-full"
                onClick={() => onPick && onPick(m.url, m.alt || '')}
                title={m.alt || m.filename}
              >
                <img src={m.thumb || m.url} alt={m.alt || m.filename} className="h-36 w-full object-cover" loading="lazy" />
              </button>
              <div className="flex items-center justify-between gap-1 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-ink-800">{m.filename}</p>
                  <p className="text-[10px] text-ink-400">
                    {m.width}×{m.height} · {(m.size / 1024).toFixed(0)} Ko
                  </p>
                </div>
                <div className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    onClick={() => { setAltEdit(altEdit === m.id ? null : m.id); setAltDraft(m.alt || ''); }}
                    className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                      m.alt ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                    }`}
                    title="Texte alternatif (accessibilité & SEO)"
                  >
                    Aa
                  </button>
                  <button
                    onClick={() => copyUrl(m.url)}
                    className="rounded-lg bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-700 hover:bg-brand-100"
                    title="Copier l'URL"
                  >
                    {copied === m.url ? '✓' : 'URL'}
                  </button>
                  <button
                    onClick={() => remove(m)}
                    className="rounded-lg bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100"
                    title="Supprimer"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {altEdit === m.id && (
                <div className="border-t border-ink-100 bg-cream/60 px-3 py-2">
                  <input
                    autoFocus
                    className="input !px-2.5 !py-1.5 text-xs"
                    placeholder="Texte alternatif : « Femme en fauteuil roulant devant le siège d'ADI ONG »"
                    value={altDraft}
                    maxLength={300}
                    onChange={(e) => setAltDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveAlt(m);
                      if (e.key === 'Escape') setAltEdit(null);
                    }}
                  />
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-ink-400">Visible par les lecteurs d'écran & Google</span>
                    <button onClick={() => saveAlt(m)} className="rounded-lg bg-brand-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-brand-700">
                      Enregistrer
                    </button>
                  </div>
                </div>
              )}
              {onPick && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center bg-brand-900/0 opacity-0 transition-all group-hover:bg-brand-900/30 group-hover:opacity-100">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700 shadow">Choisir</span>
                </div>
              )}
            </div>
          ))}
        </div>
        {items.length === 0 && !uploading && (
          <p className="py-14 text-center text-ink-400">Bibliothèque vide — téléversez votre première image.</p>
        )}
      </div>
    </div>
  );
}


export default function MediaLibrary({ open, onClose, onPick, embedded = false }) {
  if (embedded) return <LibraryPanel onPick={onPick} onClose={onClose} embedded />;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mx-auto my-6 w-full max-w-4xl"
          >
            <LibraryPanel onPick={onPick} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
