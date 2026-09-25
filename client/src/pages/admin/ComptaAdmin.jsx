import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Field, Modal } from './AdminUI.jsx';

function Dialog({ title, onClose, wide, children }) {
  return <Dialog open title={title} onClose={onClose} wide={wide}>{children}</Dialog>;
}

const TABS = [
  { id: 'dash', group: 'Pilotage', label: 'Tableau de bord', hint: 'Trésorerie et activité du mois' },
  { id: 'journal', group: 'Saisie', label: 'Journal', hint: 'Écritures, annulations et recherche' },
  { id: 'plan', group: 'Saisie', label: 'Plan de comptes', hint: 'Comptes SYCEBNL (9 classes)' },
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
  reverse: { label: 'Annulation', cls: 'bg-red-50 text-red-600' }
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
      {tab === 'journal' && <JournalTab refresh={refresh} />}
      {tab === 'plan' && <PlanTab />}
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

// ---------- Tableau de bord ----------
function DashTab({ overview, refresh, goTo }) {
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    api.compta.entries.list({}).then(setRecent).catch(() => {});
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

// ---------- Journal ----------
function JournalTab({ refresh }) {
  const [entries, setEntries] = useState([]);
  const [q, setQ] = useState('');
  const [journal, setJournal] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [detail, setDetail] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.compta.entries.list({ q, journal, from, to }).then(setEntries).catch((e) => setError(e.message || 'Erreur'));
  }, [q, journal, from, to]);
  useEffect(() => { load(); }, [load]);

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
      <Section title="Écritures" desc={`${entries.length} résultat(s) — les écritures automatiques (dons, POS, paie) s\u2019annulent sans s\u2019effacer.`}
        action={
          <button onClick={() => { setShowNew(true); setError(''); }} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">
            + Nouvelle écriture
          </button>
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
              {entries.map((e) => (
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
  const [showNew, setShowNew] = useState(false);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => { api.compta.accounts.list(q).then(setAccounts).catch((e) => setError(e.message || '')); }, [q]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      <Section title="Plan de comptes SYCEBNL" desc="74 comptes de base pré-remplis (9 classes) — vous pouvez ajouter les vôtres ou renommer."
        action={<button onClick={() => { setShowNew(true); setError(''); }} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">+ Nouveau compte</button>}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher par code ou nom…" className="mb-4 w-64 rounded-xl border-0 bg-ink-50 px-3 py-2 text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-bold uppercase tracking-wider text-ink-400">
                <th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Intitulé</th><th className="py-2 pr-3">Nature</th><th className="py-2 pr-3">Classe</th><th className="py-2 pr-3">Statut</th><th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
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

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      <Section title="Balance" desc="Totaux de débit et de crédit par compte sur la période.">
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

  useEffect(() => { api.compta.accounts.list().then(setAccounts).catch(() => {}); }, []);
  useEffect(() => {
    if (!account) { setRows([]); return; }
    api.compta.ledger({ account, from, to }).then((r) => { setRows(r); setLoaded(true); }).catch(() => {});
  }, [account, from, to]);

  const acc = accounts.find((a) => a.code === account);

  return (
    <div className="space-y-6">
      <Section title="Grand livre" desc="Mouvements successifs et soldes courants d\u2019un compte.">
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
