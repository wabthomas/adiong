import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal, { Counter } from '../../components/Reveal.jsx';
import { api, fmtMoney } from '../../api.js';
import { PageTitle } from './AdminUI.jsx';

const cards = [
  { key: 'articles', to: '/admin/articles', label: 'Articles publiés', color: 'bg-brand-100 text-brand-700' },
  { key: 'causes', to: '/admin/causes', label: 'Causes', color: 'bg-accent-100 text-accent-700' },
  { key: 'campaigns', to: '/admin/campagnes', label: 'Campagnes de collecte', color: 'bg-brand-100 text-brand-700' },
  { key: 'messages', to: '/admin/messages', label: 'Messages reçus', color: 'bg-accent-100 text-accent-700' }
];

export default function Dashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.dashboard().then(setD).catch(() => {});
  }, []);

  if (!d) return <PageTitle title="Tableau de bord" />;

  return (
    <div>
      <PageTitle
        title="Tableau de bord"
        subtitle="Vue d'ensemble de votre activité"
        action={
          <Link to="/admin/articles" className="btn-primary !px-5 !py-2.5 text-sm">
            + Nouvel article
          </Link>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <Reveal key={c.key} delay={i * 0.06}>
            <Link to={c.to} className="card block p-6 transition-transform hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <p className="font-display text-3xl font-extrabold text-ink-900">
                  <Counter value={d[c.key] || 0} />
                </p>
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${c.color}`}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75Z" />
                  </svg>
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-ink-500">{c.label}</p>
            </Link>
          </Reveal>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Reveal delay={0.1}>
          <div className="rounded-3xl bg-gradient-to-br from-brand-700 to-brand-800 p-7 text-white">
            <p className="text-sm font-bold tracking-wide text-white/60 uppercase">Total collecté (campagnes)</p>
            <p className="mt-2 font-display text-4xl font-extrabold text-accent-300">
              {fmtMoney(d.campaigns_collected)}
            </p>
            <p className="mt-3 text-sm text-white/70">
              {d.donations} don{d.donations > 1 ? 's' : ''} enregistré{d.donations > 1 ? 's' : ''} via le site —{' '}
              {fmtMoney(d.donations_total)}
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="card p-7">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-ink-900">Derniers dons</h3>
              <Link to="/admin/dons" className="text-sm font-bold text-brand-600 hover:underline">Tout voir</Link>
            </div>
            <ul className="mt-4 space-y-3">
              {d.latest_donations.slice(0, 4).map((don) => (
                <li key={don.id} className="flex items-center justify-between rounded-xl bg-cream px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-ink-900">{don.donor_name}</p>
                    <p className="text-xs text-ink-400">{don.campaign_title || 'Cause générale'}</p>
                  </div>
                  <span className="font-display font-extrabold text-brand-600">{fmtMoney(don.amount)}</span>
                </li>
              ))}
              {d.latest_donations.length === 0 && <li className="text-sm text-ink-400">Aucun don pour le moment.</li>}
            </ul>
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.2}>
        <div className="card mt-6 p-7">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-ink-900">
              Derniers messages{' '}
              {d.unread_messages > 0 && (
                <span className="ml-2 rounded-full bg-accent-400 px-2.5 py-0.5 text-xs font-bold text-ink-950">
                  {d.unread_messages} non lu{d.unread_messages > 1 ? 's' : ''}
                </span>
              )}
            </h3>
            <Link to="/admin/messages" className="text-sm font-bold text-brand-600 hover:underline">Tout voir</Link>
          </div>
          <ul className="mt-4 space-y-3">
            {d.latest_messages.slice(0, 4).map((m) => (
              <li key={m.id} className={`rounded-xl px-4 py-3 ${m.read ? 'bg-cream' : 'bg-accent-50 ring-1 ring-accent-200'}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-ink-900">
                    {m.name} <span className="font-medium text-ink-400">· {m.email}</span>
                  </p>
                  <p className="text-xs text-ink-400">{new Date(m.created_at + 'Z').toLocaleDateString('fr-FR')}</p>
                </div>
                <p className="mt-1 text-sm text-ink-500 line-clamp-1">{m.subject ? `${m.subject} — ` : ''}{m.message}</p>
              </li>
            ))}
            {d.latest_messages.length === 0 && <li className="text-sm text-ink-400">Aucun message reçu.</li>}
          </ul>
        </div>
      </Reveal>
    </div>
  );
}
