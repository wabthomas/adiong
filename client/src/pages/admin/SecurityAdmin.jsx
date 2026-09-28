import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { PageTitle } from './AdminUI.jsx';

const TABS = [
  { id: 'audit', label: 'Journal d’audit', hint: 'Actions admin & IP réelles' },
  { id: 'evenements', label: 'Événements', hint: 'Connexions, sauvegardes' },
  { id: 'protection', label: 'Protection', hint: 'Alertes & IP bloquées' }
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

function ProtectionTab() {
  const [alerts, setAlerts] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([api.adminSecurity.alerts(), api.adminSecurity.blocklist()])
      .then(([a, b]) => { setAlerts(a); setBlocked(b); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const doBlock = async (target, why) => {
    setMsg('');
    try {
      await api.adminSecurity.blockIp(target, why);
      setMsg(`✓ ${target} bloquée — toutes ses requêtes reçoivent 403.`);
      setIp('');
      load();
    } catch (e) {
      setMsg(`✗ ${e.message}`);
    }
  };

  const doUnblock = async (target) => {
    setMsg('');
    try {
      await api.adminSecurity.unblockIp(target);
      setMsg(`✓ ${target} débloquée.`);
      load();
    } catch (e) {
      setMsg(`✗ ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-6">
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900">Alertes de connexion</h3>
          <p className="mt-1 text-sm text-ink-500">
            Adresses ayant produit 5 échecs de connexion ou plus sur les 15 dernières minutes.
          </p>
        </div>
        {alerts === null && <p className="text-sm text-ink-400">Chargement…</p>}
        {alerts && alerts.length === 0 && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Aucune alerte en cours — aucun pic d’échecs de connexion.
          </p>
        )}
        {alerts && alerts.length > 0 && (
          <div className="divide-y divide-ink-50 rounded-xl border border-ink-100">
            {alerts.map((a) => (
              <div key={a.ip} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-mono text-sm font-bold text-red-700">{a.ip}</p>
                  <p className="text-xs text-ink-400">{a.n} échec(s) · dernier : {String(a.last_at).slice(11, 19)}</p>
                </div>
                <button
                  type="button"
                  disabled={a.blocked}
                  onClick={() => doBlock(a.ip, 'Alerte : échecs de connexion répétés')}
                  className="btn-ghost !px-4 !py-2 text-sm !text-red-600 disabled:opacity-40"
                >
                  {a.blocked ? 'Déjà bloquée' : 'Bloquer cette IP'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card space-y-4 p-6">
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900">Bloquer une adresse</h3>
          <p className="mt-1 text-sm text-ink-500">
            Toute requête venant de cette adresse est refusée (403) sur l’ensemble de l’API.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold text-ink-500">
            Adresse IP
            <input className="input mt-1 !w-44 !py-2 font-mono text-sm" placeholder="203.0.113.10" value={ip} onChange={(e) => setIp(e.target.value)} />
          </label>
          <label className="text-xs font-bold text-ink-500">
            Motif
            <input className="input mt-1 !w-64 !py-2 text-sm" placeholder="Ex. tentative de force brute" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button type="button" className="btn-primary !py-2 text-sm" disabled={!ip} onClick={() => doBlock(ip, reason)}>
            Bloquer
          </button>
        </div>
        {msg && (
          <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${msg.startsWith('✓') ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>
            {msg}
          </p>
        )}
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      </div>

      <div className="card space-y-4 p-6">
        <h3 className="font-display text-lg font-bold text-ink-900">Adresses bloquées ({blocked?.length ?? '…'})</h3>
        {blocked && blocked.length === 0 && (
          <p className="text-sm text-ink-400">Aucune adresse bloquée.</p>
        )}
        {blocked && blocked.length > 0 && (
          <div className="divide-y divide-ink-50 rounded-xl border border-ink-100">
            {blocked.map((b) => (
              <div key={b.ip} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-ink-800">{b.ip}</p>
                  <p className="truncate text-xs text-ink-400">
                    {b.reason || 'Sans motif'} · bloquée le {String(b.created_at).slice(0, 10)}
                  </p>
                </div>
                <button type="button" onClick={() => doUnblock(b.ip)} className="btn-ghost !px-4 !py-2 text-sm">
                  Débloquer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
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
      {tab === 'protection' && <ProtectionTab />}
    </div>
  );
}
