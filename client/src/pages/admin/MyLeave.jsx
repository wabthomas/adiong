import React, { useCallback, useEffect, useState } from 'react';
import { api, getSavedUser } from '../../api.js';
import { PageTitle, Field } from './AdminUI.jsx';

const LEAVE_TYPES = {
  conge: 'Congé annuel',
  maladie: 'Maladie',
  maternite: 'Maternité',
  sans_solde: 'Sans solde',
  formation: 'Formation'
};
const LEAVE_STATUS = {
  en_attente: 'En attente',
  approuve: 'Approuvé',
  rejette: 'Rejeté'
};
const LEAVE_STATUS_STYLES = {
  en_attente: 'bg-accent-100 text-accent-800',
  approuve: 'bg-brand-100 text-brand-700',
  rejette: 'bg-red-100 text-red-700'
};
const fmtDate = (d) =>
  d ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function MyLeave() {
  const me = getSavedUser();
  const [employee, setEmployee] = useState(null);
  const [notLinked, setNotLinked] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ type: 'conge', start_date: '', end_date: '', reason: '' });

  const load = useCallback(() => {
    Promise.all([api.me.employee.get(), api.me.employee.leaves()])
      .then(([emp, le]) => {
        setEmployee(emp);
        setLeaves(le);
        setNotLinked(false);
      })
      .catch((e) => {
        if (String(e.message).includes('dossier employé')) setNotLinked(true);
        else setError(e.message);
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    setOk('');
    try {
      await api.me.employee.request({ ...form, end_date: form.end_date || form.start_date });
      setOk('Demande envoyée — elle sera examinée par les ressources humaines.');
      setForm({ type: 'conge', start_date: '', end_date: '', reason: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const withdraw = async (l) => {
    if (!confirm('Retirer cette demande de congé ?')) return;
    try {
      await api.me.employee.remove(l.id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <PageTitle title="Mon espace" subtitle="Vos congés et votre solde — lié à votre compte par votre adresse email." />

      {notLinked ? (
        <div className="mx-auto max-w-xl rounded-3xl border border-dashed border-ink-200 bg-white p-10 text-center">
          <p className="text-4xl">📇</p>
          <h3 className="mt-4 font-display text-xl font-bold text-ink-900">Aucun dossier employé lié</h3>
          <p className="mt-3 text-sm leading-relaxed text-ink-500">
            Votre adresse email <strong>{me?.email}</strong> ne correspond à aucun dossier employé du module GRH.
            Si vous êtes un membre de l'équipe, demandez aux ressources humaines de renseigner cet email
            dans votre fiche employé.
          </p>
        </div>
      ) : error && !employee ? (
        <p className="rounded-2xl bg-red-50 p-6 text-center text-sm font-semibold text-red-700">{error}</p>
      ) : employee ? (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <div className="card flex items-center gap-5 p-7">
              {employee.photo ? (
                <img src={employee.photo} alt={employee.full_name} className="h-20 w-20 rounded-2xl object-cover ring-1 ring-ink-100" />
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-2xl bg-brand-100 font-display text-2xl font-bold text-brand-700">
                  {employee.full_name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <h3 className="font-display text-xl font-bold text-ink-900">{employee.full_name}</h3>
                <p className="text-sm text-ink-500">{employee.position || '—'}</p>
                {employee.department && <p className="mt-1 text-xs font-semibold text-ink-400">🏢 {employee.department}</p>}
              </div>
            </div>

            <div className="card p-7">
              <h3 className="mb-5 font-display text-lg font-bold text-ink-900">Nouvelle demande de congé</h3>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Type de congé">
                    <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                      {Object.entries(LEAVE_TYPES).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Jours de congé annuel restants">
                    <input className="input bg-cream" disabled value={`${employee.balance?.remaining ?? '—'} / ${employee.balance?.annual ?? '—'}`} />
                  </Field>
                  <Field label="Date de début *">
                    <input className="input" type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </Field>
                  <Field label="Date de fin (optionnel)">
                    <input className="input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </Field>
                </div>
                <Field label="Motif">
                  <textarea className="input" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ex. Congé annuel familial, certificat médical…" />
                </Field>
                {ok && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{ok}</p>}
                {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
                <div className="flex justify-end">
                  <button type="submit" className="btn-primary !px-6 !py-2.5 text-sm" disabled={sending || !form.start_date}>
                    {sending ? 'Envoi…' : 'Envoyer ma demande'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-ink-100 bg-cream/70 px-6 py-4">
              <h3 className="font-display text-lg font-bold text-ink-900">Mes demandes</h3>
            </div>
            <ul>
              {leaves.map((l) => (
                <li key={l.id} className="border-b border-ink-50 px-6 py-4 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-ink-800">{LEAVE_TYPES[l.type] || l.type}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${LEAVE_STATUS_STYLES[l.status] || ''}`}>
                      {LEAVE_STATUS[l.status] || l.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {fmtDate(l.start_date)}{l.end_date ? ` → ${fmtDate(l.end_date)}` : ''}{l.days ? ` · ${l.days} jour(s)` : ''}
                  </p>
                  {l.reason && <p className="mt-1 truncate text-xs text-ink-400" title={l.reason}>{l.reason}</p>}
                  {l.status === 'en_attente' && (
                    <button onClick={() => withdraw(l)} className="mt-2 text-xs font-bold text-red-600 hover:text-red-700">
                      Retirer la demande
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {leaves.length === 0 && <p className="px-6 py-10 text-center text-sm text-ink-400">Aucune demande pour l'instant.</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
