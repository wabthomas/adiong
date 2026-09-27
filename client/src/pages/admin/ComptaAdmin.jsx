import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Field, Modal } from './AdminUI.jsx';

function Dialog({ title, onClose, wide, children }) {
  return <Dialog open title={title} onClose={onClose} wide={wide}>{children}</Dialog>;
}

const TABS = [
  { id: 'dash', group: 'Pilotage', label: 'Tableau de bord', hint: 'Trésorerie et activité du mois' },
  { id: 'exercises', group: 'Pilotage', label: 'Exercices', hint: 'Clôture SYCEBNL et report du résultat' },
  { id: 'journal', group: 'Saisie', label: 'Journal', hint: 'Écritures, annulations et recherche' },
  { id: 'plan', group: 'Saisie', label: 'Plan de comptes', hint: 'Comptes SYCEBNL (9 classes)' },
  { id: 'assets', group: 'Saisie', label: 'Immobilisations', hint: 'Acquisitions et dotations aux amortissements' },
  { id: 'in_kind', group: 'Saisie', label: 'Contributions en nature', hint: 'Apports reçus (971) et donnés (911)' },
  { id: 'balance', group: 'Analyse', label: 'Balance', hint: 'Totaux débits / crédits par compte' },
  { id: 'ledger', group: 'Analyse', label: 'Grand livre', hint: 'Mouvements d\u2019un compte' },
  { id: 'states', group: 'Analyse', label: 'États financiers', hint: 'Bilan et compte de résultat' }
];

const JOURNALS = { O: 'Ouverture', ACH: 'Achats', VEN: 'Ventes & ressources', CAI: 'Caisse', BQ: 'Banque', OD: 'Opérations diverses' };
const NATURES = { asset: 'Actif', liability: 'Passif', equity: 'Capitaux propres', expense: 'Charge', income: 'Produit' };
const SOURCES = {
  manual: { label: 'Manuelle', cls: 'bg-ink-50 text-ink-500' },
  donation: { label: 'Don', cls: 'bg-emerald-50 text-emerald-700' },
  pos_sale: { label: 'Vente POS', cls: 'bg-brand-50 text-brand-700' },
  payroll: { label: 'Paie', cls: 'bg-violet-50 text-violet-700' },
  reverse: { label: 'Annulation', cls: 'bg-red-50 text-red-600' },
  asset: { label: 'Immobilisation', cls: 'bg-cyan-50 text-cyan-700' },
  depreciation: { label: 'Amortissement', cls: 'bg-indigo-50 text-indigo-700' },
  in_kind: { label: 'En nature', cls: 'bg-teal-50 text-teal-700' },
  cloture: { label: 'Clôture', cls: 'bg-amber-50 text-amber-700' },
  cloture2: { label: 'Report résultat', cls: 'bg-amber-50 text-amber-700' }
};

const CLASSES = {
  1: 'Ressources durables', 2: 'Immobilisations', 3: 'Stocks', 4: 'Tiers',
  5: 'Trésorerie', 6: 'Charges', 7: 'Ressources', 8: 'Hors activités ordinaires', 9: 'Contributions en nature'
};

const downloadCsv = (filename, header, rows) => {
  const esc = (v) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[;"\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

const fmt = (n) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0).replace(/[\u202f\u00a0\u2009]/g, ' ');
const today = () => new Date().toISOString().slice(0, 10);
const month1 = () => new Date().toISOString().slice(0, 7) + '-01';

export default function ComptaAdmin() {
  const [tab, setTab] = useState('dash');
  const [blocked, setBlocked] = useState('');
  const [overview, setOverview] = useState(null);

  const refresh = useCallback(() => {
    api.compta.overview().then(setOverview).catch((e) => {
      if (e.status === 403) setBlocked(e.message || 'Module comptabilité désactivé ou accès refusé');
    });
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  if (blocked) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-ink-950/5">
        <p className="text-lg font-bold text-ink-900">Comptabilité indisponible</p>
        <p className="mt-2 text-sm text-ink-400">{blocked}</p>
        <p className="mt-1 text-xs text-ink-400">Le super admin peut activer le module dans Paramètres → Modules, et attribuer la zone « Comptabilité (SYCEBNL) » dans la matrice des droits.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 rounded-2xl bg-white p-1.5 ring-1 ring-ink-950/5">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} title={t.hint}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${tab === t.id ? 'bg-brand-600 text-white' : 'text-ink-500 hover:bg-ink-50'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'dash' && <DashTab overview={overview} refresh={refresh} goTo={setTab} />}
      {tab === 'exercises' && <ExercisesTab />}
      {tab === 'journal' && <JournalTab refresh={refresh} />}
      {tab === 'plan' && <PlanTab />}
      {tab === 'assets' && <AssetsTab refresh={refresh} />}
      {tab === 'in_kind' && <InKindTab refresh={refresh} />}
      {tab === 'balance' && <BalanceTab />}
      {tab === 'ledger' && <LedgerTab />}
      {tab === 'states' && <StatesTab />}
    </div>
  );
}

function Section({ title, desc, action, children, padded = true }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink-950/5">
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-6 py-4">
          <div className="min-w-0">
            {title && <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>}
            {desc && <p className="mt-0.5 text-sm text-ink-400">{desc}</p>}
          </div>
          {action}
        </div>
      )}
      {padded ? <div className="p-6">{children}</div> : children}
    </section>
  );
}

function StatCard({ label, value, sub, tone = 'brand' }) {
  const tones = { brand: 'bg-brand-50 text-brand-700', accent: 'bg-accent-50 text-accent-800', ink: 'bg-ink-50 text-ink-600', good: 'bg-emerald-50 text-emerald-700', warn: 'bg-amber-50 text-amber-800', danger: 'bg-red-50 text-red-700' };
  return (
    <div className={`rounded-2xl p-5 ring-1 ${tones[tone] || tones.brand}`}>
      <p className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-70">{sub}</p>}
    </div>
  );
}

function SourceBadge({ source }) {
  const s = SOURCES[source] || SOURCES.manual;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>{s.label}</span>;
}

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function TrendChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(1, ...data.flatMap((d) => [d.ressources, d.charges]));
  const W = 760, H = 230, padL = 52, padB = 26, padT = 14, padR = 8;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const bw = plotW / data.length;
  const y = (v) => padT + plotH * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => max * t);
  const fmtShort = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10} k` : String(Math.round(v)));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Ressources et charges sur 12 mois">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e7e5e4" strokeWidth="1" strokeDasharray={t === 0 ? '' : '3 4'} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#a8a29e">{fmtShort(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x0 = padL + i * bw + bw * 0.18;
          const w = bw * 0.28;
          const rH = Math.max(d.ressources > 0 ? 2 : 0, plotH * (d.ressources / max));
          const cH = Math.max(d.charges > 0 ? 2 : 0, plotH * (d.charges / max));
          const mm = Number(d.month.slice(5, 7));
          return (
            <g key={d.month}>
              <rect x={x0} y={y(d.ressources)} width={w} height={rH} rx="2" fill="#059669" opacity="0.85">
                <title>{`${d.month} — Ressources : ${fmt(d.ressources)} $`}</title>
              </rect>
              <rect x={x0 + w + 2} y={y(d.charges)} width={w} height={cH} rx="2" fill="#e11d48" opacity="0.8">
                <title>{`${d.month} — Charges : ${fmt(d.charges)} $`}</title>
              </rect>
              <text x={padL + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#78716c">
                {MONTHS_FR[mm - 1]}{d.month.slice(0, 4) === String(new Date().getFullYear()) ? '' : ` ${d.month.slice(2, 4)}`}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center gap-4 text-xs text-ink-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600/85" /> Ressources (classes 7)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-600/80" /> Charges (classes 6, 8, 9)</span>
      </div>
    </div>
  );
}

// ---------- Tableau de bord ----------
function DashTab({ overview, refresh, goTo }) {
  const [recent, setRecent] = useState([]);
  const [trend, setTrend] = useState(null);
  useEffect(() => {
    api.compta.entries.list({}).then(setRecent).catch(() => {});
    api.compta.trend(12).then(setTrend).catch(() => {});
  }, []);
  if (!overview) return <p className="text-sm text-ink-400">Chargement…</p>;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Trésorerie totale" value={`${fmt(overview.treasury)} $`} sub="Caisse, banques et Mobile Money (classe 5)" tone="brand" />
        <StatCard label={`Ressources ${overview.month}`} value={`${fmt(overview.resources)} $`} sub="Dons, subventions, cotisations, activités" tone="good" />
        <StatCard label={`Charges ${overview.month}`} value={`${fmt(overview.charges)} $`} sub="Par nature (classes 6, 8, 9)" tone={overview.charges > overview.resources ? 'danger' : 'ink'} />
        <StatCard label="Résultat du mois" value={`${fmt(overview.surplus)} $`} sub={overview.surplus >= 0 ? 'Surplus' : 'Déficit'} tone={overview.surplus >= 0 ? 'accent' : 'danger'} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Ressources de l\u2019exercice ${overview.exercise.start_date.slice(0, 4)}`} value={`${fmt(overview.year_ressources)} $`} sub="Cumul de l\u2019exercice en cours" tone="good" />
        <StatCard label={`Charges de l\u2019exercice ${overview.exercise.start_date.slice(0, 4)}`} value={`${fmt(overview.year_charges)} $`} sub="Cumul de l\u2019exercice en cours" tone={overview.year_charges > overview.year_ressources ? 'danger' : 'ink'} />
        <StatCard label="Résultat de l\u2019exercice" value={`${fmt(overview.year_result)} $`} sub={overview.year_result >= 0 ? 'Surplus en cours' : 'Déficit en cours'} tone={overview.year_result >= 0 ? 'accent' : 'danger'} />
        <StatCard label="Surplus reporté (171)" value={`${fmt(overview.reported_surplus)} $`} sub="Résultats antérieurs reportés à la clôture" tone="brand" />
      </div>
      <Section title="Ressources et charges — 12 derniers mois" desc="Vue mensuelle de l\u2019activité (comptes de nature « ressources » et « charges »).">
        {trend ? <TrendChart data={trend} /> : <p className="text-sm text-ink-400">Chargement…</p>}
      </Section>
      <Section title="Dernières écritures" desc="Les dons confirmés, les ventes POS et les paies envoyées génèrent automatiquement leurs écritures."
        action={<button onClick={refresh} className="rounded-xl px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">Actualiser</button>}>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-400">Aucune écriture pour le moment. Créez la première dans le Journal, ou confirmez un don.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-bold uppercase tracking-wider text-ink-400">
                <th className="py-2 pr-3">Réf.</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Libellé</th><th className="py-2 pr-3">Source</th><th className="py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {recent.slice(0, 8).map((e) => (
                <tr key={e.id} className="border-b border-ink-50 last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs text-ink-500">{e.ref}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{e.date}</td>
                  <td className="py-2 pr-3 text-ink-900">{e.label || <span className="text-ink-300">—</span>}</td>
                  <td className="py-2 pr-3"><SourceBadge source={e.source} /></td>
                  <td className="py-2 text-right font-semibold tabular-nums">{fmt(e.total)} $</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4">
          <button onClick={() => goTo('journal')} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">+ Nouvelle écriture</button>
        </div>
      </Section>
      <Section title="Conformité SYCEBNL" desc="Rappel du référentiel appliqué à la comptabilité d\u2019ADI.">
        <div className="grid gap-4 text-sm text-ink-600 sm:grid-cols-3">
          <div className="rounded-xl bg-ink-50/60 p-4">
            <p className="font-bold text-ink-900">Système normal</p>
            <p className="mt-1">Comptabilité d\u2019engagement en partie double. Exercice ouvert au 1er janvier 2026 (bilan d\u2019ouverture à zéro).</p>
          </div>
          <div className="rounded-xl bg-ink-50/60 p-4">
            <p className="font-bold text-ink-900">Plan à 9 classes</p>
            <p className="mt-1">1 Ressources durables · 2 Actif immobilisé · 3 Stocks · 4 Tiers · 5 Trésorerie · 6 Charges · 7 Ressources · 8 Hors activités ordinaires · 9 Contributions en nature.</p>
          </div>
          <div className="rounded-xl bg-ink-50/60 p-4">
            <p className="font-bold text-ink-900">Vocabulaire OSC</p>
            <p className="mt-1">Surplus / déficit (pas bénéfice-perte), membres (pas clients), ressources de l\u2019exercice. États : bilan, compte de résultat, exports CSV et PDF.</p>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ---------- Exercices (clôture SYCEBNL) ----------
function ExercisesTab() {
  const [exs, setExs] = useState(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.compta.exercises().then(setExs).catch((e) => setError(e.message || 'Erreur'));
  useEffect(() => { load(); }, []);
  const doClose = async () => {
    setBusy(true);
    setError('');
    try {
      await api.compta.closeExercise(confirm.id);
      setConfirm(null);
      load();
    } catch (e) {
      setError(e.message || 'Clôture impossible');
      setConfirm(null);
    }
    setBusy(false);
  };
  if (!exs) return <p className="text-sm text-ink-400">Chargement…</p>;
  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
      <Section title="Clôture d'exercice" desc="Clôturer l'exercice : ① génère les dotations aux amortissements manquantes de l'exercice (651 → 281/283), ② éteint les soldes des comptes de charges (6xx) et de ressources (7xx), ③ reporte le résultat au surplus reporté (171) via les comptes de transit 178/168, ④ verrouille définitivement l'exercice (plus aucune écriture datée de la période) et ouvre l'exercice suivant.">
        <div className="space-y-3">
          {exs.map((ex) => (
            <div key={ex.id} className={`flex flex-wrap items-center gap-4 rounded-xl border p-4 ${ex.status === 'ouvert' ? 'border-brand-200 bg-brand-50/40' : 'border-ink-100 bg-ink-50/50'}`}>
              <div className="min-w-[11rem]">
                <p className="text-sm font-bold text-ink-900">{ex.start_date} → {ex.end_date}</p>
                <p className="text-xs text-ink-400">{ex.status === 'cloture' ? `Clôturé le ${String(ex.closed_at).slice(0, 10)} par ${ex.closed_by}` : 'Exercice ouvert en cours'}</p>
              </div>
              <div className="grid flex-1 grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wider text-ink-400">Charges</p>
                  <p className="font-semibold tabular-nums">{fmt(ex.total_charges)} $</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-ink-400">Ressources</p>
                  <p className="font-semibold tabular-nums">{fmt(ex.total_ressources)} $</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-ink-400">Résultat</p>
                  <p className={`font-bold tabular-nums ${ex.resultat_calcule >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {fmt(Math.abs(ex.status === 'cloture' ? ex.result : ex.resultat_calcule))} $ {ex.resultat_calcule >= 0 ? '(surplus)' : '(déficit)'}
                  </p>
                </div>
              </div>
              {ex.status === 'ouvert' ? (
                <button onClick={() => setConfirm(ex)} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700">Clôturer l'exercice</button>
              ) : (
                <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-bold text-ink-500">Verrouillé</span>
              )}
            </div>
          ))}
        </div>
      </Section>
      {confirm && (
        <Dialog title="Confirmer la clôture d'exercice" onClose={() => { if (!busy) setConfirm(null); }}>
          <p className="text-sm leading-relaxed text-ink-600">
            L'exercice <b>{confirm.start_date} → {confirm.end_date}</b> sera clôturé avec un <b>{confirm.resultat_calcule >= 0 ? 'surplus' : 'déficit'}</b> de <b>{fmt(Math.abs(confirm.resultat_calcule))} $</b>.
            Les écritures de clôture sont générées automatiquement (report au surplus reporté, compte 171), puis l'exercice est <b>verrouillé</b> : plus aucune écriture ne pourra être datée de cette période.
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setConfirm(null)} disabled={busy} className="rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50">Annuler</button>
            <button onClick={doClose} disabled={busy} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700">{busy ? "Clôture en cours…" : "Clôturer l'exercice"}</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ---------- Journal ----------
const JOURNAL_PER_PAGE = 20;

function JournalTab({ refresh }) {
  const [entries, setEntries] = useState([]);
  const [q, setQ] = useState('');
  const [journal, setJournal] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.compta.entries.list({ q, journal, from, to }).then(setEntries).catch((e) => setError(e.message || 'Erreur'));
  }, [q, journal, from, to]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, journal, from, to]);

  const totalPages = Math.max(1, Math.ceil(entries.length / JOURNAL_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = entries.slice((safePage - 1) * JOURNAL_PER_PAGE, safePage * JOURNAL_PER_PAGE);

  const exportCsv = () => {
    if (entries.length === 0) return;
    const label = (e) => (SOURCES[e.source] || SOURCES.manual).label;
    downloadCsv(`journal-${today()}.csv`,
      ['Réf.', 'Date', 'Journal', 'Libellé', 'Source', 'Montant (USD)'],
      entries.map((e) => [e.ref, e.date, e.journal_code, e.label || '', label(e), e.total.toFixed(2)]));
  };
  const exportPdf = () => {
    if (entries.length === 0) return;
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (journal) p.set('journal', journal);
    if (q) p.set('q', q);
    p.set('format', 'pdf');
    api.compta.statements.download(`/api/admin/compta/entries?${p.toString()}`, `journal-${today()}.pdf`).catch((e) => setError(e.message || 'Export impossible'));
  };

  const openDetail = (id) => api.compta.entries.get(id).then(setDetail).catch(() => {});
  const reverse = async (e) => {
    if (!window.confirm(`Annuler l\u2019écriture ${e.ref} ? Une écriture de contre-sens sera créée (l\u2019origine est conservée).`)) return;
    setBusy(true); setError('');
    try {
      await api.compta.entries.reverse(e.id);
      setDetail(null);
      load(); refresh();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const remove = async (e) => {
    if (!window.confirm(`Supprimer définitivement l\u2019écriture manuelle ${e.ref} ?`)) return;
    setBusy(true); setError('');
    try {
      await api.compta.entries.remove(e.id);
      setDetail(null);
      load(); refresh();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      <Section title="Écritures" desc={`${entries.length} écriture(s) — les automatiques (dons, POS, paie) s’annulent sans s’effacer.`}
        action={
          <div className="flex gap-2">
            <button onClick={exportCsv} disabled={entries.length === 0} className="rounded-xl px-3 py-2 text-sm font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-40">Export CSV</button>
            <button onClick={exportPdf} disabled={entries.length === 0} className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-40">Export PDF</button>
            <button onClick={() => { setShowNew(true); setError(''); }} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">
              + Nouvelle écriture
            </button>
          </div>
        }>
        <div className="mb-4 flex flex-wrap gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (réf., libellé)…" className="w-56 rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500" />
          <select value={journal} onChange={(e) => setJournal(e.target.value)} className="rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500">
            <option value="">Tous les journaux</option>
            {Object.entries(JOURNALS).map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200" />
          <span className="self-center text-xs text-ink-400">au</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200" />
        </div>
        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">Aucune écriture ne correspond aux filtres.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-bold uppercase tracking-wider text-ink-400">
                <th className="py-2 pr-3">Réf.</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Journal</th><th className="py-2 pr-3">Libellé</th><th className="py-2 pr-3">Source</th><th className="py-2 text-right">Montant</th><th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((e) => (
                <tr key={e.id} className="cursor-pointer border-b border-ink-50 hover:bg-brand-50/40 last:border-0" onClick={() => openDetail(e.id)}>
                  <td className="py-2.5 pr-3 font-mono text-xs text-ink-500">{e.ref}</td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">{e.date}</td>
                  <td className="py-2.5 pr-3"><span className="rounded-md bg-ink-50 px-1.5 py-0.5 text-xs font-bold text-ink-500">{e.journal_code}</span></td>
                  <td className="py-2.5 pr-3 text-ink-900">{e.label || <span className="text-ink-300">—</span>}</td>
                  <td className="py-2.5 pr-3"><SourceBadge source={e.source} /></td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">{fmt(e.total)} $</td>
                  <td className="py-2.5 text-right text-xs font-bold text-brand-700">Détail</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-xs text-ink-400">
              Page {safePage} sur {totalPages} — {entries.length} écriture(s)
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage(1)} disabled={safePage === 1} className="rounded-lg px-2.5 py-1 font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-30">«</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="rounded-lg px-3 py-1 font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-30">Précédent</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="rounded-lg px-3 py-1 font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-30">Suivant</button>
              <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="rounded-lg px-2.5 py-1 font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-30">»</button>
            </div>
          </div>
        )}
      </Section>

      {detail && (
        <Dialog title={`Écriture ${detail.ref}`} onClose={() => setDetail(null)}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-md bg-ink-50 px-2 py-1 font-mono text-xs font-bold">{detail.date}</span>
              <span className="rounded-md bg-ink-50 px-2 py-1 text-xs font-bold">{JOURNALS[detail.journal_code] || detail.journal_code}</span>
              <SourceBadge source={detail.source} />
              {detail.is_reversal_of > 0 && <span className="text-xs text-ink-400">annule une écriture antérieure</span>}
            </div>
            {detail.label && <p className="text-sm font-semibold text-ink-900">{detail.label}</p>}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-bold uppercase tracking-wider text-ink-400">
                  <th className="py-2 pr-2">Compte</th><th className="py-2 pr-2">Libellé</th><th className="py-2 pr-2 text-right">Débit</th><th className="py-2 text-right">Crédit</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((l) => (
                  <tr key={l.id} className="border-b border-ink-50 last:border-0">
                    <td className="py-2 pr-2 font-mono text-xs font-bold text-ink-700">{l.account_code}</td>
                    <td className="py-2 pr-2 text-ink-500">{l.label || '—'}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{l.debit ? `${fmt(l.debit)}` : ''}</td>
                    <td className="py-2 text-right tabular-nums">{l.credit ? `${fmt(l.credit)}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-400">Total</span>
              <span className="font-display text-lg font-extrabold text-ink-900">{fmt(detail.lines.reduce((s, l) => s + l.debit, 0))} $</span>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {detail.source === 'manual' && (
                <button disabled={busy} onClick={() => remove(detail)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">Supprimer</button>
              )}
              <button disabled={busy} onClick={() => reverse(detail)} className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-bold text-white hover:bg-ink-700 disabled:opacity-50">
                Annuler (contre-sens)
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {showNew && (
        <NewEntryModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); refresh(); }} />
      )}
    </div>
  );
}

function NewEntryModal({ onClose, onCreated }) {
  const [date, setDate] = useState(today());
  const [journal, setJournal] = useState('OD');
  const [label, setLabel] = useState('');
  const [lines, setLines] = useState([
    { account_code: '', label: '', debit: '', credit: '' },
    { account_code: '', label: '', debit: '', credit: '' }
  ]);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.compta.accounts.list().then(setAccounts).catch(() => {}); }, []);

  const setLine = (i, k, v) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await api.compta.entries.create({ date, journal, label, lines: lines.map((l) => ({ account_code: l.account_code, label: l.label, debit: l.debit, credit: l.credit })) });
      onCreated();
    } catch (e) {
      setError(e.message || 'Erreur');
    }
    setBusy(false);
  };

  return (
    <Dialog title="Nouvelle écriture" onClose={onClose} wide>
      <div className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date"><input type="date" min="2026-01-01" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500" /></Field>
          <Field label="Journal">
            <select value={journal} onChange={(e) => setJournal(e.target.value)} className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200">
              {Object.entries(JOURNALS).map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
            </select>
          </Field>
          <Field label="Libellé"><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Achat de fournitures" className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500" /></Field>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Lignes (partie double : total débits = total crédits)</p>
          {lines.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-ink-50/60 p-3 sm:grid-cols-[110px_1fr_110px_110px_32px]">
              <select value={l.account_code} onChange={(e) => setLine(i, 'account_code', e.target.value)} className="rounded-lg border-0 bg-white px-2 py-1.5 text-sm ring-1 ring-ink-200">
                <option value="">Compte…</option>
                {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name.slice(0, 28)}</option>)}
              </select>
              <input value={l.label} onChange={(e) => setLine(i, 'label', e.target.value)} placeholder="Libellé de la ligne (facultatif)" className="rounded-lg border-0 bg-white px-2 py-1.5 text-sm ring-1 ring-ink-200" />
              <input type="number" min="0" step="0.01" value={l.debit} onChange={(e) => setLine(i, 'debit', e.target.value)} placeholder="Débit" className="rounded-lg border-0 bg-white px-2 py-1.5 text-right text-sm tabular-nums ring-1 ring-ink-200" />
              <input type="number" min="0" step="0.01" value={l.credit} onChange={(e) => setLine(i, 'credit', e.target.value)} placeholder="Crédit" className="rounded-lg border-0 bg-white px-2 py-1.5 text-right text-sm tabular-nums ring-1 ring-ink-200" />
              <button onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="grid place-items-center rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-600" title="Retirer la ligne">✕</button>
            </div>
          ))}
          <button onClick={() => setLines((ls) => [...ls, { account_code: '', label: '', debit: '', credit: '' }])} className="text-sm font-bold text-brand-700 hover:underline">+ Ajouter une ligne</button>
        </div>
        <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${balanced ? 'bg-emerald-50' : 'bg-amber-50'}`}>
          <span className={`text-sm font-bold ${balanced ? 'text-emerald-700' : 'text-amber-800'}`}>
            {totalDebit > 0 || totalCredit > 0 ? (balanced ? 'Écriture équilibrée ✓' : 'Écriture déséquilibrée — le total des débits doit égaler celui des crédits') : 'Renseignez au moins deux lignes à montant non nul'}
          </span>
          <span className="text-sm font-semibold tabular-nums text-ink-600">{fmt(totalDebit)} $ · {fmt(totalCredit)} $</span>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-bold text-ink-500 hover:bg-ink-50">Annuler</button>
          <button disabled={busy || !balanced} onClick={submit} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">Valider l\u2019écriture</button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------- Plan de comptes ----------
function PlanTab() {
  const [accounts, setAccounts] = useState([]);
  const [q, setQ] = useState('');
  const [cls, setCls] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => { api.compta.accounts.list(q).then(setAccounts).catch((e) => setError(e.message || '')); }, [q]);
  useEffect(() => { load(); }, [load]);
  const shown = cls ? accounts.filter((a) => String(a.class) === String(cls)) : accounts;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      <Section title="Plan de comptes SYCEBNL" desc="74 comptes de base pré-remplis (9 classes) — vous pouvez ajouter les vôtres ou renommer."
        action={<button onClick={() => { setShowNew(true); setError(''); }} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">+ Nouveau compte</button>}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher par code ou nom…" className="w-64 rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500" />
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setCls('')} className={`rounded-full px-3 py-1 text-xs font-bold ${cls === '' ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'}`}>Toutes ({accounts.length})</button>
            {Object.keys(CLASSES).map((c) => (
              <button key={c} onClick={() => setCls(cls === String(c) ? '' : String(c))} title={CLASSES[c]}
                className={`rounded-full px-3 py-1 text-xs font-bold ${cls === String(c) ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'}`}>
                {c} · {CLASSES[c]}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-bold uppercase tracking-wider text-ink-400">
                <th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Intitulé</th><th className="py-2 pr-3">Nature</th><th className="py-2 pr-3">Classe</th><th className="py-2 pr-3">Statut</th><th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-ink-400">Aucun compte ne correspond à cette recherche ou à cette classe.</td></tr>
              )}
              {shown.map((a) => (
                <tr key={a.id} className={`border-b border-ink-50 last:border-0 ${!a.active ? 'opacity-40' : ''}`}>
                  <td className="py-2 pr-3 font-mono text-xs font-bold text-ink-700">{a.code}</td>
                  <td className="py-2 pr-3 text-ink-900">{a.name}</td>
                  <td className="py-2 pr-3 text-xs text-ink-500">{NATURES[a.nature] || a.nature}</td>
                  <td className="py-2 pr-3 text-xs text-ink-500">{a.class}</td>
                  <td className="py-2 pr-3 text-xs font-bold">{a.active ? <span className="text-emerald-600">actif</span> : <span className="text-ink-400">désactivé</span>}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => { setEdit(a); setError(''); }} className="text-xs font-bold text-brand-700 hover:underline">Modifier</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {showNew && <AccountModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
      {edit && (
        <AccountModal account={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />
      )}
    </div>
  );
}

function AccountModal({ account, onClose, onSaved }) {
  const [code, setCode] = useState(account?.code || '');
  const [name, setName] = useState(account?.name || '');
  const [nature, setNature] = useState(account?.nature || 'expense');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (account) await api.compta.accounts.update(account.id, { name, nature });
      else await api.compta.accounts.create({ code, name, nature });
      onSaved();
    } catch (e) { setError(e.message || 'Erreur'); }
    setBusy(false);
  };

  return (
    <Dialog title={account ? `Compte ${account.code}` : 'Nouveau compte'} onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        {!account && (
          <Field label="Code (2 à 5 chiffres, ex. 5165)">
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="5165" className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 font-mono text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500" />
          </Field>
        )}
        <Field label="Intitulé">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Mobile Money — Tigo" className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500" />
        </Field>
        <Field label="Nature (place sur les états)">
          <select value={nature} onChange={(e) => setNature(e.target.value)} className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200">
            {Object.entries(NATURES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-bold text-ink-500 hover:bg-ink-50">Annuler</button>
          <button disabled={busy} onClick={submit} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">{account ? 'Enregistrer' : 'Créer le compte'}</button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------- Immobilisations & amortissements ----------
function AssetsTab({ refresh }) {
  const [assets, setAssets] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    api.compta.assets.list().then(setAssets).catch((e) => setError(e.message || 'Erreur'));
  }, []);
  useEffect(() => {
    load();
    api.compta.accounts.list().then(setAccounts).catch(() => {});
  }, [load]);

  const totalAcq = (assets || []).reduce((s, a) => s + a.amount, 0);
  const totalProv = (assets || []).reduce((s, a) => s + a.accumulated, 0);
  const totalNet = (assets || []).reduce((s, a) => s + a.net, 0);
  const year = new Date().toISOString().slice(0, 4);

  const depreciate = async () => {
    if (!window.confirm(`Générer les dotations aux amortissements de l\u2019exercice ${year} pour tous les actifs en service ?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await api.compta.assets.depreciate(year);
      setNotice(r.created > 0 ? `${r.created} dotation(s) au(x) exercice ${r.year} générée(s) (compte 651 → 281/283).` : 'Aucune nouvelle dotation — les actifs sont déjà dotés pour cet exercice.');
      load(); refresh();
    } catch (e) { setError(e.message || 'Échec'); }
    setBusy(false);
  };

  const setStatus = async (a, status) => {
    setBusy(true); setError('');
    try {
      await api.compta.assets.update(a.id, { status });
      setDetail(null);
      load();
    } catch (e) { setError(e.message || 'Échec'); }
    setBusy(false);
  };

  const remove = async (a) => {
    if (!window.confirm(`Supprimer « ${a.label} » ? L\u2019écriture d\u2019acquisition et les dotations liées seront aussi supprimées.`)) return;
    setBusy(true); setError('');
    try {
      await api.compta.assets.remove(a.id);
      setDetail(null);
      load(); refresh();
    } catch (e) { setError(e.message || 'Échec'); }
    setBusy(false);
  };

  const statusBadge = (a) => {
    if (a.status === 'cede') return <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-500">Cédé le {a.ceded_at}</span>;
    if (a.fully_depreciated) return <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">Entièrement amorti</span>;
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">En service</span>;
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {notice && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}
      {!assets ? <p className="text-sm text-ink-400">Chargement…</p> : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Valeur brute" value={`${fmt(totalAcq)} $`} sub={`${assets.length} actif(s) immobilisé(s) (classe 2)`} tone="brand" />
            <StatCard label="Amortissements cumulés" value={`${fmt(totalProv)} $`} sub="Comptes 281 / 283" tone="ink" />
            <StatCard label="Valeur nette comptable" value={`${fmt(totalNet)} $`} sub="Brut − amortissements" tone={totalNet > 0 ? 'good' : 'danger'} />
          </div>
          <Section title="Registre des immobilisations" desc="Chaque acquisition génère une écriture (compte 2xx débiteur / trésorerie créditeur). Les dotations aux amortissements (lignes droites, 651 → 281/283) sont générées ici, puis automatiquement à la clôture de l\u2019exercice."
            action={
              <div className="flex gap-2">
                <button onClick={depreciate} disabled={busy || assets.length === 0} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">Dotations {year}</button>
                <button onClick={() => { setShowNew(true); setError(''); setNotice(''); }} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">+ Nouvelle acquisition</button>
              </div>
            }>
            {assets.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-ink-500">Aucune immobilisation enregistrée.</p>
                <p className="mt-1 text-xs text-ink-400">Matériel informatique, véhicules, mobilier, installations… sont des immobilisations (classe 2) : saisissez la première acquisition ci-dessus.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs font-bold uppercase tracking-wider text-ink-400">
                      <th className="py-2 pr-3">Actif</th><th className="py-2 pr-3">Acquis le</th><th className="py-2 pr-3">Durée</th>
                      <th className="py-2 pr-3 text-right">Valeur brute</th><th className="py-2 pr-3 text-right">Amort. cumulés</th><th className="py-2 pr-3 text-right">Valeur nette</th>
                      <th className="py-2 pr-3">Statut</th><th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a) => (
                      <tr key={a.id} className="cursor-pointer border-b border-ink-50 hover:bg-brand-50/40 last:border-0" onClick={() => setDetail(a)}>
                        <td className="py-2.5 pr-3">
                          <p className="font-semibold text-ink-900">{a.label}</p>
                          <p className="font-mono text-xs text-ink-400">{a.account_code} — {accounts.find((x) => x.code === a.account_code)?.name || 'compte 2xx'}</p>
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-ink-600">{a.acquired_at}</td>
                        <td className="py-2.5 pr-3 text-ink-600">{a.useful_life} an(s)</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{fmt(a.amount)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-indigo-700">{a.accumulated ? `− ${fmt(a.accumulated)}` : '—'}</td>
                        <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{fmt(a.net)}</td>
                        <td className="py-2.5 pr-3">{statusBadge(a)}</td>
                        <td className="py-2.5 text-right text-xs font-bold text-brand-700">Détail</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      {showNew && <NewAssetModal accounts={accounts} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); refresh(); }} />}
      {detail && (
        <Dialog title={detail.label} onClose={() => setDetail(null)}>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-ink-50/70 p-3"><p className="text-xs uppercase tracking-wider text-ink-400">Compte</p><p className="font-mono text-xs font-bold text-ink-700">{detail.account_code}</p></div>
              <div className="rounded-xl bg-ink-50/70 p-3"><p className="text-xs uppercase tracking-wider text-ink-400">Acquis le</p><p className="font-semibold">{detail.acquired_at}</p></div>
              <div className="rounded-xl bg-ink-50/70 p-3"><p className="text-xs uppercase tracking-wider text-ink-400">Valeur brute</p><p className="font-display text-lg font-extrabold">{fmt(detail.amount)} $</p></div>
              <div className="rounded-xl bg-ink-50/70 p-3"><p className="text-xs uppercase tracking-wider text-ink-400">Durée d\u2019utilité</p><p className="font-semibold">{detail.useful_life} an(s) — {fmt(Math.round(detail.amount / detail.useful_life * 100) / 100)} $/an</p></div>
              <div className="rounded-xl bg-indigo-50/70 p-3"><p className="text-xs uppercase tracking-wider text-indigo-400">Amort. cumulés</p><p className="font-display text-lg font-extrabold text-indigo-700">{fmt(detail.accumulated)} $</p></div>
              <div className="rounded-xl bg-emerald-50/70 p-3"><p className="text-xs uppercase tracking-wider text-emerald-500">Valeur nette</p><p className="font-display text-lg font-extrabold text-emerald-700">{fmt(detail.net)} $</p></div>
            </div>
            {statusBadge(detail)}
            <div className="flex flex-wrap justify-end gap-2">
              {detail.status === 'en_service' ? (
                <button disabled={busy} onClick={() => setStatus(detail, 'cede')} className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-bold text-white hover:bg-ink-700 disabled:opacity-50">Marquer comme cédé</button>
              ) : (
                <button disabled={busy} onClick={() => setStatus(detail, 'en_service')} className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-bold text-white hover:bg-ink-700 disabled:opacity-50">Remettre en service</button>
              )}
              <button disabled={busy} onClick={() => remove(detail)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">Supprimer</button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function NewAssetModal({ accounts, onClose, onSaved }) {
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('211');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [life, setLife] = useState(5);
  const [method, setMethod] = useState('virement');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const class2 = accounts.filter((a) => a.active && String(a.class) === '2' && !a.code.startsWith('28') && !a.code.startsWith('29'));
  const valid = label.trim() !== '' && Number(amount) > 0 && date !== '';

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await api.compta.assets.create({ label, account_code: code, amount: Number(amount), acquired_at: date, useful_life: life, payment_method: method });
      onSaved();
    } catch (e) { setError(e.message || 'Erreur'); }
    setBusy(false);
  };

  return (
    <Dialog title="Nouvelle immobilisation" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        <Field label="Libellé"><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Ordinateur portable — bureau projet" className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Compte d\u2019immobilisation (classe 2)">
            <select value={code} onChange={(e) => setCode(e.target.value)} className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200">
              {class2.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
            </select>
          </Field>
          <Field label="Montant d\u2019acquisition (USD)"><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1500.00" className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-right text-sm tabular-nums ring-1 ring-ink-200" /></Field>
          <Field label="Date d\u2019acquisition"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200" /></Field>
          <Field label="Durée d\u2019utilité (années)"><input type="number" min="1" max="50" value={life} onChange={(e) => setLife(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200" /></Field>
        </div>
        <Field label="Mode de règlement (trésorerie)">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200">
            <option value="virement">Virement bancaire (511)</option>
            <option value="caisse">Caisse (531)</option>
            <option value="mobile_money">Mobile Money (516)</option>
          </select>
        </Field>
        <p className="text-xs text-ink-400">Écriture générée : {code} débit {amount || '…'} / trésorerie crédit — puis dotation annuelle de {amount && Number(amount) > 0 ? `${fmt(Math.round((Number(amount) / life) * 100) / 100)} $` : '…'} (651 → {code === '243' ? '283' : '281'}) jusqu\u2019à amortissement complet.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-bold text-ink-500 hover:bg-ink-50">Annuler</button>
          <button disabled={busy || !valid} onClick={submit} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">Enregistrer l\u2019acquisition</button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------- Contributions en nature (classe 9) ----------
function InKindTab({ refresh }) {
  const [rows, setRows] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.compta.inKind.list().then(setRows).catch((e) => setError(e.message || 'Erreur'));
  }, []);
  useEffect(() => {
    load();
    api.compta.accounts.list().then(setAccounts).catch(() => {});
  }, [load]);

  const totalRecu = (rows || []).filter((r) => r.direction === 'recu').reduce((s, r) => s + r.amount, 0);
  const totalDonne = (rows || []).filter((r) => r.direction === 'donne').reduce((s, r) => s + r.amount, 0);

  const remove = async (r) => {
    if (!window.confirm(`Supprimer cette contribution en nature (${r.partner}) ? L\u2019écriture associée sera aussi supprimée.`)) return;
    setBusy(true); setError('');
    try {
      await api.compta.inKind.remove(r.id);
      load(); refresh();
    } catch (e) { setError(e.message || 'Échec'); }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {!rows ? <p className="text-sm text-ink-400">Chargement…</p> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Contributions reçues" value={`${fmt(totalRecu)} $`} sub="Apports volontaires en nature reçus (971)" tone="good" />
            <StatCard label="Contributions données" value={`${fmt(totalDonne)} $`} sub="Apports en nature consentis (911)" tone="warn" />
          </div>
          <Section title="Contributions en nature" desc="Nouveauté SYCEBNL (classe 9) : les apports volontaires de biens et services reçus (compte 971) et donnés (compte 911), valorisés au prix courant. Chaque saisie génère son écriture en partie double."
            action={<button onClick={() => { setShowNew(true); setError(''); }} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">+ Nouvelle contribution</button>}>
            {rows.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-ink-500">Aucune contribution en nature enregistrée.</p>
                <p className="mt-1 text-xs text-ink-400">Ex. : un fournisseur offre des fournitures (reçue, compte 6xx + 971), ou ADI remet des vivres à un partenaire (donnée, 911 + 3xx).</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs font-bold uppercase tracking-wider text-ink-400">
                      <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Sens</th><th className="py-2 pr-3">Partenaire</th><th className="py-2 pr-3">Description</th>
                      <th className="py-2 pr-3">Compte</th><th className="py-2 pr-3 text-right">Valorisation</th><th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-ink-50 last:border-0">
                        <td className="py-2.5 pr-3 whitespace-nowrap text-ink-600">{r.date}</td>
                        <td className="py-2.5 pr-3">
                          {r.direction === 'recu'
                            ? <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-700">Reçue (971)</span>
                            : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Donnée (911)</span>}
                        </td>
                        <td className="py-2.5 pr-3 font-semibold text-ink-900">{r.partner}</td>
                        <td className="py-2.5 pr-3 text-ink-600">{r.description || <span className="text-ink-300">—</span>}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs font-bold text-ink-700">{r.account_code}</td>
                        <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{fmt(r.amount)} $</td>
                        <td className="py-2.5 text-right">
                          <button disabled={busy} onClick={() => remove(r)} className="text-xs font-bold text-red-500 hover:underline">Supprimer</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
      {showNew && <NewInKindModal accounts={accounts} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); refresh(); }} />}
    </div>
  );
}

function NewInKindModal({ accounts, onClose, onSaved }) {
  const [date, setDate] = useState(today());
  const [direction, setDirection] = useState('recu');
  const [partner, setPartner] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const options = accounts.filter((a) => a.active && (direction === 'recu' ? [3, 6].includes(a.class) : a.class === 3));

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await api.compta.inKind.create({ date, direction, partner, description, amount: Number(amount), account_code: code });
      onSaved();
    } catch (e) { setError(e.message || 'Erreur'); }
    setBusy(false);
  };

  const valid = partner.trim() !== '' && Number(amount) > 0 && code !== '' && date !== '';

  return (
    <Dialog title="Nouvelle contribution en nature" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200" /></Field>
          <Field label="Sens de l\u2019apport">
            <select value={direction} onChange={(e) => { setDirection(e.target.value); setCode(''); }} className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200">
              <option value="recu">Reçue par ADI (971)</option>
              <option value="donne">Donnée par ADI (911)</option>
            </select>
          </Field>
        </div>
        <Field label={direction === 'recu' ? 'Donateur / fournisseur' : 'Bénéficiaire'}>
          <input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="Ex. Fondation Kivu" className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Compte concerné (${direction === 'recu' ? 'classe 3 ou 6' : 'classe 3'})`}>
            <select value={code} onChange={(e) => setCode(e.target.value)} className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200">
              <option value="">Choisir…</option>
              {options.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
            </select>
          </Field>
          <Field label="Valorisation (USD)"><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500.00" className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-right text-sm tabular-nums ring-1 ring-ink-200" /></Field>
        </div>
        <Field label="Description (facultatif)"><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex. 200 kits scolaires offerts" className="w-full rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200" /></Field>
        <p className="text-xs text-ink-400">
          {direction === 'recu'
            ? 'Écriture générée : compte concerné débiteur + 971 créditeur (ressource en nature).'
            : 'Écriture générée : 911 débiteur (charge en nature) + compte de stocks créditeur.'}
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-bold text-ink-500 hover:bg-ink-50">Annuler</button>
          <button disabled={busy || !valid} onClick={submit} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">Enregistrer</button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------- Balance ----------
function BalanceTab() {
  const [rows, setRows] = useState([]);
  const [from, setFrom] = useState(month1());
  const [to, setTo] = useState(today());
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.compta.balance({ from, to }).then(setRows).catch((e) => setError(e.message || ''));
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const totD = rows.reduce((s, r) => s + r.debit, 0);
  const totC = rows.reduce((s, r) => s + r.credit, 0);
  const exportCsv = () => {
    if (rows.length === 0) return;
    downloadCsv(`balance-${from}_${to}.csv`,
      ['Compte', 'Intitulé', 'Nature', 'Débit (USD)', 'Crédit (USD)', 'Solde D−C (USD)'],
      rows.map((r) => [r.code, r.name, NATURES[r.nature] || r.nature, r.debit.toFixed(2), r.credit.toFixed(2), r.balance.toFixed(2)]));
  };
  const exportPdf = () => {
    if (rows.length === 0) return;
    api.compta.statements.download(`/api/admin/compta/balance?from=${from}&to=${to}&format=pdf`, `balance-${from}_${to}.pdf`).catch((e) => setError(e.message || 'Export impossible'));
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      <Section title="Balance" desc="Totaux de débit et de crédit par compte sur la période."
        action={
          <div className="flex gap-2">
            <button onClick={exportCsv} disabled={rows.length === 0} className="rounded-xl px-3 py-2 text-sm font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-40">Export CSV</button>
            <button onClick={exportPdf} disabled={rows.length === 0} className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-40">Export PDF</button>
          </div>
        }>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200" />
          <span className="text-xs text-ink-400">au</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200" />
        </div>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">Aucun mouvement sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-bold uppercase tracking-wider text-ink-400">
                  <th className="py-2 pr-3">Compte</th><th className="py-2 pr-3">Intitulé</th><th className="py-2 pr-3">Nature</th>
                  <th className="py-2 pr-3 text-right">Débit</th><th className="py-2 pr-3 text-right">Crédit</th><th className="py-2 text-right">Solde (D−C)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className="border-b border-ink-50 last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs font-bold text-ink-700">{r.code}</td>
                    <td className="py-2 pr-3 text-ink-900">{r.name}</td>
                    <td className="py-2 pr-3 text-xs text-ink-500">{NATURES[r.nature] || r.nature}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.debit ? fmt(r.debit) : '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.credit ? fmt(r.credit) : '—'}</td>
                    <td className={`py-2 text-right font-semibold tabular-nums ${r.balance >= 0 ? 'text-ink-900' : 'text-red-600'}`}>{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-200 font-bold">
                  <td colSpan={3} className="py-2.5">Totaux</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmt(totD)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmt(totC)}</td>
                  <td className="py-2.5 text-right tabular-nums">{fmt(totD - totC)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

// ---------- Grand livre ----------
function LedgerTab() {
  const [accounts, setAccounts] = useState([]);
  const [account, setAccount] = useState('');
  const [from, setFrom] = useState(month1());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.compta.accounts.list().then(setAccounts).catch(() => {}); }, []);
  useEffect(() => {
    if (!account) { setRows([]); return; }
    api.compta.ledger({ account, from, to }).then((r) => { setRows(r); setLoaded(true); }).catch(() => {});
  }, [account, from, to]);

  const acc = accounts.find((a) => a.code === account);
  const exportCsv = () => {
    if (rows.length === 0) return;
    downloadCsv(`grand-livre-${account}-${from}_${to}.csv`,
      ['Date', 'Réf.', 'Journal', 'Libellé', 'Débit (USD)', 'Crédit (USD)', 'Cumul (USD)'],
      rows.map((r) => [r.date, r.ref, r.journal_code, r.line_label || r.label || '', (r.debit || 0).toFixed(2), (r.credit || 0).toFixed(2), r.cum.toFixed(2)]));
  };
  const exportPdf = () => {
    if (rows.length === 0) return;
    api.compta.statements.download(`/api/admin/compta/ledger?account=${account}&from=${from}&to=${to}&format=pdf`, `grand-livre-${account}-${from}_${to}.pdf`).catch((e) => setError(e.message || 'Export impossible'));
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      <Section title="Grand livre" desc="Mouvements successifs et soldes courants d’un compte."
        action={
          <div className="flex gap-2">
            <button onClick={exportCsv} disabled={rows.length === 0} className="rounded-xl px-3 py-2 text-sm font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-40">Export CSV</button>
            <button onClick={exportPdf} disabled={rows.length === 0} className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-40">Export PDF</button>
          </div>
        }>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select value={account} onChange={(e) => { setAccount(e.target.value); setLoaded(false); }} className="w-72 rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500">
            <option value="">Choisir un compte…</option>
            {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200" />
          <span className="text-xs text-ink-400">au</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200" />
        </div>
        {!account ? (
          <p className="py-8 text-center text-sm text-ink-400">Sélectionnez un compte pour afficher ses mouvements.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-bold uppercase tracking-wider text-ink-400">
                  <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Réf.</th><th className="py-2 pr-3">Journal</th><th className="py-2 pr-3">Libellé</th>
                  <th className="py-2 pr-3 text-right">Débit</th><th className="py-2 pr-3 text-right">Crédit</th><th className="py-2 text-right">Cumul</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-ink-50 last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{r.date}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-ink-500">{r.ref}</td>
                    <td className="py-2 pr-3"><span className="rounded-md bg-ink-50 px-1.5 py-0.5 text-xs font-bold text-ink-500">{r.journal_code}</span></td>
                    <td className="py-2 pr-3 text-ink-900">{r.line_label || r.label}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.debit ? fmt(r.debit) : '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.credit ? fmt(r.credit) : '—'}</td>
                    <td className={`py-2 text-right font-semibold tabular-nums ${r.cum >= 0 ? 'text-ink-900' : 'text-red-600'}`}>{fmt(r.cum)}</td>
                  </tr>
                ))}
                {loaded && rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-sm text-ink-400">Aucun mouvement sur la période.</td></tr>}
              </tbody>
            </table>
            {acc && <p className="mt-3 text-xs text-ink-400">{acc.code} — {acc.name} · nature : {NATURES[acc.nature] || acc.nature}</p>}
          </div>
        )}
      </Section>
    </div>
  );
}

// ---------- États financiers ----------
function StatesTab() {
  const [at, setAt] = useState(today());
  const [from, setFrom] = useState(month1());
  const [to, setTo] = useState(today());
  const [bs, setBs] = useState(null);
  const [cr, setCr] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api.compta.statements.balanceSheet(at),
      api.compta.statements.result(from, to)
    ]).then(([b, r]) => { setBs(b); setCr(r); }).catch((e) => setError(e.message || 'Erreur'));
  }, [at, from, to]);
  useEffect(() => { load(); }, [load]);

  const download = (path, filename) => api.compta.statements.download(path, filename).catch((e) => setError(e.message || 'Export impossible'));
  const bsSection = (label, items) => {
    const total = items.reduce((s, x) => s + x.amount, 0);
    if (items.length === 0 && !total) return null;
    return (
      <div key={label}>
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-brand-700">{label}</p>
        {items.length === 0
          ? <p className="mt-1 pl-4 text-sm text-ink-300">—</p>
          : items.map((x) => (
            <div key={x.code} className="mt-1 flex items-baseline justify-between gap-2 pl-4 text-sm">
              <span className="text-ink-600"><span className="mr-2 font-mono text-xs text-ink-400">{x.code}</span>{x.name}</span>
              <span className="tabular-nums text-ink-900">{fmt(x.amount)}</span>
            </div>
          ))}
        <div className="mt-1 flex items-baseline justify-between pl-4 text-sm font-bold">
          <span>Total {label.toLowerCase()}</span><span className="tabular-nums">{fmt(total)} $</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Bilan (SYCEBNL)" desc={`Au ${at} — USD`}
          action={
            <div className="flex gap-2">
              <button onClick={() => download(`/api/admin/compta/statements/balance-sheet?at=${at}&format=csv`, `bilan-${at}.csv`)} className="rounded-xl px-3 py-1.5 text-sm font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">CSV</button>
              <button onClick={() => download(`/api/admin/compta/statements/balance-sheet?at=${at}&format=pdf`, `bilan-${at}.pdf`)} className="rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-brand-700">PDF</button>
            </div>
          }>
          <div className="mb-4"><input type="date" value={at} onChange={(e) => setAt(e.target.value)} className="rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200" /></div>
          {bs ? (
            <div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  {bsSection('Actif — Immobilisations', bs.actif.immobilisations)}
                  {bsSection('Actif — Stocks', bs.actif.stocks)}
                  {bsSection('Actif — Trésorerie', bs.actif.tresorerie)}
                  {bsSection('Actif — Autres', bs.actif.autres)}
                </div>
                <div>
                  {bsSection('Ressources durables', bs.passif.ressources)}
                  {bsSection('Dettes et passifs', bs.passif.dettes)}
                </div>
              </div>
              <div className={`mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 ${bs.equilibre ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <div className="text-sm font-bold">
                  <span className="text-ink-900">Total ACTIF : {fmt(bs.actif.total)} $</span>
                  <span className="mx-2 text-ink-300">·</span>
                  <span className="text-ink-900">Total PASSIF : {fmt(bs.passif.total)} $</span>
                </div>
                <span className={`text-sm font-extrabold ${bs.equilibre ? 'text-emerald-700' : 'text-red-600'}`}>
                  {bs.equilibre ? 'Bilan équilibré' : 'Bilan déséquilibré'}
                </span>
              </div>
            </div>
          ) : <p className="text-sm text-ink-400">Chargement…</p>}
        </Section>

        <Section title="Compte de résultat (SYCEBNL)" desc={`Du ${from} au ${to} — charges par nature`}
          action={
            <div className="flex gap-2">
              <button onClick={() => download(`/api/admin/compta/statements/result?from=${from}&to=${to}&format=csv`, `compte-de-resultat-${from}_${to}.csv`)} className="rounded-xl px-3 py-1.5 text-sm font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">CSV</button>
              <button onClick={() => download(`/api/admin/compta/statements/result?from=${from}&to=${to}&format=pdf`, `compte-de-resultat-${from}_${to}.pdf`)} className="rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-brand-700">PDF</button>
            </div>
          }>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200" />
            <span className="text-xs text-ink-400">au</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200" />
          </div>
          {cr ? (
            <div>
              {cr.charges.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-red-600">Charges</p>
                  {cr.charges.map((c) => (
                    <div key={c.code} className="mt-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-ink-600"><span className="mr-2 font-mono text-xs text-ink-400">{c.code}</span>{c.name}</span>
                      <span className="tabular-nums">{fmt(c.amount)}</span>
                    </div>
                  ))}
                  <div className="mt-1 flex items-baseline justify-between text-sm font-bold"><span>Total charges</span><span className="tabular-nums">{fmt(cr.total_charges)} $</span></div>
                </div>
              )}
              {cr.ressources.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Ressources</p>
                  {cr.ressources.map((c) => (
                    <div key={c.code} className="mt-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-ink-600"><span className="mr-2 font-mono text-xs text-ink-400">{c.code}</span>{c.name}</span>
                      <span className="tabular-nums">{fmt(c.amount)}</span>
                    </div>
                  ))}
                  <div className="mt-1 flex items-baseline justify-between text-sm font-bold"><span>Total ressources</span><span className="tabular-nums">{fmt(cr.total_ressources)} $</span></div>
                </div>
              )}
              {cr.charges.length === 0 && cr.ressources.length === 0 && <p className="text-sm text-ink-400">Aucune activité sur la période.</p>}
              <div className={`mt-6 flex items-center justify-between rounded-xl px-4 py-3 ${cr.resultat >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <span className="text-sm font-bold text-ink-900">{cr.resultat >= 0 ? 'Surplus de l\u2019exercice' : 'Déficit de l\u2019exercice'}</span>
                <span className={`font-display text-xl font-extrabold ${cr.resultat >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(Math.abs(cr.resultat))} $</span>
              </div>
            </div>
          ) : <p className="text-sm text-ink-400">Chargement…</p>}
        </Section>
      </div>
    </div>
  );
}
