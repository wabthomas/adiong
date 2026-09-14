import React, { useCallback, useEffect, useState } from 'react';
import { api, fmtMoney } from '../../api.js';
import { PageTitle, DeleteButton } from './AdminUI.jsx';

const STATUSES = [
  ['nouvelle', 'Nouvelle', 'bg-accent-100 text-accent-800'],
  ['confirmee', 'Confirmée', 'bg-brand-100 text-brand-700'],
  ['refusee', 'Refusée', 'bg-red-100 text-red-700']
];

export default function DonationsAdmin() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('tous');

  const load = useCallback(() => api.adminDonations.list().then(setItems).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    await api.adminDonations.update(id, { status });
    load();
  };

  const remove = async (d) => {
    if (!confirm(`Supprimer le don de ${d.donor_name} (${fmtMoney(d.amount)}) ?`)) return;
    await api.adminDonations.remove(d.id);
    load();
  };

  const filtered = filter === 'tous' ? items : items.filter((d) => d.status === filter);
  const total = items.reduce((s, d) => s + (d.amount || 0), 0);

  return (
    <div>
      <PageTitle
        title="Dons"
        subtitle={`${items.length} don(s) — total ${fmtMoney(total)}`}
        action={
          <div className="flex gap-2">
            {['tous', ...STATUSES.map(([v]) => v)].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-2 text-xs font-bold capitalize transition-colors ${
                  filter === f ? 'bg-brand-600 text-white' : 'bg-white text-ink-500 ring-1 ring-ink-200 hover:ring-brand-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        }
      />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-cream/70 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-4">Donateur</th>
                <th className="px-6 py-4">Campagne</th>
                <th className="px-6 py-4">Montant</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-ink-900">{d.donor_name}</p>
                    <p className="text-xs text-ink-400">{d.donor_email}</p>
                    {d.message && <p className="mt-1 text-xs text-ink-400 italic line-clamp-1">« {d.message} »</p>}
                  </td>
                  <td className="px-6 py-4 text-ink-500">{d.campaign_title || 'Cause générale'}</td>
                  <td className="px-6 py-4 font-display font-extrabold text-brand-600">{fmtMoney(d.amount)}</td>
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
                    <DeleteButton onConfirm={() => remove(d)} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-ink-400">Aucun don.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
