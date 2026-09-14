import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, getToken, setToken, setSavedUser } from '../../api.js';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  if (getToken()) return <Navigate to="/admin" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token, user } = await api.login({ email, password });
      setToken(token);
      setSavedUser(user);
      nav('/admin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="3" fill="#f5a524" stroke="none" />
                <path d="M5 18.5c1.4-4 4-5.5 7-5.5s5.6 1.5 7 5.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="font-display text-xl font-bold text-white">
              ADI <span className="text-accent-400">ONG</span>
            </span>
          </Link>
          <p className="mt-4 text-sm font-semibold tracking-widest text-white/50 uppercase">Espace administrateur</p>
        </div>

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
      </motion.div>
    </div>
  );
}
