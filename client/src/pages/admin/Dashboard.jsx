import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal, { Counter } from '../../components/Reveal.jsx';
import { api, fmtMoney, getSavedUser } from '../../api.js';
import { PageTitle } from './AdminUI.jsx';

const STATS = [
  {
    key: 'articles',
    to: '/admin/articles',
    label: 'Articles',
    hint: 'Publiés',
    tone: 'bg-brand-50 text-brand-700 ring-brand-100',
    icon: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V19.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.375c0-.621.504-1.125 1.125-1.125H2.25m12-1.5h3.375c.62 0 1.125.504 1.125 1.125V4.5m-2.625 5.5h5.25'
  },
  {
    key: 'causes',
    to: '/admin/causes',
    label: 'Causes',
    hint: 'Domaines',
    tone: 'bg-accent-50 text-accent-700 ring-accent-100',
    icon: 'M12 3v2.25M6.375 6.375l1.59 1.59m5.46 0 1.59-1.59M3 12h2.25M18.75 12H21m-2.625 5.625-1.59-1.59m-5.46 0-1.59 1.59M12 18.75V21'
  },
  {
    key: 'campaigns',
    to: '/admin/campagnes',
    label: 'Campagnes',
    hint: 'Collectes',
    tone: 'bg-brand-50 text-brand-700 ring-brand-100',
    icon: 'M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21'
  },
  {
    key: 'messages',
    to: '/admin/messages',
    label: 'Messages',
    hint: 'Reçus',
    tone: 'bg-accent-50 text-accent-700 ring-accent-100',
    icon: 'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75'
  }
];

function Icon({ d, className = 'h-5 w-5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function donorLabel(don) {
  if (don.is_anonymous) return 'Don anonyme';
  return don.donor_name || 'Donateur';
}

function formatDay(iso) {
  try {
    return new Date(iso.includes('Z') || iso.includes('+') ? iso : `${iso}Z`).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  } catch {
    return '';
  }
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const user = getSavedUser();
  const firstName = (user?.full_name || '').trim().split(/\s+/)[0] || 'Admin';
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  useEffect(() => {
    api.dashboard().then(setD).catch(() => {});
  }, []);

  if (!d) return <PageTitle title="Tableau de bord" />;

  const unread = d.unread_messages || 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      {/* Accueil mobile : une seule composition lisible sans doubler le titre sticky */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400 capitalize">{today}</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            Bonjour, {firstName}
          </h2>
          <p className="mt-1 text-sm text-ink-500 sm:text-[15px]">Vue d’ensemble de l’activité du site</p>
        </div>
        <Link
          to="/admin/articles"
          className="btn-primary hidden !px-5 !py-2.5 text-sm sm:inline-flex"
        >
          + Nouvel article
        </Link>
      </div>

      {/* Actions rapides — scroll horizontal sur mobile */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <Link
          to="/admin/articles"
          className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-soft sm:hidden"
        >
          + Article
        </Link>
        <Link
          to="/admin/messages"
          className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-ink-700 ring-1 ring-ink-100"
        >
          Messages
          {unread > 0 && (
            <span className="rounded-full bg-accent-400 px-2 py-0.5 text-[11px] font-extrabold text-ink-950">
              {unread}
            </span>
          )}
        </Link>
        <Link
          to="/admin/dons"
          className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-ink-700 ring-1 ring-ink-100"
        >
          Dons
          <span className="text-ink-400">{d.donations || 0}</span>
        </Link>
        <Link
          to="/admin/campagnes"
          className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-ink-700 ring-1 ring-ink-100"
        >
          Campagnes
        </Link>
      </div>

      {/* Stats — grille 2×2 dense sur mobile */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {STATS.map((c, i) => (
          <Reveal key={c.key} delay={i * 0.05}>
            <Link
              to={c.to}
              className="group relative block overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-ink-100 transition hover:-translate-y-0.5 hover:shadow-soft sm:rounded-3xl sm:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ring-1 sm:h-10 sm:w-10 ${c.tone}`}>
                  <Icon d={c.icon} className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
                {c.key === 'messages' && unread > 0 && (
                  <span className="rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-extrabold text-ink-950">
                    {unread} non lu{unread > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="mt-3 font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
                <Counter value={d[c.key] || 0} />
              </p>
              <p className="mt-0.5 text-sm font-bold text-ink-800">{c.label}</p>
              <p className="text-xs font-semibold text-ink-400">{c.hint}</p>
            </Link>
          </Reveal>
        ))}
      </div>

      {/* Collecte + derniers dons */}
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <Reveal delay={0.08}>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 p-5 text-white sm:p-7">
            <div
              className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full opacity-30"
              style={{ background: 'radial-gradient(circle, #fc7a03 0%, transparent 70%)' }}
            />
            <p className="text-[11px] font-bold tracking-[0.16em] text-white/55 uppercase">Total collecté (confirmé)</p>
            <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-accent-300 sm:text-4xl">
              {fmtMoney(d.donations_total || 0)}
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
              {(d.donations_confirmed || 0) === 0
                ? 'Aucun don confirmé pour le moment'
                : `${d.donations_confirmed} don${d.donations_confirmed > 1 ? 's' : ''} confirmé${d.donations_confirmed > 1 ? 's' : ''}`}
              {(d.donations_pending || 0) > 0 && (
                <>
                  {' — '}
                  <span className="font-semibold text-white">
                    {d.donations_pending} en attente ({fmtMoney(d.donations_pending_total || 0)})
                  </span>
                </>
              )}
            </p>
            <Link
              to="/admin/dons"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-accent-300 hover:text-white"
            >
              Voir les dons
              <Icon d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <section className="rounded-3xl bg-white p-4 ring-1 ring-ink-100 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-base font-bold text-ink-900 sm:text-lg">Derniers dons</h3>
              <Link to="/admin/dons" className="text-sm font-bold text-brand-600 hover:underline">
                Tout voir
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-ink-50 sm:mt-4">
              {(d.latest_donations || []).slice(0, 4).map((don) => (
                <li key={don.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                    <Icon
                      d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
                      className="h-4 w-4"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink-900">{donorLabel(don)}</p>
                    <p className="truncate text-xs text-ink-400">
                      {don.campaign_title || 'Cause générale'}
                      {don.reference ? ` · ${don.reference}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-display text-sm font-extrabold text-brand-600 sm:text-base">
                    {fmtMoney(don.amount)}
                  </span>
                </li>
              ))}
              {(d.latest_donations || []).length === 0 && (
                <li className="py-6 text-center text-sm text-ink-400">Aucun don pour le moment.</li>
              )}
            </ul>
          </section>
        </Reveal>
      </div>

      {/* Messages */}
      <Reveal delay={0.16}>
        <section className="rounded-3xl bg-white p-4 ring-1 ring-ink-100 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex min-w-0 items-center gap-2 font-display text-base font-bold text-ink-900 sm:text-lg">
              <span className="truncate">Derniers messages</span>
              {unread > 0 && (
                <span className="shrink-0 rounded-full bg-accent-400 px-2.5 py-0.5 text-[11px] font-extrabold text-ink-950">
                  {unread} non lu{unread > 1 ? 's' : ''}
                </span>
              )}
            </h3>
            <Link to="/admin/messages" className="shrink-0 text-sm font-bold text-brand-600 hover:underline">
              Tout voir
            </Link>
          </div>
          <ul className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
            {(d.latest_messages || []).slice(0, 4).map((m) => (
              <li
                key={m.id}
                className={`rounded-2xl px-3.5 py-3 sm:px-4 ${
                  m.read ? 'bg-[#f4f6fb]' : 'bg-accent-50 ring-1 ring-accent-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-900">{m.name}</p>
                    <p className="truncate text-xs text-ink-400">{m.email}</p>
                  </div>
                  <p className="shrink-0 text-[11px] font-semibold text-ink-400">{formatDay(m.created_at)}</p>
                </div>
                <p className="mt-1.5 text-sm leading-snug text-ink-600 line-clamp-2">
                  {m.subject ? <span className="font-semibold text-ink-800">{m.subject} — </span> : null}
                  {m.message}
                </p>
              </li>
            ))}
            {(d.latest_messages || []).length === 0 && (
              <li className="py-6 text-center text-sm text-ink-400">Aucun message reçu.</li>
            )}
          </ul>
        </section>
      </Reveal>
    </div>
  );
}
