import React, { useState } from 'react';
import { Field, ImageInput } from './AdminUI.jsx';

export const emptyUser = {
  email: '',
  password: '',
  full_name: '',
  role: 'editor',
  photo: '',
  phone: '',
  job_title: '',
  bio: '',
  unique_code: ''
};

const ROLE_STYLES = {
  super_admin: 'bg-brand-900 text-white',
  admin: 'bg-brand-100 text-brand-700',
  cashier: 'bg-amber-100 text-amber-800',
  editor: 'bg-accent-100 text-accent-800',
  viewer: 'bg-ink-100 text-ink-600'
};

export const ROLE_LABELS = { super_admin: 'Super admin', admin: 'Administrateur', cashier: 'Caissier', editor: 'Éditeur', viewer: 'Consultation' };

export { ROLE_STYLES };

export function memberPublicUrl(code) {
  if (!code) return '';
  return `${window.location.origin}/membre/${encodeURIComponent(code)}`;
}

export function UserProfileFields({ value, onChange, showRole = false, passwordRequired = false, actorIsSuper = false, roles = null }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="space-y-5">
      <ImageInput
        label="Photo de profil"
        round
        value={value.photo || ''}
        onChange={(photo) => onChange({ ...value, photo })}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nom complet">
          <input className="input" value={value.full_name || ''} onChange={set('full_name')} placeholder="Prénom Nom" />
        </Field>
        <Field label="Fonction">
          <input className="input" value={value.job_title || ''} onChange={set('job_title')} placeholder="Ex. Coordinatrice plaidoyer" />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email">
          <input className="input" type="email" value={value.email || ''} onChange={set('email')} placeholder="prenom@adiong.org" />
        </Field>
        <Field label="Téléphone">
          <input className="input" value={value.phone || ''} onChange={set('phone')} placeholder="+243 …" />
        </Field>
      </div>
      <Field label="Présentation">
        <textarea className="input min-h-[80px]" value={value.bio || ''} onChange={set('bio')} placeholder="Optionnel" />
      </Field>
      <Field
        label={value.id ? 'Nouveau mot de passe' : 'Mot de passe *'}
        hint={value.id ? 'Laisser vide pour conserver' : '8 caractères minimum'}
      >
        <input
          className="input"
          type="password"
          value={value.password || ''}
          onChange={set('password')}
          placeholder="••••••••"
          required={passwordRequired}
          autoComplete="new-password"
        />
      </Field>
      {showRole && (
        <Field label="Rôle">
          <select className="input" value={value.role || 'editor'} onChange={set('role')}>
            {(roles || Object.entries(ROLE_LABELS).filter(([role]) => actorIsSuper || role !== 'super_admin').map(([key, label]) => ({ key, label }))).map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}

export function MemberQrCard({ user, canRegenerate = false, onRegenerate }) {
  const [copied, setCopied] = useState('');
  const code = user?.unique_code || '';
  const url = memberPublicUrl(code);

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopied('');
    }
  };

  if (!code) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50 p-4 text-xs text-ink-400">
        Code et QR attribués à l’enregistrement.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-cream/60 p-4 ring-1 ring-ink-100">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Code membre</p>
      <p className="mt-0.5 font-display text-xl font-extrabold tracking-wide text-brand-700">{code}</p>
      <div className="mt-3 overflow-hidden rounded-xl bg-white p-2 ring-1 ring-ink-100">
        <img src={`/api/public/member/${encodeURIComponent(code)}/qr`} alt={`QR ${code}`} className="mx-auto h-36 w-36" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" className="btn-ghost !px-2.5 !py-1.5 text-[11px]" onClick={() => copy(code, 'code')}>
          {copied === 'code' ? 'Copié' : 'Code'}
        </button>
        <button type="button" className="btn-ghost !px-2.5 !py-1.5 text-[11px]" onClick={() => copy(url, 'url')}>
          {copied === 'url' ? 'Copié' : 'Lien'}
        </button>
        <a className="btn-ghost !px-2.5 !py-1.5 text-[11px]" href={`/api/public/member/${encodeURIComponent(code)}/qr`} download={`qr-${code}.png`}>
          QR
        </a>
        <a className="btn-ghost !px-2.5 !py-1.5 text-[11px]" href={url} target="_blank" rel="noreferrer">Fiche</a>
        <a className="btn-ghost !px-2.5 !py-1.5 text-[11px]" href={`${url}/carte`} target="_blank" rel="noreferrer">Carte</a>
        {canRegenerate && onRegenerate && (
          <button type="button" className="btn-ghost !px-2.5 !py-1.5 text-[11px] text-red-600" onClick={onRegenerate}>
            Régénérer
          </button>
        )}
      </div>
    </div>
  );
}
