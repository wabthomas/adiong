import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, getToken, setToken, setSavedUser } from '../../api.js';
import { useSite } from '../../hooks/useSite.jsx';
import NotFound from '../NotFound.jsx';
import TotpSetup from './TotpSetup.jsx';

function Icon({ paths, className = 'h-5 w-5' }) {
  const list = Array.isArray(paths) ? paths : [paths];
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {list.map((d, i) => (
        <path key={i} d={d} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

const ICO = {
  mail: 'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75',
  lock: 'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z',
  eye: [
    'M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z',
    'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'
  ],
  eyeOff: 'M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88',
  key: 'M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z',
  login: 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9',
  back: 'M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18',
  shield: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z'
};

function PasswordField({ value, onChange, shown, onToggle, placeholder, autoComplete, autoFocus }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400">
        <Icon paths={ICO.lock} />
      </span>
      <input
        className="input pr-12 pl-11"
        type={shown ? 'text' : 'password'}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute top-1/2 right-2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-700"
        aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        title={shown ? 'Masquer' : 'Afficher'}
      >
        <Icon paths={shown ? ICO.eyeOff : ICO.eye} />
      </button>
    </div>
  );
}

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNext, setShowNext] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const { gate, reset: resetToken = '' } = useParams();
  const [gateEmail, setGateEmail] = useState('');
  const [gateState, setGateState] = useState(resetToken ? 'ok' : 'checking');
  const [phase, setPhase] = useState(resetToken ? 'reset' : 'login');
  const [pending, setPending] = useState(null);
  const [code, setCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const nav = useNavigate();
  const { site } = useSite();
  const mark = site?.favicon || '/uploads/seed/favicon.png';

  useEffect(() => {
    if (resetToken || !gate) return undefined;
    let cancel = false;
    api.authGate(gate)
      .then((r) => {
        if (cancel) return;
        setEmail(r.email || '');
        setGateEmail(r.email || '');
        setGateState('ok');
      })
      .catch(() => { if (!cancel) setGateState('denied'); });
    return () => { cancel = true; };
  }, [gate, resetToken]);

  if (!resetToken && !gate) return <NotFound />;
  if (gateState === 'denied') return <NotFound />;
  if (gateState === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    );
  }

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
    setInfo('');
    try {
      const r = await api.login({ email, password, gate });
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

  const requestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const r = await api.forgotPassword(email);
      setInfo(r.message || 'Si un compte existe pour cette adresse, un lien de réinitialisation a été envoyé.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (nextPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword({ token: resetToken, password: nextPassword });
      setNextPassword('');
      setConfirmPassword('');
      setPassword('');
      setInfo('Mot de passe mis à jour. Utilisez votre lien de connexion personnel pour vous connecter.');
      setPhase('reset-done');
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
    setInfo('');
    setPassword('');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-6 py-6">
      <div className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-40 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="relative w-full max-w-md"
      >
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src={mark} alt="ADI" className="h-14 w-14 rounded-2xl bg-white object-contain p-1 shadow-lg" />
            <span className="font-display text-2xl font-bold text-white">ADI</span>
          </Link>
          <p className="mt-4 text-sm font-semibold tracking-widest text-white/50 uppercase">Se connecter</p>
        </div>

        {phase === 'login' && (
          <form onSubmit={submit} className="rounded-3xl bg-white p-8 shadow-lift sm:p-10">
            <label className="label" htmlFor="login-email">Email</label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400">
                <Icon paths={ICO.mail} />
              </span>
              <input
                id="login-email"
                className="input pl-11"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="moncompte@adiong.org"
                autoComplete="username"
                readOnly={!!gateEmail}
              />
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <label className="label !mb-0" htmlFor="login-password">Mot de passe</label>
              <button
                type="button"
                onClick={() => { setPhase('forgot'); setError(''); setInfo(''); }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                <Icon paths={ICO.key} className="h-4 w-4" />
                Mot de passe oublié
              </button>
            </div>
            <div className="mt-1.5">
              <PasswordField
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                shown={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                placeholder="••••••••••"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
            )}
            {info && (
              <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{info}</p>
            )}
            <button type="submit" disabled={loading} className="btn-primary mt-7 inline-flex w-full items-center justify-center gap-2 disabled:opacity-60">
              <Icon paths={ICO.login} className="h-5 w-5" />
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
            <Link to="/" className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-ink-400 hover:text-brand-600">
              <Icon paths={ICO.back} className="h-4 w-4" />
              Retour au site
            </Link>
          </form>
        )}

        {phase === 'forgot' && (
          <form onSubmit={requestReset} className="rounded-3xl bg-white p-8 shadow-lift sm:p-10">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <Icon paths={ICO.key} className="h-6 w-6" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-ink-900">Mot de passe oublié</h2>
                <p className="text-sm text-ink-500">Un lien valable une heure sera envoyé à votre adresse.</p>
              </div>
            </div>
            <label className="label" htmlFor="forgot-email">Email</label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400">
                <Icon paths={ICO.mail} />
              </span>
              <input
                id="forgot-email"
                className="input pl-11"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="moncompte@adiong.org"
                autoComplete="username"
                autoFocus
              />
            </div>
            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
            )}
            {info && (
              <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{info}</p>
            )}
            <button type="submit" disabled={loading} className="btn-primary mt-7 inline-flex w-full items-center justify-center gap-2 disabled:opacity-60">
              <Icon paths={ICO.mail} className="h-5 w-5" />
              {loading ? 'Envoi…' : 'Envoyer le lien'}
            </button>
            <button type="button" onClick={backToLogin} className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-semibold text-ink-400 hover:text-brand-600">
              <Icon paths={ICO.back} className="h-4 w-4" />
              Retour à la connexion
            </button>
          </form>
        )}

        {phase === 'reset' && (
          <form onSubmit={resetPassword} className="rounded-3xl bg-white p-8 shadow-lift sm:p-10">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <Icon paths={ICO.lock} className="h-6 w-6" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-ink-900">Nouveau mot de passe</h2>
                <p className="text-sm text-ink-500">8 caractères minimum.</p>
              </div>
            </div>
            <label className="label">Nouveau mot de passe</label>
            <PasswordField
              value={nextPassword}
              onChange={(e) => setNextPassword(e.target.value)}
              shown={showNext}
              onToggle={() => setShowNext((v) => !v)}
              placeholder="••••••••••"
              autoComplete="new-password"
              autoFocus
            />
            <label className="label mt-5">Confirmer</label>
            <PasswordField
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              shown={showNext}
              onToggle={() => setShowNext((v) => !v)}
              placeholder="••••••••••"
              autoComplete="new-password"
            />
            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
            )}
            <button type="submit" disabled={loading} className="btn-primary mt-7 inline-flex w-full items-center justify-center gap-2 disabled:opacity-60">
              <Icon paths={ICO.lock} className="h-5 w-5" />
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        )}

        {phase === 'reset-done' && (
          <div className="rounded-3xl bg-white p-8 shadow-lift sm:p-10">
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{info}</p>
          </div>
        )}

        {phase === '2fa' && pending && (
          <form onSubmit={verify} className="rounded-3xl bg-white p-8 shadow-lift sm:p-10">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Icon paths={ICO.shield} className="h-6 w-6" />
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
            <button type="button" onClick={backToLogin} className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-semibold text-ink-400 hover:text-brand-600">
              <Icon paths={ICO.back} className="h-4 w-4" />
              Changer de compte
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

        <p className="mt-6 text-center text-[11px] font-semibold tracking-[0.16em] text-white/45">
          ACCESSIBILITY AND DISABLED INCLUSION
        </p>
      </motion.div>
    </div>
  );
}
