import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtMoney, getSavedUser } from '../../api.js';
import { categoryLabel } from '../../components/Cards.jsx';
import { PageTitle } from './AdminUI.jsx';
import { useSite } from '../../hooks/useSite.jsx';

const METHOD_LABELS = {
  airtel: 'Airtel Money',
  mpesa: 'M-Pesa',
  orange: 'Orange Money',
  carte: 'Carte / virement',
  autre: 'Autre'
};

const STATUS_META = {
  nouvelle: { label: 'Nouvelle', color: '#94a3b8' },
  preuve: { label: 'Preuve', color: '#fc7a03' },
  confirmee: { label: 'Confirmée', color: '#0f3a88' },
  refusee: { label: 'Refusée', color: '#dc2626' }
};

const KPI = [
  {
    key: 'articles',
    to: '/admin/articles',
    label: 'Articles',
    hintKey: 'articles_drafts',
    hint: (n) => (n ? `${n} brouillon${n > 1 ? 's' : ''}` : 'Publiés'),
    tone: 'bg-brand-50 text-brand-700',
    icon: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V19.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.375c0-.621.504-1.125 1.125-1.125H2.25m12-1.5h3.375c.62 0 1.125.504 1.125 1.125V4.5m-2.625 5.5h5.25'
  },
  {
    key: 'campaigns',
    to: '/admin/campagnes',
    label: 'Campagnes',
    hint: () => 'Collectes actives',
    tone: 'bg-accent-50 text-accent-800',
    icon: 'M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21'
  },
  {
    key: 'donations',
    to: '/admin/dons',
    label: 'Dons',
    hintKey: 'donations_pending',
    hint: (n) => (n ? `${n} en attente` : 'Tous traités'),
    tone: 'bg-brand-50 text-brand-700',
    icon: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z'
  },
  {
    key: 'messages',
    to: '/admin/messages',
    label: 'Messages',
    hintKey: 'unread_messages',
    hint: (n) => (n ? `${n} non lu${n > 1 ? 's' : ''}` : 'Tous lus'),
    tone: 'bg-accent-50 text-accent-800',
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

function weekday(day) {
  try {
    return new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'narrow' });
  } catch {
    return '';
  }
}

function AreaChart({ series = [], valueKey = 'total', color = '#0f3a88', height = 148 }) {
  const w = 560;
  const h = height;
  const pad = { t: 10, r: 8, b: 22, l: 8 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const values = series.map((p) => Number(p[valueKey] || 0));
  const max = Math.max(1, ...values);
  const n = Math.max(1, series.length - 1);
  const pts = series.map((p, i) => {
    const x = pad.l + (i / n) * innerW;
    const y = pad.t + innerH - (Number(p[valueKey] || 0) / max) * innerH;
    return [x, y];
  });
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${(pad.l + innerW).toFixed(1)},${(pad.t + innerH).toFixed(1)} L${pad.l},${(pad.t + innerH).toFixed(1)} Z`;
  const ticks = series.filter((_, i) => i === 0 || i === series.length - 1 || i % 4 === 0);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[148px] w-full" role="img" aria-label="Évolution">
      <defs>
        <linearGradient id={`fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line
          key={g}
          x1={pad.l}
          x2={pad.l + innerW}
          y1={pad.t + innerH * g}
          y2={pad.t + innerH * g}
          stroke="#e8ecf4"
          strokeWidth="1"
        />
      ))}
      <path d={area} fill={`url(#fill-${color.replace('#', '')})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {pts.length ? (
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={color} />
      ) : null}
      {ticks.map((p) => {
        const i = series.indexOf(p);
        const x = pad.l + (i / n) * innerW;
        return (
          <text key={p.day} x={x} y={h - 6} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">
            {weekday(p.day)}
          </text>
        );
      })}
    </svg>
  );
}

function BarChart({ series = [], valueKey = 'n', color = '#fc7a03' }) {
  const max = Math.max(1, ...series.map((p) => Number(p[valueKey] || 0)));
  return (
    <div className="flex h-[148px] items-end gap-1">
      {series.map((p, i) => {
        const v = Number(p[valueKey] || 0);
        const last = i === series.length - 1;
        return (
          <div key={p.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md"
              style={{
                height: `${Math.max(4, (v / max) * 118)}px`,
                background: last ? color : `${color}55`
              }}
              title={`${v}`}
            />
            {(i === 0 || last || i % 3 === 0) && (
              <span className="text-[10px] font-semibold text-ink-400">{weekday(p.day)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Donut({ slices = [], size = 132 }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" className="h-[132px] w-[132px] shrink-0" style={{ width: size, height: size }}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#eef2f8" strokeWidth="16" />
      {slices.map((s) => {
        const dash = (s.value / total) * c;
        const el = (
          <circle
            key={s.key}
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="16"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 60 60)"
            strokeLinecap="butt"
          />
        );
        offset += dash;
        return el;
      })}
      <text x="60" y="56" textAnchor="middle" fill="#0f172a" fontSize="18" fontWeight="800">
        {slices.reduce((a, s) => a + s.value, 0)}
      </text>
      <text x="60" y="72" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="700">
        dons
      </text>
    </svg>
  );
}

function Card({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-white p-4 ring-1 ring-ink-100 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-bold text-ink-900 sm:text-[15px]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const { site } = useSite();
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

  const series14 = d?.donations_series || [];
  const msgSeries = d?.messages_series || [];
  const periodTotal = useMemo(
    () => series14.reduce((a, p) => a + Number(p.total || 0), 0),
    [series14]
  );
  const periodCount = useMemo(
    () => series14.reduce((a, p) => a + Number(p.n || 0), 0),
    [series14]
  );

  const statusSlices = useMemo(() => {
    const rows = d?.donations_by_status || [];
    return ['confirmee', 'preuve', 'nouvelle', 'refusee']
      .map((key) => {
        const row = rows.find((r) => r.status === key);
        return {
          key,
          value: Number(row?.n || 0),
          color: STATUS_META[key].color,
          label: STATUS_META[key].label
        };
      })
      .filter((s) => s.value > 0);
  }, [d]);

  const methods = d?.donations_by_method || [];
  const maxMethod = Math.max(1, ...methods.map((m) => Number(m.total || 0)));
  const cats = d?.articles_by_category || [];
  const maxCat = Math.max(1, ...cats.map((c) => Number(c.n || 0)));

  if (!d) return <PageTitle title="Tableau de bord" />;

  const unread = d.unread_messages || 0;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400 capitalize">{today}</p>
          <h2 className="mt-0.5 font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">
            Bonjour, {firstName}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/articles" className="btn-primary !px-4 !py-2 text-sm">
            + Article
          </Link>
          <Link to="/admin/dons" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-700 ring-1 ring-ink-100">
            Dons
            {(d.donations_pending || 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-accent-400 px-1.5 py-0.5 text-[10px] font-extrabold text-ink-950">
                {d.donations_pending}
              </span>
            )}
          </Link>
          <Link to="/admin/messages" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-700 ring-1 ring-ink-100">
            Messages
            {unread > 0 && (
              <span className="ml-1.5 rounded-full bg-accent-400 px-1.5 py-0.5 text-[10px] font-extrabold text-ink-950">
                {unread}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {KPI.map((c) => (
          <Link
            key={c.key}
            to={c.to}
            className="flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-ink-100 transition hover:shadow-soft"
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${c.tone}`}>
              <Icon d={c.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-2xl font-extrabold leading-none text-ink-900">
                {d[c.key] || 0}
              </span>
              <span className="mt-0.5 block truncate text-xs font-bold text-ink-700">{c.label}</span>
              <span className="block truncate text-[11px] font-semibold text-ink-400">
                {c.hint(c.hintKey ? d[c.hintKey] || 0 : 0)}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 p-5 text-white lg:col-span-1">
          <div
            className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, #fc7a03 0%, transparent 70%)' }}
          />
          <p className="text-[11px] font-bold tracking-[0.16em] text-white/55 uppercase">Collecté confirmé</p>
          <p className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-accent-300">
            {fmtMoney(d.donations_total || 0)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-white/70">
            {d.donations_confirmed || 0} don{(d.donations_confirmed || 0) > 1 ? 's' : ''} validé
            {(d.donations_pending || 0) > 0 && (
              <> · {d.donations_pending} en attente ({fmtMoney(d.donations_pending_total || 0)})</>
            )}
          </p>
          <p className="mt-4 text-[11px] font-semibold text-white/50">14 derniers jours · {fmtMoney(periodTotal)}</p>
          <Link to="/admin/dons" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-accent-300 hover:text-white">
            Voir les dons
            <Icon d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" className="h-4 w-4" />
          </Link>
        </div>

        <Card
          className="lg:col-span-2"
          title="Dons — 14 jours"
          action={<span className="text-xs font-bold text-ink-400">{periodCount} envoi{periodCount > 1 ? 's' : ''}</span>}
        >
          {periodCount === 0 ? (
            <p className="py-10 text-center text-sm text-ink-400">Aucun don sur la période.</p>
          ) : (
            <AreaChart series={series14} valueKey="total" color="#0f3a88" />
          )}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Messages — 14 jours">
          <BarChart series={msgSeries} valueKey="n" color="#fc7a03" />
        </Card>

        <Card title="Statut des dons">
          {statusSlices.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-400">Aucun don enregistré.</p>
          ) : (
            <div className="flex items-center gap-4">
              <Donut slices={statusSlices} />
              <ul className="min-w-0 flex-1 space-y-2">
                {statusSlices.map((s) => (
                  <li key={s.key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 font-semibold text-ink-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      {s.label}
                    </span>
                    <span className="font-extrabold text-ink-900">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Modes de paiement" action={<span className="text-[11px] font-bold text-ink-400">Confirmés</span>}>
          {methods.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-400">Pas encore de don confirmé.</p>
          ) : (
            <ul className="space-y-2.5">
              {methods.map((m) => (
                <li key={m.method}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-700">{METHOD_LABELS[m.method] || m.method}</span>
                    <span className="font-extrabold text-ink-900">{fmtMoney(m.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-50">
                    <div
                      className="h-full rounded-full bg-brand-600"
                      style={{ width: `${Math.max(6, (Number(m.total) / maxMethod) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card
          title="Progression des collectes"
          action={
            <Link to="/admin/campagnes" className="text-xs font-bold text-brand-600 hover:underline">
              Gérer
            </Link>
          }
        >
          {(d.campaigns_progress || []).length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">Aucune campagne publiée.</p>
          ) : (
            <ul className="space-y-3">
              {(d.campaigns_progress || []).map((c) => {
                const pct = c.goal_amount > 0 ? Math.min(100, Math.round((c.collected_amount / c.goal_amount) * 100)) : 0;
                return (
                  <li key={c.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-bold text-ink-800">{c.title}</p>
                      <p className="shrink-0 text-[11px] font-extrabold text-brand-700">{pct}%</p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-50">
                      <div className="h-full rounded-full bg-accent-400" style={{ width: `${Math.max(2, pct)}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-ink-400">
                      {fmtMoney(c.collected_amount || 0)}
                      {c.goal_amount > 0 ? ` / ${fmtMoney(c.goal_amount)}` : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Articles par catégorie">
          {cats.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">Aucun article publié.</p>
          ) : (
            <ul className="space-y-2.5">
              {cats.map((c) => (
                <li key={c.category} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-xs font-bold text-ink-700">
                    {categoryLabel(c.category, site.article_categories)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-50">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.max(8, (Number(c.n) / maxCat) * 100)}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs font-extrabold text-ink-900">{c.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card
          title="Derniers dons"
          action={
            <Link to="/admin/dons" className="text-xs font-bold text-brand-600 hover:underline">
              Tout voir
            </Link>
          }
        >
          <ul className="divide-y divide-ink-50">
            {(d.latest_donations || []).slice(0, 5).map((don) => (
              <li key={don.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-900">{donorLabel(don)}</p>
                  <p className="truncate text-[11px] text-ink-400">{don.campaign_title || 'Cause générale'}</p>
                </div>
                <span className="shrink-0 font-display text-sm font-extrabold text-brand-600">{fmtMoney(don.amount)}</span>
              </li>
            ))}
            {(d.latest_donations || []).length === 0 && (
              <li className="py-6 text-center text-sm text-ink-400">Aucun don pour le moment.</li>
            )}
          </ul>
        </Card>

        <Card
          title="Derniers messages"
          action={
            <Link to="/admin/messages" className="text-xs font-bold text-brand-600 hover:underline">
              Tout voir
            </Link>
          }
        >
          <ul className="space-y-2">
            {(d.latest_messages || []).slice(0, 5).map((m) => (
              <li
                key={m.id}
                className={`rounded-xl px-3 py-2.5 ${m.read ? 'bg-[#f4f6fb]' : 'bg-accent-50 ring-1 ring-accent-200'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-bold text-ink-900">{m.name}</p>
                  <p className="shrink-0 text-[10px] font-semibold text-ink-400">{formatDay(m.created_at)}</p>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-ink-600 line-clamp-1">
                  {m.subject ? <span className="font-semibold text-ink-800">{m.subject} — </span> : null}
                  {m.message}
                </p>
              </li>
            ))}
            {(d.latest_messages || []).length === 0 && (
              <li className="py-6 text-center text-sm text-ink-400">Aucun message reçu.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
