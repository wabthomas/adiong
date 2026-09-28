import React, { useEffect, useState } from 'react';
import { api, setSavedUser } from '../../api.js';
import { PageTitle } from './AdminUI.jsx';
import { UserProfileFields, MemberQrCard, ROLE_LABELS, ROLE_STYLES } from './UserProfileFields.jsx';
import TotpSetup from './TotpSetup.jsx';

function ProfilePreview({ user, onEdit }) {
  const role = user.role || 'editor';
  const roleLabel = user.role_label || ROLE_LABELS[role] || role;
  const roleCls = ROLE_STYLES[role] || ROLE_STYLES.viewer;
  const rows = [
    { label: 'Email', value: user.email },
    { label: 'Téléphone', value: user.phone },
    { label: 'Fonction', value: user.job_title },
    { label: 'Code membre', value: user.unique_code }
  ].filter((r) => r.value);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 bg-ink-50/40 px-6 py-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-600 font-display text-2xl font-bold text-white ring-4 ring-white shadow-soft">
            {user.photo ? (
              <img src={user.photo} alt="" className="h-full w-full object-cover" />
            ) : (
              (user.full_name || user.email || 'A').slice(0, 2).toUpperCase()
            )}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-extrabold text-ink-900 sm:text-2xl">
              {user.full_name || 'Sans nom'}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${roleCls}`}>{roleLabel}</span>
              {user.job_title && (
                <span className="text-sm font-semibold text-ink-500">{user.job_title}</span>
              )}
            </div>
          </div>
        </div>
        <button type="button" onClick={onEdit} className="btn-primary !px-5 !py-2.5 text-sm shrink-0">
          Modifier
        </button>
      </div>

      <div className="space-y-5 px-6 py-6 sm:px-8">
        <dl className="grid gap-4 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="rounded-xl bg-ink-50/70 px-4 py-3">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{r.label}</dt>
              <dd className="mt-0.5 break-all text-sm font-semibold text-ink-800">{r.value}</dd>
            </div>
          ))}
        </dl>
        {user.bio ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Présentation</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{user.bio}</p>
          </div>
        ) : (
          <p className="text-sm text-ink-400">Aucune présentation renseignée.</p>
        )}
      </div>
    </div>
  );
}

export default function ProfileAdmin() {
  const [form, setForm] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState(false);
  const [twoFa, setTwoFa] = useState(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [regenCodes, setRegenCodes] = useState(null);
  const [disabling, setDisabling] = useState(false);

  const loadTwoFa = () => api.totp.status().then(setTwoFa).catch(() => {});

  useEffect(() => {
    api.me.get()
      .then((u) => {
        const next = { ...u, password: '' };
        setForm(next);
        setSnapshot(next);
        setSavedUser(u);
      })
      .catch((e) => setError(e.message));
    loadTwoFa();
  }, []);

  const toggleTwoFa = async () => {
    if (twoFa?.totp_enrolled) {
      if (!window.confirm('Désactiver l’authentification à deux facteurs sur ce compte ?')) return;
      setDisabling(true);
      try {
        await api.totp.disable();
        loadTwoFa();
      } catch (e) {
        setError(e.message);
      } finally {
        setDisabling(false);
      }
    } else {
      setSetupOpen(true);
    }
  };

  const regenerateCodes = async () => {
    try {
      const r = await api.totp.regenerateCodes();
      setRegenCodes(r.backup_codes);
      loadTwoFa();
    } catch (e) {
      setError(e.message);
    }
  };

  const startEdit = () => {
    setError('');
    setOk('');
    setForm({ ...snapshot, password: '' });
    setEditing(true);
  };

  const cancelEdit = () => {
    setError('');
    setOk('');
    setForm({ ...snapshot, password: '' });
    setEditing(false);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setOk('');
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        photo: form.photo || '',
        phone: form.phone || '',
        job_title: form.job_title || '',
        bio: form.bio || ''
      };
      if (form.password) payload.password = form.password;
      const updated = await api.me.update(payload);
      const next = { ...updated, password: '' };
      setForm(next);
      setSnapshot(next);
      setSavedUser(updated);
      setOk('Profil enregistré.');
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div>
        <PageTitle title="Mon profil" />
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        {!error && <p className="mt-4 text-sm text-ink-400">Chargement…</p>}
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="Mon profil"
        subtitle="Photo, coordonnées, code unique et QR code — votre fiche membre ADI."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        {editing ? (
          <form onSubmit={save} className="card p-6 sm:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-ink-900">Modifier le profil</h2>
              <button type="button" onClick={cancelEdit} className="btn-ghost !px-4 !py-2 text-sm" disabled={saving}>
                Annuler
              </button>
            </div>
            <UserProfileFields value={form} onChange={setForm} />
            {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
            {ok && <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{ok}</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-5">
              <button type="button" onClick={cancelEdit} className="btn-ghost !px-5 !py-2.5 text-sm" disabled={saving}>
                Annuler
              </button>
              <button type="submit" className="btn-primary !px-6 !py-2.5 text-sm" disabled={saving || !form.email}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            {ok && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{ok}</p>}
            {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
            <ProfilePreview user={snapshot || form} onEdit={startEdit} />
          </div>
        )}
        <MemberQrCard user={snapshot || form} />
      </div>

      <div className="card mt-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-bold text-ink-900">Authentification à deux facteurs</h3>
            <p className="mt-1 text-sm text-ink-500">
              {twoFa?.two_fa_required && 'Exigée par l’administrateur pour tous les comptes. '}
              {twoFa?.totp_enrolled
                ? `Compte protégé — ${twoFa.backup_remaining} code(s) de secours restant(s).`
                : 'Activez une application d’authentification pour une connexion plus sûre.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${twoFa?.totp_enrolled ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>
              {twoFa?.totp_enrolled ? 'Active' : 'Inactive'}
            </span>
            <button type="button" className="btn-ghost !px-4 !py-2 text-sm" onClick={toggleTwoFa} disabled={disabling}>
              {twoFa?.totp_enrolled ? 'Désactiver' : 'Activer'}
            </button>
          </div>
        </div>
        {twoFa?.totp_enrolled && (
          <button type="button" className="btn-ghost mt-4 !px-4 !py-2 text-sm" onClick={regenerateCodes}>
            Régénérer les codes de secours
          </button>
        )}
      </div>

      {setupOpen && (
        <TotpSetup
          onClose={() => { setSetupOpen(false); loadTwoFa(); }}
          onEnrolled={loadTwoFa}
        />
      )}

      {regenCodes && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/60 p-4 backdrop-blur-sm" onClick={() => setRegenCodes(null)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lift sm:p-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-ink-900">Nouveaux codes de secours</h3>
            <p className="mt-1 text-sm text-ink-500">Les anciens ne fonctionnent plus. Conservez ces 10 codes.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-ink-50 p-4 font-mono text-sm font-semibold text-ink-800">
              {regenCodes.map((c) => <span key={c}>{c}</span>)}
            </div>
            <button type="button" className="btn-primary mt-5 w-full !py-2.5" onClick={() => setRegenCodes(null)}>J’ai enregistré</button>
          </div>
        </div>
      )}
    </div>
  );
}
