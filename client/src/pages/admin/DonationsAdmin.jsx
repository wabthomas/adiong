import React, { useCallback, useEffect, useState } from 'react';
import { api, fmtMoney } from '../../api.js';
import { PageTitle, DeleteButton } from './AdminUI.jsx';

const STATUSES = [
  ['nouvelle', 'Nouvelle', 'bg-ink-100 text-ink-600'],
  ['preuve', 'Preuve reçue', 'bg-accent-100 text-accent-800'],
  ['confirmee', 'Confirmée', 'bg-brand-100 text-brand-700'],
  ['refusee', 'Refusée', 'bg-red-100 text-red-700']
];

const METHOD_LABELS = { airtel: 'Airtel Money', mpesa: 'M-Pesa', orange: 'Orange Money', carte: 'Carte / virement' };

function ProofPreview({ donation, onBack }) {
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!donation?.proof) return;
    setPreview(null);
    setErr('');
    api.adminDonations.proofUrl(donation.id)
      .then((p) => setPreview(p))
      .catch((e) => setErr(e.message));
    return () => {};
  }, [donation?.id, donation?.proof]);

  if (!donation.proof) return <p className="text-sm text-ink-400">Aucune preuve fournie.</p>;
  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!preview) return <p className="text-sm text-ink-400">Chargement de la preuve…</p>;
  if (preview.ct.startsWith('image/')) {
    return <img src={preview.url} alt={`Preuve de paiement — ${donation.proof_name || donation.reference}`} className="max-h-[60vh] w-auto rounded-xl" />;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">Preuve (PDF) : {donation.proof_name || 'preuve'}</p>
      <a href={preview.url} download={donation.proof_name || 'preuve'} className="btn-primary text-sm">Télécharger la preuve</a>
    </div>
  );
}

export default function DonationsAdmin() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('tous');
  const [detail, setDetail] = useState(null);

  const load = useCallback(() => api.adminDonations.list().then(setItems).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    await api.adminDonations.update(id, { status });
    load();
  };

  const remove = async (d) => {
    if (!confirm(`Supprimer le don de ${d.donor_name} (${fmtMoney(d.amount)}) ?`)) return;
    await api.adminDonations.remove(d.id);
    if (detail?.id === d.id) setDetail(null);
    load();
  };

  const filtered = filter === 'tous' ? items : items.filter((d) => d.status === filter);
  const total = items.reduce((s, d) => s + (d.amount || 0), 0);
  const detailLive = detail ? items.find((d) => d.id === detail.id) || detail : null;
  const detailStatus = detailLive ? (STATUSES.find(([v]) => v === detailLive.status) || STATUSES[0])[1] : '';

  return (
    <div>
      <PageTitle
        title="Dons"
        subtitle={`${items.length} don(s) — total ${fmtMoney(total)}`}
        action={
          <div className="flex flex-wrap gap-2">
            {['tous', ...STATUSES.map(([v]) => v)].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                  filter === f ? 'bg-brand-600 text-white' : 'bg-white text-ink-500 ring-1 ring-ink-200 hover:ring-brand-300'
                }`}
              >
                {STATUSES.find(([v]) => v === f)?.[1] || 'Tous'}
              </button>
            ))}
          </div>
        }
      />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-cream/70 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-4">Donateur</th>
                <th className="px-6 py-4">Référence</th>
                <th className="px-6 py-4">Mode</th>
                <th className="px-6 py-4">Montant</th>
                <th className="px-6 py-4">Preuve</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-ink-900">
                      {d.donor_name}
                      {d.is_anonymous && (
                        <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-500 uppercase">Anonyme</span>
                      )}
                    </p>
                    <p className="text-xs text-ink-400">{d.donor_email || d.campaign_title || 'Cause générale'}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-ink-500">{d.reference || '—'}</td>
                  <td className="px-6 py-4 text-ink-500">{METHOD_LABELS[d.method] || '—'}</td>
                  <td className="px-6 py-4 font-display font-extrabold text-brand-600">{fmtMoney(d.amount, d.currency)}</td>
                  <td className="px-6 py-4">
                    {d.proof ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-xs font-bold text-accent-800">
                        {d.proof_name || 'Reçue'}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-ink-500">{new Date(d.created_at + 'Z').toLocaleDateString('fr-FR')}</td>
                  <td className="px-6 py-4">
                    <select
                      value={d.status}
                      onChange={(e) => setStatus(d.id, e.target.value)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold outline-none ${
                        (STATUSES.find(([v]) => v === d.status) || STATUSES[0])[2]
                      }`}
                    >
                      {STATUSES.map(([v, label]) => (
                        <option key={v} value={v}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setDetail(d)}
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
                      >
                        Détail
                      </button>
                      <DeleteButton onConfirm={() => remove(d)} />
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-ink-400">Aucun don.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailLive && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink-950/50 p-4 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-7 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold text-ink-900">
                  {detailLive.donor_name}
                  {detailLive.is_anonymous && (
                    <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 align-middle text-[10px] font-bold text-ink-500 uppercase">Don anonyme</span>
                  )}
                </h3>
                <p className="mt-1 text-sm text-ink-400">
                  {detailLive.donor_email || 'Sans email'} · {detailLive.campaign_title || 'Cause générale'} ·{' '}
                  {new Date(detailLive.created_at + 'Z').toLocaleDateString('fr-FR')}
                </p>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="rounded-full bg-ink-50 px-3 py-1.5 text-xs font-bold text-ink-500 hover:bg-ink-100"
              >
                Fermer
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-ink-50/70 p-3">
                <p className="text-[10px] font-bold tracking-wide text-ink-400 uppercase">Référence</p>
                <p className="mt-1 font-mono text-sm font-bold text-ink-900">{detailLive.reference || '—'}</p>
              </div>
              <div className="rounded-2xl bg-ink-50/70 p-3">
                <p className="text-[10px] font-bold tracking-wide text-ink-400 uppercase">Mode</p>
                <p className="mt-1 text-sm font-bold text-ink-900">{METHOD_LABELS[detailLive.method] || '—'}</p>
              </div>
              <div className="rounded-2xl bg-ink-50/70 p-3">
                <p className="text-[10px] font-bold tracking-wide text-ink-400 uppercase">Montant</p>
                <p className="mt-1 text-sm font-bold text-brand-700">{fmtMoney(detailLive.amount, detailLive.currency)}</p>
              </div>
              <div className="rounded-2xl bg-ink-50/70 p-3">
                <p className="text-[10px] font-bold tracking-wide text-ink-400 uppercase">N° transaction</p>
                <p className="mt-1 text-sm font-bold text-ink-900">{detailLive.tx_ref || '—'}</p>
              </div>
            </div>

            {detailLive.message && (
              <p className="mt-4 rounded-2xl bg-cream p-4 text-sm text-ink-600 italic">« {detailLive.message} »</p>
            )}

            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-bold text-ink-700">Preuve de paiement</p>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  (STATUSES.find(([v]) => v === detailLive.status) || STATUSES[0])[2]
                }`}>
                  {detailStatus}
                </span>
              </div>
              <div className="mt-3">
                <ProofPreview donation={detailLive} />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5">
              <label className="flex items-center gap-2 text-sm font-semibold text-ink-600">
                Statut :
                <select
                  value={detailLive.status}
                  onChange={(e) => setStatus(detailLive.id, e.target.value)}
                  className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-brand-400"
                >
                  {STATUSES.map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => remove(detailLive)}
                className="rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-100"
              >
                Supprimer ce don
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
