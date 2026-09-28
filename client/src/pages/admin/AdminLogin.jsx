import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, getToken, setToken, setSavedUser } from '../../api.js';
import TotpSetup from './TotpSetup.jsx';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('login');
  const [pending, setPending] = useState(null);
  const [code, setCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const nav = useNavigate();

  if (getToken()) return <Navigate to="/admin" replace />;

  const finish = (token, user) => {
    setToken(token);
    setSavedUser(user);
    nav('/admin', { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await api.login({ email, password });
      if (r.requires_2fa) {
        setPending(r);
        setPhase('2fa');
      } else {
        finish(r.token, r.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await api.verify2fa({ pending_token: pending.pending_token, code });
      finish(r.token, r.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async () => {
    setLoading(true);
    setError('');
    try {
      await api.send2faEmail(pending.pending_token);
      setEmailSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = () => {
    setPhase('login');
    setPending(null);
    setCode('');
    setEmailSent(false);
    setError('');
    setPassword('');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-6">
      <div className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-40 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="relative w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src="/uploads/seed/logo.png" alt="Logo ADI ONG" className="h-14 w-14 rounded-2xl bg-white object-contain p-1 shadow-lg" />
            <span className="font-display text-2xl font-bold text-white">
              ADI <span className="text-accent-400">ONG</span>
            </span>
          </Link>
          <p className="mt-4 text-sm font-semibold tracking-widest text-white/50 uppercase">Espace administrateur</p>
        </div>

        {phase === 'login' && (
          <form onSubmit={submit} className="rounded-3xl bg-white p-8 shadow-lift sm:p-10">
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@adiong.org"
              autoComplete="username"
            />
            <label className="label mt-5">Mot de passe</label>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              autoComplete="current-password"
            />
            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
            )}
            <button type="submit" disabled={loading} className="btn-primary mt-7 w-full disabled:opacity-60">
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
            <Link to="/" className="mt-5 block text-center text-sm font-semibold text-ink-400 hover:text-brand-600">
              ← Retour au site
            </Link>
          </form>
        )}

        {phase === '2fa' && pending && (
          <form onSubmit={verify} className="rounded-3xl bg-white p-8 shadow-lift sm:p-10">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-ink-900">Vérification en deux temps</h2>
                <p className="text-sm text-ink-500">Mot de passe correct — une dernière étape vous sépare de votre espace.</p>
              </div>
            </div>

            {pending.totp_enrolled ? (
              <>
                <label className="label">Code à 6 chiffres (application ou code de secours)</label>
                <input
                  className="input text-center font-mono text-xl tracking-[0.4em]"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))}
                  autoFocus
                />
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-ink-600">
                  La vérification en deux temps est exigée sur ce site. Armement de votre application requis pour continuer :
                </p>
                <button type="button" className="btn-primary w-full !py-3" onClick={() => setSetupOpen(true)}>
                  Configurer mon application
                </button>
                {pending.email_2fa_available && (
                  <button type="button" className="btn-ghost w-full !py-3" onClick={sendEmail} disabled={loading}>
                    {emailSent ? 'Code envoyé par email ✓' : 'Recevoir un code par email'}
                  </button>
                )}
                {emailSent && (
                  <div className="space-y-2">
                    <label className="label">Code reçu par email</label>
                    <input
                      className="input text-center font-mono text-xl tracking-[0.4em]"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="••••••"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
            )}
            <button type="submit" disabled={loading || !code} className="btn-primary mt-7 w-full disabled:opacity-60">
              {loading ? 'Vérification…' : 'Vérifier'}
            </button>
            <button type="button" onClick={backToLogin} className="mt-4 w-full text-center text-sm font-semibold text-ink-400 hover:text-brand-600">
              ← Changer de compte
            </button>
          </form>
        )}

        {setupOpen && pending && (
          <TotpSetup
            pendingToken={pending.pending_token}
            onClose={() => setSetupOpen(false)}
            onEnrolled={() => setPending({ ...pending, totp_enrolled: true })}
          />
        )}
      </motion.div>
    </div>
  );
}
