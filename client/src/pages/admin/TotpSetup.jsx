import React, { useState } from 'react';
import { api } from '../../api.js';

// Assistant d'armement TOTP : QR → code de confirmation → codes de secours.
// Utilisable avec une session normale (Profil) ou un jeton 2FA en attente (login).
export default function TotpSetup({ pendingToken, onClose, onEnrolled }) {
  const [step, setStep] = useState('qr');
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const s = await api.totp.setup(pendingToken);
      setSetup(s);
      setStep('code');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError('Saisissez le code à 6 chiffres de votre application.');
    setBusy(true);
    setError('');
    try {
      const r = await api.totp.confirm({ secret: setup.secret, code }, pendingToken);
      setCodes(r.backup_codes);
      setStep('codes');
      onEnrolled?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* presse-papiers indisponible */ }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lift sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900">Authentification à deux facteurs</h3>
            <p className="mt-1 text-sm text-ink-500">
              {step === 'qr' && 'Étape 1/2 — scannez le code avec votre application.'}
              {step === 'code' && 'Étape 2/2 — saisissez le code affiché dans l’application.'}
              {step === 'codes' && 'Votre compte est protégé. Conservez ces codes de secours.'}
            </p>
          </div>
          <button type="button" className="rounded-full p-2 text-ink-400 hover:bg-ink-100" onClick={onClose} aria-label="Fermer">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
          </button>
        </div>

        {step === 'qr' && (
          <div className="space-y-4">
            <p className="text-sm text-ink-600">
              Ouvrez <strong>Google Authenticator</strong>, <strong>FreeOTP</strong> ou <strong>Microsoft Authenticator</strong>, puis scannez :
            </p>
            {busy && <div className="grid h-60 place-items-center rounded-2xl bg-ink-50 text-sm text-ink-400">Génération du code…</div>}
            {!busy && (
              <button type="button" onClick={load} className="btn-primary mx-auto !px-6 !py-3">Générer le code QR</button>
            )}
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          </div>
        )}

        {step === 'code' && (
          <form onSubmit={confirm} className="space-y-4">
            {setup?.qr ? (
              <div className="mx-auto w-fit rounded-2xl border border-ink-100 p-3">
                <img src={setup.qr} alt="Code QR d’authentification" className="h-52 w-52" />
              </div>
            ) : (
              <div className="rounded-2xl bg-ink-50 p-4 text-center">
                <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">Clé manuelle</p>
                <p className="mt-1 font-mono text-lg font-bold tracking-wider text-ink-900">{setup?.secret}</p>
              </div>
            )}
            <label className="label">Code de l’application</label>
            <input
              className="input text-center font-mono text-xl tracking-[0.4em]"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            <p className="text-xs text-ink-400">
              Sans QR : ajoutez un compte « manuel » avec la clé <span className="font-mono">{setup?.secret}</span>.
            </p>
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
            <div className="flex gap-3">
              <button type="button" className="btn-ghost flex-1 !py-2.5" onClick={() => setStep('qr')}>Retour</button>
              <button type="submit" className="btn-primary flex-1 !py-2.5" disabled={busy}>Valider et activer</button>
            </div>
          </form>
        )}

        {step === 'codes' && (
          <div className="space-y-4">
            <p className="text-sm text-ink-600">
              Chacun de ces 10 codes ouvre la porte <strong>une seule fois</strong> si vous n’avez plus votre téléphone.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-ink-50 p-4 font-mono text-sm font-semibold text-ink-800">
              {codes?.map((c) => <span key={c}>{c}</span>)}
            </div>
            <button type="button" className="btn-ghost w-full !py-2.5" onClick={copy}>
              {copied ? 'Copié ✓' : 'Copier les 10 codes'}
            </button>
            <button type="button" className="btn-primary w-full !py-2.5" onClick={onClose}>J’ai enregistré, terminé</button>
          </div>
        )}
      </div>
    </div>
  );
}
