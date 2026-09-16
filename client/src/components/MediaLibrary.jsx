import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api.js';
import { IconClose } from './Icons.jsx';

function pickExtra(m) {
  const pdf = /pdf/i.test(m?.mime || '') || /\.pdf$/i.test(m?.url || '') || /\.pdf$/i.test(m?.filename || '');
  return pdf ? (m.filename || '') : (m.alt || '');
}

function LibraryPanel({ onPick, onClose, embedded = false, accept = 'all' }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState(accept === 'pdf' ? 'pdf' : 'image');
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  const [altEdit, setAltEdit] = useState(null);
  const [altDraft, setAltDraft] = useState('');
  const fileRef = useRef(null);
  const kind = accept === 'all' ? tab : accept;
  const isPdf = kind === 'pdf';

  const load = useCallback(() => {
    api.media.list(q, kind).then(setItems).catch((e) => setError(e.message));
  }, [q, kind]);

  useEffect(() => { load(); }, [load]);

  const doUpload = async (file) => {
    if (!file) return;
    const media = await api.media.upload(file);
    setItems((prev) => [media, ...prev]);
    if (onPick) onPick(media.url, pickExtra(media));
  };

  const uploadFiles = async (fileList) => {
    const files = [...fileList].filter(Boolean);
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      for (const file of files) {
        await doUpload(file);
      }
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
          <h2 className="font-display text-lg font-bold text-ink-900">
            {isPdf ? 'Documents PDF' : 'Bibliothèque d\'images'}
          </h2>
          <p className="text-xs text-ink-400">
            {isPdf
              ? 'Importez un PDF puis insérez son lien dans un article'
              : 'Optimisation automatique : redimensionnement 1600px + compression + miniature'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input !w-48 !py-2 text-sm"
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button onClick={() => fileRef.current?.click()} className="btn-primary !px-4 !py-2 text-sm">
            {uploading ? 'Upload…' : isPdf ? '⬆ Importer un PDF' : '⬆ Upload'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={isPdf ? 'application/pdf,.pdf' : 'image/*'}
            multiple
            className="hidden"
            onChange={(e) => {
              uploadFiles(e.target.files);
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

      {accept === 'all' && (
        <div className="flex gap-2 border-b border-ink-100 px-7 pt-3">
          {[
            ['image', 'Images'],
            ['pdf', 'PDF']
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-t-xl px-4 py-2 text-sm font-bold ${
                tab === id ? 'bg-brand-50 text-brand-700' : 'text-ink-400 hover:text-ink-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className={embedded ? 'max-h-[calc(100vh-280px)] overflow-y-auto p-7' : 'max-h-[65vh] overflow-y-auto p-7'}>
        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        {uploading && (
          <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
            {isPdf ? 'Envoi du PDF…' : 'Optimisation de l\'image en cours…'}
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => (
            <div key={m.id} className="group relative overflow-hidden rounded-2xl ring-1 ring-ink-100">
              <button
                className="block w-full"
                onClick={() => onPick && onPick(m.url, pickExtra(m))}
                title={m.alt || m.filename}
              >
                {isPdf ? (
                  <div className="grid h-36 place-items-center bg-brand-50">
                    <div className="px-3 text-center">
                      <span className="inline-flex rounded-lg bg-brand-600 px-2.5 py-1 font-display text-xs font-black tracking-wide text-white">PDF</span>
                      <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-ink-600">{m.filename}</p>
                    </div>
                  </div>
                ) : (
                  <img src={m.thumb || m.url} alt={m.alt || m.filename} className="h-36 w-full object-cover" loading="lazy" />
                )}
              </button>
              <div className="flex items-center justify-between gap-1 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-ink-800">{m.filename}</p>
                  <p className="text-[10px] text-ink-400">
                    {m.width && m.height ? `${m.width}×${m.height} · ` : ''}
                    {(m.size / 1024).toFixed(0)} Ko
                  </p>
                </div>
                <div className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  {!isPdf && (
                    <button
                      onClick={() => { setAltEdit(altEdit === m.id ? null : m.id); setAltDraft(m.alt || ''); }}
                      className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                        m.alt ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                      }`}
                      title="Texte alternatif (accessibilité & SEO)"
                    >
                      Aa
                    </button>
                  )}
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
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700 shadow">
                    {isPdf ? 'Insérer le lien' : 'Choisir'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
        {items.length === 0 && !uploading && (
          <p className="py-14 text-center text-ink-400">
            {isPdf ? 'Aucun PDF — importez votre premier document.' : 'Bibliothèque vide — téléversez votre première image.'}
          </p>
        )}
      </div>
    </div>
  );
}


export default function MediaLibrary({ open, onClose, onPick, embedded = false, accept = 'all' }) {
  if (embedded) return <LibraryPanel onPick={onPick} onClose={onClose} embedded accept={accept} />;
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
            <LibraryPanel onPick={onPick} onClose={onClose} accept={accept} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
