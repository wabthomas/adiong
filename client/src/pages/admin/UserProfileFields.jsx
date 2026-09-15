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

export const ROLE_DESCRIPTIONS = {
  super_admin: "Tout, y compris l'activation des modules (GRH) et la gestion des super admins",
  admin: 'Accès complet : contenu, paramètres, utilisateurs, GRH (si activée)',
  cashier: 'Point de vente : encaisser, suivre les ventes et les commandes en ligne (pas de gestion du catalogue ni des rapports)',
  editor: 'Gère les articles, causes, campagnes et la médiathèque',
  viewer: 'Consultation seule (tableau de bord)'
};

export { ROLE_STYLES };

export function memberPublicUrl(code) {
  if (!code) return '';
  return `${window.location.origin}/membre/${encodeURIComponent(code)}`;
}

export function UserProfileFields({ value, onChange, showRole = false, passwordRequired = false }) {
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
      <Field label="Présentation" hint="Quelques lignes affichées sur la fiche membre">
        <textarea className="input min-h-[110px]" value={value.bio || ''} onChange={set('bio')} placeholder="Rôle au sein de l'ONG, mission…" />
      </Field>
      <Field
        label={value.id ? 'Nouveau mot de passe (laisser vide pour conserver)' : 'Mot de passe *'}
        hint="8 caractères minimum"
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
          <div className="space-y-2">
            {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
              <button
                key={role}
                type="button"
                onClick={() => onChange({ ...value, role })}
                className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                  value.role === role
                    ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                    : 'border-ink-200 hover:border-brand-300'
                }`}
              >
                <span className={`mt-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${ROLE_STYLES[role]}`}>
                  {ROLE_LABELS[role]}
                </span>
                <span className="text-sm leading-snug text-ink-600">{desc}</span>
              </button>
            ))}
          </div>
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
      <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50 p-5 text-sm text-ink-500">
        Le code unique et le QR code seront attribués à l'enregistrement.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-cream/60 p-5">
      <p className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">Identifiant ADI</p>
      <p className="mt-1 font-display text-2xl font-extrabold tracking-wide text-brand-700">{code}</p>
      <div className="mt-4 overflow-hidden rounded-2xl bg-white p-3 ring-1 ring-ink-100">
        <img src={`/api/public/member/${encodeURIComponent(code)}/qr`} alt={`QR ${code}`} className="mx-auto h-44 w-44" />
      </div>
      <p className="mt-3 break-all text-xs text-ink-500">{url}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost !px-3 !py-2 text-xs" onClick={() => copy(code, 'code')}>
          {copied === 'code' ? 'Code copié' : 'Copier le code'}
        </button>
        <button type="button" className="btn-ghost !px-3 !py-2 text-xs" onClick={() => copy(url, 'url')}>
          {copied === 'url' ? 'Lien copié' : 'Copier le lien'}
        </button>
        <a
          className="btn-ghost !px-3 !py-2 text-xs"
          href={`/api/public/member/${encodeURIComponent(code)}/qr`}
          download={`qr-${code}.png`}
        >
          Télécharger le QR
        </a>
        <a className="btn-ghost !px-3 !py-2 text-xs" href={url} target="_blank" rel="noreferrer">
          Voir la fiche
        </a>
        <a className="btn-ghost !px-3 !py-2 text-xs" href={`${url}/carte`} target="_blank" rel="noreferrer">
          Carte imprimable
        </a>
        {canRegenerate && onRegenerate && (
          <button
            type="button"
            className="btn-ghost !px-3 !py-2 text-xs text-red-600"
            onClick={onRegenerate}
          >
            Régénérer le code
          </button>
        )}
      </div>
    </div>
  );
}
