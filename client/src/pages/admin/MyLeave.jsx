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
  d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const MY_TASK_STATUS = { a_faire: 'À faire', en_cours: 'En cours', terminee: 'Terminée' };
const MY_TASK_STATUS_CLS = { a_faire: 'bg-ink-100 text-ink-600', en_cours: 'bg-accent-100 text-accent-800', terminee: 'bg-emerald-100 text-emerald-700' };
const MY_TASK_PRIORITY_CLS = { basse: 'bg-ink-100 text-ink-500', normale: 'bg-brand-50 text-brand-700', haute: 'bg-accent-100 text-accent-800', urgente: 'bg-red-100 text-red-700' };

function MyTasksCard() {
  const [tasks, setTasks] = useState([]);
  const [noteTask, setNoteTask] = useState(null);
  const [note, setNote] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [detailNotes, setDetailNotes] = useState([]);

  const load = useCallback(() => {
    api.me.employee.tasks().then(setTasks).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const setStatus = async (t, status) => {
    try {
      await api.me.employee.taskStatus(t.id, status);
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const openNotes = async (t) => {
    try {
      const full = await api.me.employee.task(t.id);
      setDetailId(t.id);
      setDetailNotes(full.notes || []);
      setNoteTask(t.id);
      setNote('');
    } catch (e) {
      alert(e.message);
    }
  };
  const closeNotes = () => {
    setNoteTask(null);
    setDetailId(null);
    setNote('');
  };
  const addNote = async () => {
    if (!note.trim()) return;
    try {
      await api.me.employee.taskNote(detailId, note.trim());
      const full = await api.me.employee.task(detailId);
      setDetailNotes(full.notes || []);
      setNote('');
    } catch (e) {
      alert(e.message);
    }
  };
  const downloadPdf = async (t) => {
    try {
      await api.me.employee.taskPdf(t.id, `tache-${t.id}.pdf`);
    } catch (e) {
      alert(e.message);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const groups = Object.keys(MY_TASK_STATUS).map((s) => ({ s, items: tasks.filter((t) => t.status === s) }));

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-100 bg-cream/70 px-6 py-4">
        <h3 className="font-display text-lg font-bold text-ink-900">📋 Mes tâches</h3>
        <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-extrabold text-white">
          {tasks.filter((t) => t.status !== 'terminee').length} en cours
        </span>
      </div>
      {tasks.length === 0 && <p className="px-6 py-10 text-center text-sm text-ink-400">Aucune tâche ne vous est attribuée pour le moment.</p>}
      <ul>
        {groups.map(({ s, items }) =>
          items.length === 0 ? null : (
            <li key={s} className="border-b border-ink-50 last:border-0">
              <p className="px-6 pt-4 text-[11px] font-bold tracking-wide text-ink-400 uppercase">{MY_TASK_STATUS[s]} ({items.length})</p>
              <ul className="p-3">
                {items.map((t) => {
                  const overdue = t.due_date && t.status !== 'terminee' && t.due_date < today;
                  return (
                    <li key={t.id} className="mb-2 rounded-xl bg-cream p-4 last:mb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink-900">{t.title}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {t.project_name && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">📁 {t.project_name}</span>}
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${MY_TASK_PRIORITY_CLS[t.priority] || ''}`}>{t.priority}</span>
                            {t.due_date && (
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${overdue ? 'bg-red-100 text-red-700' : 'bg-white text-ink-500'}`}>
                                {overdue ? '⚠ Échue le ' : 'Échéance '}{fmtDate(t.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          {t.status === 'a_faire' && (
                            <button onClick={() => setStatus(t, 'en_cours')} className="rounded-lg bg-accent-50 px-2.5 py-1.5 text-xs font-bold text-accent-800 hover:bg-accent-100">Commencer</button>
                          )}
                          {t.status !== 'terminee' ? (
                            <button onClick={() => setStatus(t, 'terminee')} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">✓ Terminer</button>
                          ) : (
                            <button onClick={() => setStatus(t, 'en_cours')} className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100">↻ Rouvrir</button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2.5 flex gap-1.5">
                        <button onClick={() => (noteTask === t.id ? closeNotes() : openNotes(t))} className="text-xs font-bold text-brand-700 hover:text-brand-800">
                          {noteTask === t.id ? 'Masquer les échanges' : '💬 Échanges / avancement'}
                        </button>
                        <button onClick={() => downloadPdf(t)} className="text-xs font-bold text-ink-500 hover:text-ink-700">⬇ Fiche PDF</button>
                      </div>
                      {noteTask === t.id && (
                        <div className="mt-3 space-y-2 border-t border-ink-100 pt-3">
                          {detailNotes.map((n) => (
                            <p key={n.id} className="rounded-lg bg-white px-3 py-2 text-xs text-ink-600">
                              <span className="font-bold text-brand-700">{Number(n.author_id) === Number(getSavedUser()?.id) ? 'Moi' : n.author_name || 'RH'} · {fmtDate(n.created_at)}</span> — {n.body}
                            </p>
                          ))}
                          {detailNotes.length === 0 && <p className="text-xs text-ink-400">Aucun échange pour le moment.</p>}
                          <div className="flex gap-2">
                            <input className="input !py-2 text-xs" placeholder="Signaler un avancement, une question…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} />
                            <button className="btn-ghost shrink-0 !px-3 !py-2 text-xs" onClick={addNote} disabled={!note.trim()}>Envoyer</button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          )
        )}
      </ul>
    </div>
  );
}

function MyChatCard() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const load = useCallback(() => {
    api.me.chat.list().then(setMessages).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  const send = async () => {
    if (!input.trim()) return;
    try {
      await api.me.chat.send(input.trim());
      setInput('');
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-ink-100 bg-cream/70 px-6 py-4">
        <h3 className="font-display text-lg font-bold text-ink-900">💬 Messagerie</h3>
        <p className="text-xs text-ink-400">Échangez directement avec les ressources humaines</p>
      </div>
      <div className="max-h-80 space-y-2.5 overflow-y-auto bg-cream/30 px-5 py-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === 'employee' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.sender === 'employee' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white text-ink-800 ring-1 ring-ink-100'}`}>
              <p>{m.body}</p>
              <p className={`mt-0.5 text-[10px] ${m.sender === 'employee' ? 'text-white/70' : 'text-ink-400'}`}>
                {new Date(String(m.created_at).replace(' ', 'T') + 'Z').toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="py-8 text-center text-sm text-ink-400">Aucun message — posez votre première question aux RH.</p>}
      </div>
      <div className="flex gap-2 border-t border-ink-100 p-4">
        <input className="input" placeholder="Écrire un message…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn-primary shrink-0 !px-4 text-sm" onClick={send} disabled={!input.trim()}>Envoyer</button>
      </div>
    </div>
  );
}

const attHm = (v) => String(v || '').slice(11, 16);
const attDuration = (a) => {
  const s = new Date(String(a.clock_in || a.last_seen).replace(' ', 'T') + 'Z').getTime();
  const e = new Date(String(a.clock_out || a.last_seen).replace(' ', 'T') + 'Z').getTime();
  if (isNaN(s) || isNaN(e) || e < s) return '';
  const m = Math.round((e - s) / 60000);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h} h ${String(r).padStart(2, '0')}` : `${r} min`;
};

function MyPresenceCard() {
  const [rows, setRows] = useState([]);

  const load = useCallback(() => {
    api.me.employee.attendance().then(setRows).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const todayRow = rows.find((r) => r.date === today);
  const ongoing = todayRow && !todayRow.clock_out;
  const recent = rows.slice(1, 15);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 bg-cream/70 px-6 py-4">
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900">⏱ Ma présence</h3>
          <p className="text-xs text-ink-400">
            Pointée automatiquement pendant votre temps dans cet espace de travail.
          </p>
        </div>
        {todayRow && (
          <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${ongoing ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'}`}>
            {ongoing ? '● En poste' : 'Journée terminée'}
          </span>
        )}
      </div>

      {todayRow ? (
        <div className="grid grid-cols-3 divide-x divide-ink-100 border-b border-ink-100 bg-white text-center">
          <div className="px-3 py-4">
            <p className="font-display text-xl font-extrabold text-brand-700">{attHm(todayRow.clock_in)}</p>
            <p className="mt-0.5 text-[11px] font-bold tracking-wide text-ink-400 uppercase">Début</p>
          </div>
          <div className="px-3 py-4">
            <p className={`font-display text-xl font-extrabold ${ongoing ? 'text-accent-800' : 'text-brand-700'}`}>
              {ongoing ? attHm(todayRow.last_seen) : attHm(todayRow.clock_out || todayRow.last_seen)}
            </p>
            <p className="mt-0.5 text-[11px] font-bold tracking-wide text-ink-400 uppercase">
              {ongoing ? 'Dernière activité' : 'Fin'}
            </p>
          </div>
          <div className="px-3 py-4">
            <p className="font-display text-xl font-extrabold text-ink-900">{attDuration(todayRow) || '—'}</p>
            <p className="mt-0.5 text-[11px] font-bold tracking-wide text-ink-400 uppercase">
              {ongoing ? 'Temps passé' : 'Durée'}
            </p>
          </div>
        </div>
      ) : (
        <p className="border-b border-ink-100 px-6 py-6 text-center text-sm text-ink-400">
          Aucun pointage aujourd'hui — votre première activité dans cet espace marquera votre début de journée.
        </p>
      )}

      {recent.length > 0 && (
        <ul>
          {recent.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 border-b border-ink-50 px-6 py-3 last:border-0">
              <span className="text-sm font-semibold text-ink-700">{fmtDate(r.date)}</span>
              <span className="font-mono text-xs text-ink-500">
                {attHm(r.clock_in)} → {attHm(r.clock_out || r.last_seen)}
              </span>
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">{attDuration(r) || '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MyLeave() {
  const me = getSavedUser();
  const [employee, setEmployee] = useState(null);
  const [notLinked, setNotLinked] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ type: 'conge', start_date: '', end_date: '', reason: '' });

  const load = useCallback(() => {
    Promise.all([api.me.employee.get(), api.me.employee.leaves(), api.me.employee.announcements()])
      .then(([emp, le, an]) => {
        setEmployee(emp);
        setLeaves(le);
        setAnnouncements(an);
        setNotLinked(false);
      })
      .catch((e) => {
        if (String(e.message).includes('dossier employé')) setNotLinked(true);
        else setError(e.message);
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  // Battement de présence : renouvelle l'heure de fin pendant le temps passé dans l'espace
  useEffect(() => {
    if (!employee) return;
    const ping = () => api.me.employee.attendancePing().catch(() => {});
    ping();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') ping();
    }, 5 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === 'visible') ping(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [employee]);

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
      <PageTitle title="Mon espace" subtitle="Votre présence, vos congés, vos tâches, la messagerie RH et les annonces — lié à votre compte par votre adresse email." />

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

            <MyPresenceCard />

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

            <MyTasksCard />
          </div>

          <div className="space-y-6">
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

          <div className="card overflow-hidden">
            <div className="border-b border-ink-100 bg-cream/70 px-6 py-4">
              <h3 className="font-display text-lg font-bold text-ink-900">📢 Annonces internes</h3>
            </div>
            <ul>
              {announcements.map((a) => (
                <li key={a.id} className="border-b border-ink-50 px-6 py-4 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-ink-800">{a.pinned ? '📌 ' : ''}{a.title}</p>
                    <span className="shrink-0 text-[11px] text-ink-400">{fmtDate(a.created_at)}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed whitespace-pre-wrap text-ink-500">{a.content}</p>
                  {a.expires_at && <p className="mt-1.5 text-[11px] font-semibold text-ink-400">Expire le {fmtDate(a.expires_at)}</p>}
                </li>
              ))}
            </ul>
            {announcements.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-ink-400">Aucune annonce pour le moment.</p>
            )}
          </div>

          <MyChatCard />
          </div>
        </div>
      ) : null}
    </div>
  );
}
