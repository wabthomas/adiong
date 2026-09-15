import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, getToken, setToken, setSavedUser } from '../api.js';

const ROLE_BADGE = {
  editor: 'bg-accent-400 text-ink-950',
  viewer: 'bg-ink-500 text-white',
  admin: 'bg-brand-500 text-white'
};

export default function RegisterPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();

  const [invite, setInvite] = useState(null);
  const [checking, setChecking] = useState(true);
  const [invalid, setInvalid] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setInvalid('Cette page n’est accessible que via un lien d’invitation envoyé par l’équipe ADI ONG.');
      return;
    }
    api.register
      .validate(token)
      .then((r) => {
        if (r.valid) {
          setInvite(r);
          if (r.email) setEmail(r.email);
        } else {
          setInvalid(r.error);
        }
      })
      .catch((e) => setInvalid(e.message))
      .finally(() => setChecking(false));
  }, [token]);

  if (getToken()) return <RedirectTo to="/admin" />;

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas');
    if (password.length < 8) return setError('Mot de passe : 8 caractères minimum');
    setLoading(true);
    setError('');
    try {
      const { token: t, user } = await api.register.submit({ token, full_name: fullName, email, password });
      setToken(t);
      setSavedUser(user);
      nav('/admin', { replace: true });
    } catch (err) {
      setError(err.message);
      setChecking(false);
      setInvite(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-6 py-12">
      <div className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-40 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="relative w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-lift">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3" fill="#f5a524" stroke="none" />
              <path d="M5 18.5c1.4-4 4-5.5 7-5.5s5.6 1.5 7 5.5" strokeLinecap="round" />
            </svg>
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold text-white">Créer votre compte</h1>
          <p className="mt-2 text-sm text-white/60">Espace d'administration ADI ONG — accès sur invitation</p>
        </div>

        <div className="rounded-3xl bg-white p-7 shadow-lift">
          {checking && (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
              <p className="text-sm font-semibold text-ink-400">Vérification du lien…</p>
            </div>
          )}

          {!checking && invalid && (
            <div className="text-center">
              <p className="text-4xl">🔗</p>
              <p className="mt-4 text-sm font-semibold leading-relaxed text-ink-700">{invalid}</p>
              <a href="/" className="mt-6 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700">
                Retour au site
              </a>
            </div>
          )}

          {!checking && !invalid && invite && (
            <form onSubmit={submit} className="space-y-5">
              <div className="rounded-2xl bg-cream p-4 text-center">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Vous êtes invité au rôle</p>
                <span className={`mt-2 inline-block rounded-full px-4 py-1.5 text-sm font-bold ${ROLE_BADGE[invite.role] || 'bg-brand-100 text-brand-700'}`}>
                  {invite.role_label}
                </span>
                {invite.label && <p className="mt-3 text-sm text-ink-600">« {invite.label} »</p>}
                <p className="mt-2 text-[11px] text-ink-400">Lien valide jusqu'au {new Date(invite.expires_at + 'T12:00:00').toLocaleDateString('fr-FR')}</p>
              </div>

              <div>
                <label className="label">Nom complet</label>
                <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Prénom Nom" required />
              </div>
              <div>
                <label className="label">Email {invite.email && '(imposé par l’invitation)'}</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  disabled={!!invite.email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom@adiong.org"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Mot de passe</label>
                  <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 caractères minimum" required />
                </div>
                <div>
                  <label className="label">Confirmation</label>
                  <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required />
                </div>
              </div>

              {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

              <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
                {loading ? 'Création du compte…' : 'Créer mon compte'}
              </button>
              <p className="text-center text-[11px] leading-relaxed text-ink-400">
                En créant ce compte, vous acceptez de n'utiliser l'espace d'administration que pour les
                missions qui vous sont confiées.
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function RedirectTo({ to }) {
  const nav = useNavigate();
  useEffect(() => { nav(to, { replace: true }); }, [nav, to]);
  return null;
}
