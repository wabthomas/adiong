import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconClose } from '../../components/Icons.jsx';
import { api } from '../../api.js';
import MediaLibrary from '../../components/MediaLibrary.jsx';

export function PageTitle({ title, subtitle, action }) {
  if (!subtitle && !action) {
    return (
      <div className="grid min-h-[30vh] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
          <p className="text-sm font-semibold text-ink-400">{title ? `Chargement — ${title}` : 'Chargement…'}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      {subtitle ? <p className="text-[15px] text-ink-500">{subtitle}</p> : <span />}
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`mx-auto my-6 w-full rounded-3xl bg-white shadow-lift ${wide ? 'max-w-3xl' : 'max-w-xl'}`}
          >
            <div className="flex items-center justify-between border-b border-ink-100 px-7 py-5">
              <h2 className="font-display text-lg font-bold text-ink-900">{title}</h2>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-ink-50 text-ink-500 hover:bg-ink-100">
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            <div className="px-7 py-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, children, hint }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

export function ImageInput({ value, onChange, label = 'Image', round = false }) {
  const [uploading, setUploading] = React.useState(false);
  const [libOpen, setLibOpen] = React.useState(false);
  const previewCls = round
    ? 'h-24 w-24 shrink-0 rounded-full object-cover ring-2 ring-brand-100'
    : 'h-20 w-28 shrink-0 rounded-xl object-cover ring-1 ring-ink-100';
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="flex items-start gap-4">
        {value ? (
          <img src={value} alt="" className={previewCls} />
        ) : (
          <div className={`grid shrink-0 place-items-center bg-ink-50 text-xs font-semibold text-ink-300 ${round ? 'h-24 w-24 rounded-full' : 'h-20 w-28 rounded-xl'}`}>
            Photo
          </div>
        )}
        <div className="flex-1 space-y-2">
          <input
            className="input text-sm"
            placeholder="URL de l'image (ou choisissez)"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <label className="btn-ghost !px-4 !py-2 text-sm cursor-pointer">
              {uploading ? 'Optimisation…' : '📤 Téléverser'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const media = await api.media.upload(file);
                    onChange(media.url);
                  } catch (err) {
                    alert(err.message);
                  } finally {
                    setUploading(false);
                    e.target.value = '';
                  }
                }}
              />
            </label>
            <button type="button" className="btn-ghost !px-4 !py-2 text-sm" onClick={() => setLibOpen(true)}>
              🗂 Bibliothèque
            </button>
          </div>
        </div>
      </div>
      <MediaLibrary open={libOpen} onClose={() => setLibOpen(false)} accept="image" onPick={(url) => { onChange(url); setLibOpen(false); }} />
    </div>
  );
}

export function Toggle({ value, onChange, label = 'Publié' }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="inline-flex items-center gap-2.5"
    >
      <span className={`relative h-6 w-11 rounded-full transition-colors ${value ? 'bg-brand-500' : 'bg-ink-200'}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
      <span className="text-sm font-semibold text-ink-600">{label}</span>
    </button>
  );
}

export function DeleteButton({ onConfirm, disabled = false }) {
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      disabled={disabled}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
        armed ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'
      }`}
    >
      {armed ? 'Confirmer ?' : 'Supprimer'}
    </button>
  );
}
