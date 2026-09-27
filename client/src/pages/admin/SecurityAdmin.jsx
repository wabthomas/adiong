import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { PageTitle } from './AdminUI.jsx';

const TABS = [
  { id: 'audit', label: 'Journal d’audit', hint: 'Actions admin & IP réelles' },
  { id: 'evenements', label: 'Événements', hint: 'Connexions, sauvegardes' }
];

const METHOD_STYLES = {
  GET: 'bg-ink-100 text-ink-600',
  POST: 'bg-brand-100 text-brand-700',
  PUT: 'bg-amber-100 text-amber-800',
  PATCH: 'bg-amber-100 text-amber-800',
  DELETE: 'bg-red-100 text-red-700'
};

const statusBadge = (s) => {
  const n = Number(s) || 0;
  if (n >= 500) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">{n}</span>;
  if (n >= 400) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{n}</span>;
  if (n >= 200 && n < 300) return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{n}</span>;
  return <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-500">{n}</span>;
};

const EVENT_STYLES = {
  login_fail: 'bg-red-100 text-red-700',
  login_ok: 'bg-emerald-100 text-emerald-700',
  logout: 'bg-ink-100 text-ink-600',
  backup_export: 'bg-brand-100 text-brand-700',
  backup_restore: 'bg-amber-100 text-amber-800'
};

const EVENT_LABELS = {
  login_fail: 'Échec de connexion',
  login_ok: 'Connexion',
  logout: 'Déconnexion',
  backup_export: 'Sauvegarde exportée',
  backup_restore: 'Restauration'
};

function AuditTab() {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [method, setMethod] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.adminSecurity.audit({ from, to, method, q })
      .then(setData)
      .catch((e) => setError(e.message || 'Journal indisponible'));
  }, [from, to, method, q]);

  useEffect(() => { load(); }, [load]);

  const rows = data?.rows || [];
  const errs = rows.filter((r) => (r.status || 0) >= 400).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-bold text-ink-500">
          Du
          <input type="date" className="input mt-1 !w-40 !py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs font-bold text-ink-500">
          Au
          <input type="date" className="input mt-1 !w-40 !py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="text-xs font-bold text-ink-500">
          Méthode
          <select className="input mt-1 !w-32 !py-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">Toutes</option>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
            <option>DELETE</option>
          </select>
        </label>
        <label className="text-xs font-bold text-ink-500">
          Recherche
          <input className="input mt-1 !w-52 !py-2 text-sm" placeholder="Chemin, email, IP…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button type="button" className="btn-ghost !py-2 text-sm" onClick={load}>Actualiser</button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-ink-100 bg-cream/50 px-4 py-3">
            <p className="text-[11px] font-bold tracking-wide text-ink-400 uppercase">Actions (1000 dernières)</p>
            <p className="mt-1 text-xl font-extrabold text-ink-900">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-ink-100 bg-cream/50 px-4 py-3">
            <p className="text-[11px] font-bold tracking-wide text-ink-400 uppercase">Échecs (4xx / 5xx)</p>
            <p className={`mt-1 text-xl font-extrabold ${errs ? 'text-red-600' : 'text-ink-900'}`}>{errs}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-ink-100 bg-cream/50 px-4 py-3">
            <p className="text-[11px] font-bold tracking-wide text-ink-400 uppercase">Adresses les plus actives</p>
            <p className="mt-1 truncate text-sm font-bold text-ink-700">
              {(data.top_ips || []).map((t) => `${t.ip} (${t.n})`).join(' · ') || '—'}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-ink-100">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-ink-100 bg-cream/50 text-xs font-bold tracking-wide text-ink-400 uppercase">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Utilisateur</th>
              <th className="px-4 py-3">Méthode</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Navigateur</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/30">
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-600">{String(r.created_at).replace('T', ' ').slice(0, 19)}</td>
                <td className="px-4 py-2.5">
                  <p className="font-semibold text-ink-800">{r.email || 'Public'}</p>
                  {r.role && r.role !== 'public' && <p className="text-[11px] text-ink-400">{r.role}</p>}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${METHOD_STYLES[r.method] || 'bg-ink-100 text-ink-500'}`}>{r.method}</span>
                </td>
                <td className="max-w-[320px] truncate px-4 py-2.5 font-mono text-xs text-ink-600" title={r.path}>{r.path}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold text-ink-700">{r.ip}</td>
                <td className="px-4 py-2.5">{statusBadge(r.status)}</td>
                <td className="max-w-[220px] truncate px-4 py-2.5 text-xs text-ink-400" title={r.ua}>{r.ua || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-10 text-center text-sm text-ink-400">Aucune action enregistrée sur cette période.</p>}
      </div>
    </div>
  );
}

function EventsTab() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.adminSecurity.events().then(setRows).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>;
  if (!rows) return <p className="py-10 text-center text-sm text-ink-400">Chargement…</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-100">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-ink-100 bg-cream/50 text-xs font-bold tracking-wide text-ink-400 uppercase">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Événement</th>
            <th className="px-4 py-3">IP</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Détail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/30">
              <td className="whitespace-nowrap px-4 py-2.5 text-ink-600">{String(e.created_at).replace('T', ' ').slice(0, 19)}</td>
              <td className="px-4 py-2.5">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${EVENT_STYLES[e.type] || 'bg-ink-100 text-ink-600'}`}>
                  {EVENT_LABELS[e.type] || e.type}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold text-ink-700">{e.ip}</td>
              <td className="px-4 py-2.5 text-ink-600">{e.email || '—'}</td>
              <td className="max-w-[360px] truncate px-4 py-2.5 text-xs text-ink-400" title={e.detail}>{e.detail || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="py-10 text-center text-sm text-ink-400">Aucun événement enregistré.</p>}
    </div>
  );
}

export default function SecurityAdmin() {
  const [tab, setTab] = useState('audit');

  return (
    <div>
      <PageTitle
        title="Sécurité"
        subtitle="Suivi des actions administratives avec IP réelle, événements de sécurité et protection."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              tab === t.id ? 'bg-brand-600 text-white shadow' : 'bg-white text-ink-600 ring-1 ring-ink-100 hover:bg-cream'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'audit' && <AuditTab />}
      {tab === 'evenements' && <EventsTab />}
    </div>
  );
}
