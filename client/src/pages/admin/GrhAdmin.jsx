import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getSavedUser } from '../../api.js';
import { useSite } from '../../hooks/useSite.jsx';
import { PageTitle, Field, Modal, ImageInput } from './AdminUI.jsx';

const TABS = [
  { id: 'overview', group: 'Équipe', label: 'Vue d’ensemble', hint: 'Effectif, embauches et absences', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z' },
  { id: 'employees', group: 'Équipe', label: 'Équipe', hint: 'Fiches, dossiers et soldes de congés', icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z' },
  { id: 'orgchart', group: 'Équipe', label: 'Organigramme', hint: 'Hiérarchie et rattachements', icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z' },
  { id: 'departments', group: 'Équipe', label: 'Départements', hint: 'Services et effectifs', icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12v6H3V3Z' },
  { id: 'leaves', group: 'Temps & paie', label: 'Congés', hint: 'Demandes, validation et calendrier', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5' },
  { id: 'payroll', group: 'Temps & paie', label: 'Paie', hint: 'Bulletins, PDF et export CSV', icon: 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z' },
  { id: 'attendance', group: 'Temps & paie', label: 'Présences', hint: 'Pointage automatique, heures et corrections', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  { id: 'recruit', group: 'Développement', label: 'Recrutement', hint: 'Offres, pipeline et embauche', icon: 'M20.25 14.15v4.25c0 .414-.336.75-.75.75h-15a.75.75 0 0 1-.75-.75v-4.25m16.5 0a2.25 2.25 0 0 0 .75-1.661V8.706c0-1.081-.738-2.015-1.797-2.158a48.148 48.148 0 0 0-10.906 0C5.238 6.69 4.5 7.625 4.5 8.706v3.783c0 .655.269 1.25.75 1.661m16.5 0a2.25 2.25 0 0 1-2.25 2.25h-12a2.25 2.25 0 0 1-2.25-2.25m16.5 0V12a2.25 2.25 0 0 0-2.25-2.25h-12A2.25 2.25 0 0 0 4.5 12v2.15' },
  { id: 'evaluations', group: 'Développement', label: 'Évaluations', hint: 'Bilans et notes sur 5', icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  { id: 'trainings', group: 'Développement', label: 'Formations', hint: 'Catalogue et participants', icon: 'M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.57 50.57 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342' },
  { id: 'announcements', group: 'Développement', label: 'Annonces', hint: 'Messages internes de l’équipe', icon: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38a.75.75 0 0 1-1.021-.24l-1.05-1.82a.87.87 0 0 1 .24-1.201l.657-.38c.523-.302.71-.961.463-1.511a24.11 24.11 0 0 1-.985-2.783Zm11.528 3.72a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1 0-1.5h.008a.75.75 0 0 1 .75.75Zm-1.5-4.5a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1 0-1.5h.008a.75.75 0 0 1 .75.75Zm-1.5-4.5a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1 0-1.5h.008a.75.75 0 0 1 .75.75Z' },
  { id: 'projects', group: 'Pilotage', label: 'Projets', hint: 'Équipes, échéances et avancement', icon: 'M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z' },
  { id: 'tasks', group: 'Pilotage', label: 'Tâches', hint: 'Kanban, priorités et fiches PDF', icon: 'M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75' },
  { id: 'chat', group: 'Pilotage', label: 'Messagerie RH', hint: 'Échanges admin ↔ employés', icon: 'M20.25 8.511c.884.284 1.5 1.123 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155' },
  { id: 'admindocs', group: 'Pilotage', label: 'Docs admin', hint: 'Documents de l’organisation', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' }
];

function TabIcon({ d, className = 'h-5 w-5 shrink-0' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function GrhSection({ title, desc, action, children, padded = true }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink-950/5">
      {(title || desc || action) && (
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

const CONTRACTS = {
  permanent: 'Permanent (CDI)',
  cdd: 'CDD',
  vacataire: 'Vacataire',
  benevole: 'Bénévole',
  stagiaire: 'Stagiaire'
};
const CONTRACT_COLORS = {
  permanent: '#0f3a88',
  cdd: '#fc7a03',
  vacataire: '#64748b',
  benevole: '#0d9488',
  stagiaire: '#7c3aed'
};
const LEAVE_TYPES = {
  conge: 'Congé annuel',
  maladie: 'Maladie',
  maternite: 'Maternité',
  sans_solde: 'Sans solde',
  formation: 'Formation'
};
const LEAVE_COLORS = {
  conge: '#0f3a88',
  maladie: '#dc2626',
  maternite: '#db2777',
  sans_solde: '#64748b',
  formation: '#0d9488'
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

const emptyEmployee = {
  full_name: '', email: '', phone: '', position: '', department_id: null,
  contract_type: 'permanent', hire_date: '', status: 'actif', leave_date: '',
  salary: '', salary_currency: 'USD', photo: '', notes: '',
  manager_id: null, annual_days: '', job_description: ''
};

const DOC_CATEGORIES = {
  contrat: 'Contrat',
  identite: 'Pièce d’identité',
  diplome: 'Diplôme / CV',
  medicale: 'Certificat médical',
  autre: 'Autre'
};
const PAY_STATUS = { brouillon: 'Brouillon', envoye: 'Envoyé' };
const EVAL_STATUS = { brouillon: 'Brouillon', validee: 'Validée' };
const TRAIN_TYPES = { interne: 'Interne', externe: 'Externe' };
const TRAIN_STATUS = { inscrit: 'Inscrit', termine: 'Terminé', annule: 'Annulé' };
const EVAL_DEFAULTS = [
  { label: 'Qualité du travail', score: 3 },
  { label: 'Autonomie et responsabilité', score: 3 },
  { label: 'Travail en équipe', score: 3 },
  { label: 'Respect des délais', score: 3 }
];
const fmtMoney = (n, cur = 'USD') =>
  `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0)} ${cur}`;
const monthLabelFr = (m) => {
  const [y, mo] = String(m).split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const emptyLeave = { employee_id: null, type: 'conge', start_date: '', end_date: '', reason: '', status: 'en_attente' };

const fmtDate = (d) =>
  d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function GrhKpi({ icon, label, value, hint, tone = 'bg-brand-50 text-brand-700', onClick }) {
  const inner = (
    <>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>
        <TabIcon d={icon} className="h-5 w-5 shrink-0" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-2xl font-extrabold leading-none text-ink-900">{value}</span>
        <span className="mt-0.5 block truncate text-xs font-bold text-ink-700">{label}</span>
        {hint ? <span className="block truncate text-[11px] font-semibold text-ink-400">{hint}</span> : null}
      </span>
    </>
  );
  const cls = 'flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 ring-ink-100 transition hover:shadow-soft';
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>{inner}</button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function GrhCard({ title, action, children, className = '' }) {
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

function GrhDonut({ slices = [], unit = '' }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" className="h-[132px] w-[132px] shrink-0">
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
          />
        );
        offset += dash;
        return el;
      })}
      <text x="60" y="56" textAnchor="middle" fill="#0f172a" fontSize="18" fontWeight="800">
        {slices.reduce((a, s) => a + s.value, 0)}
      </text>
      {unit ? (
        <text x="60" y="72" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="700">{unit}</text>
      ) : null}
    </svg>
  );
}

function monthShort(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  if (!y || !m) return '';
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}

function GrhBars({ series = [], valueKey = 'n', color = '#0f3a88' }) {
  const max = Math.max(1, ...series.map((p) => Number(p[valueKey] || 0)));
  return (
    <div className="flex h-[148px] items-end gap-1">
      {series.map((p, i) => {
        const v = Number(p[valueKey] || 0);
        const last = i === series.length - 1;
        return (
          <div key={p.month || i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md"
              style={{ height: `${Math.max(4, (v / max) * 118)}px`, background: last ? color : `${color}55` }}
              title={`${monthShort(p.month)} · ${v}`}
            />
            {(i === 0 || last || i % 2 === 0) && (
              <span className="text-[10px] font-semibold capitalize text-ink-400">{monthShort(p.month)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmployeeForm({ initial, departments, employees = [], isSuper, onSaved, onClose }) {
  const [f, setF] = useState({ ...initial, salary: initial.salary ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        full_name: f.full_name,
        email: f.email || '',
        phone: f.phone || '',
        position: f.position || '',
        department_id: f.department_id || null,
        contract_type: f.contract_type || 'permanent',
        hire_date: f.hire_date || '',
        status: f.status || 'actif',
        leave_date: f.leave_date || '',
        salary_currency: f.salary_currency || 'USD',
        photo: f.photo || '',
        notes: f.notes || '',
        manager_id: f.manager_id ? Number(f.manager_id) : null,
        annual_days: f.annual_days === '' || f.annual_days == null ? 0 : Number(f.annual_days) || 0,
        job_description: f.job_description || '',
        salary: isSuper ? f.salary : undefined
      };
      if (initial.id) await api.grh.employees.update(initial.id, payload);
      else await api.grh.employees.create(payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet *">
          <input className="input" value={f.full_name} onChange={set('full_name')} placeholder="Prénom Nom" />
        </Field>
        <Field label="Fonction">
          <input className="input" value={f.position} onChange={set('position')} placeholder="Ex. Chef de projet" />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={f.email || ''} onChange={set('email')} placeholder="prenom@adiong.org" />
        </Field>
        <Field label="Téléphone">
          <input className="input" value={f.phone || ''} onChange={set('phone')} placeholder="+243 …" />
        </Field>
        <Field label="Département">
          <select className="input" value={f.department_id ?? ''} onChange={set('department_id')}>
            <option value="">Non affecté</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Type de contrat">
          <select className="input" value={f.contract_type} onChange={set('contract_type')}>
            {Object.entries(CONTRACTS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Date d'embauche">
          <input className="input" type="date" value={f.hire_date || ''} onChange={set('hire_date')} />
        </Field>
        <Field label="Statut">
          <select className="input" value={f.status} onChange={set('status')}>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif (départ)</option>
          </select>
        </Field>
        <Field label="Supérieur hiérarchique">
          <select className="input" value={f.manager_id ?? ''} onChange={set('manager_id')}>
            <option value="">— Aucun —</option>
            {employees.filter((x) => x.id !== initial.id).map((x) => (
              <option key={x.id} value={x.id}>{x.full_name}{x.position ? ` — ${x.position}` : ''}</option>
            ))}
          </select>
        </Field>
        <Field label="Jours de congé / an (0 = défaut)">
          <input
            className="input"
            type="number"
            min="0"
            step="1"
            value={f.annual_days ?? ''}
            onChange={set('annual_days')}
            placeholder="Ex. 22"
          />
        </Field>
        {f.status === 'inactif' && (
          <Field label="Date de départ">
            <input className="input" type="date" value={f.leave_date || ''} onChange={set('leave_date')} />
          </Field>
        )}
      </div>

      {isSuper && (
        <div className="rounded-2xl border border-accent-200 bg-accent-50 p-5">
          <p className="mb-3 text-xs font-bold tracking-wide text-accent-800 uppercase">
            Rémunération — visible uniquement par le super admin
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Salaire mensuel">
              <input className="input" type="number" min="0" step="0.01" value={f.salary === null ? '' : f.salary} onChange={set('salary')} placeholder="Ex. 800" />
            </Field>
            <Field label="Devise">
              <select className="input" value={f.salary_currency} onChange={set('salary_currency')}>
                {['USD', 'EUR', 'CDF', 'EUR'].filter((c, i, a) => a.indexOf(c) === i).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      )}

      <Field label="Photo">
        <ImageInput
          label=""
          round
          value={f.photo || ''}
          onChange={(v) => setF((cur) => ({ ...cur, photo: v }))}
        />
      </Field>
      <Field label="Notes internes">
        <textarea className="input" rows={3} value={f.notes || ''} onChange={set('notes')} placeholder="Formations, observations…" />
      </Field>
      <Field label="Fiche de poste">
        <textarea className="input" rows={4} value={f.job_description || ''} onChange={set('job_description')} placeholder="Missions, responsabilités, compétences attendues…" />
      </Field>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={saving || !f.full_name.trim()}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

function LeaveForm({ initial, employees, onSaved, onClose }) {
  const [f, setF] = useState({ ...initial, employee_id: initial.employee_id ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...f, employee_id: Number(f.employee_id) || null };
      if (initial.id) await api.grh.leaves.update(initial.id, payload);
      else await api.grh.leaves.create(payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Field label="Employé *">
        <select className="input" value={f.employee_id} onChange={set('employee_id')} disabled={!!initial.id}>
          <option value="">— Choisir —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}{e.position ? ` — ${e.position}` : ''}</option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type de congé">
          <select className="input" value={f.type} onChange={set('type')}>
            {Object.entries(LEAVE_TYPES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Statut">
          <select className="input" value={f.status} onChange={set('status')}>
            {Object.entries(LEAVE_STATUS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Date de début *">
          <input className="input" type="date" value={f.start_date || ''} onChange={set('start_date')} />
        </Field>
        <Field label="Date de fin (optionnel)">
          <input className="input" type="date" value={f.end_date || ''} onChange={set('end_date')} />
        </Field>
      </div>
      {f.type === 'conge' && (() => {
        const emp = employees.find((x) => String(x.id) === String(f.employee_id));
        if (!emp?.balance) return null;
        return (
          <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            emp.balance.remaining <= 0 ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700'
          }`}>
            Solde de {emp.full_name} : <strong>{emp.balance.remaining} jour(s) restant(s)</strong> sur {emp.balance.annual} cette année.
          </p>
        );
      })()}
      <Field label="Motif">
        <textarea className="input" rows={3} value={f.reason || ''} onChange={set('reason')} placeholder="Ex. Congé annuel, certificat médical…" />
      </Field>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={saving || !f.employee_id || !f.start_date}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

function EmployeeFileModal({ employee, isSuper, onChanged, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [upload, setUpload] = useState({ name: '', category: 'autre', file: null });
  const [uploading, setUploading] = useState(false);
  const [cert, setCert] = useState({ type: 'emploi', end_date: '' });
  const [certBusy, setCertBusy] = useState(false);

  const downloadCert = async () => {
    if (cert.type === 'travail' && !cert.end_date) {
      alert('Indiquez la date de fin de contrat pour le certificat de travail.');
      return;
    }
    setCertBusy(true);
    setError('');
    try {
      const slug = ((data && data.full_name) || employee.full_name || 'employe').replace(/\s+/g, '-').toLowerCase();
      await api.grh.certificate.download(
        employee.id,
        { type: cert.type, end_date: cert.end_date },
        `${cert.type === 'travail' ? 'certificat' : 'attestation'}-${slug}.pdf`
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setCertBusy(false);
    }
  };

  const load = useCallback(() => {
    api.grh.employees.get(employee.id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [employee.id]);
  useEffect(() => { load(); }, [load]);

  const doUpload = async () => {
    if (!upload.file) return;
    setUploading(true);
    setError('');
    try {
      await api.grh.employees.uploadDocument(employee.id, upload.file, upload.name, upload.category);
      setUpload({ name: '', category: 'autre', file: null });
      load();
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };
  const doDownload = async (doc) => {
    try {
      await api.grh.employees.downloadDocument(doc.id, doc.name);
    } catch (e) {
      setError(e.message);
    }
  };
  const doRemoveDoc = async (doc) => {
    if (!confirm(`Supprimer « ${doc.name} » du dossier ?`)) return;
    try {
      await api.grh.employees.removeDocument(doc.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (error && !data) return <p className="text-sm font-semibold text-red-700">{error}</p>;
  const d = data || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {d.photo ? (
          <img src={d.photo} alt={d.full_name} className="h-20 w-20 rounded-2xl object-cover ring-1 ring-ink-100" />
        ) : (
          <span className="grid h-20 w-20 place-items-center rounded-2xl bg-brand-100 font-display text-2xl font-bold text-brand-700">
            {(d.full_name || '?').slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-bold text-ink-900">{d.full_name}</h3>
          <p className="text-sm text-ink-500">{d.position || 'Fonction non renseignée'}</p>
          <p className="mt-1 text-xs text-ink-400">
            {d.department || 'Non affecté'}
            {d.manager_name ? ` · Supérieur : ${d.manager_name}` : ''}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${d.status === 'actif' ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>
          {d.status === 'actif' ? 'Actif' : 'Inactif'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-brand-50 p-4 text-center">
          <p className="font-display text-2xl font-bold text-brand-700">{d.balance?.annual ?? '—'}</p>
          <p className="text-xs font-bold tracking-wide text-brand-600/70 uppercase">Jours / an</p>
        </div>
        <div className="rounded-2xl bg-ink-100/70 p-4 text-center">
          <p className="font-display text-2xl font-bold text-ink-700">{d.balance?.used ?? '—'}</p>
          <p className="text-xs font-bold tracking-wide text-ink-400 uppercase">Pris cette année</p>
        </div>
        <div className={`rounded-2xl p-4 text-center ${d.balance && d.balance.remaining < 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
          <p className={`font-display text-2xl font-bold ${d.balance && d.balance.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {d.balance?.remaining ?? '—'}
          </p>
          <p className={`text-xs font-bold tracking-wide uppercase ${d.balance && d.balance.remaining < 0 ? 'text-red-400' : 'text-emerald-500'}`}>Restants</p>
        </div>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <p className="text-ink-600">📧 {d.email || '—'}</p>
        <p className="text-ink-600">📞 {d.phone || '—'}</p>
        <p className="text-ink-600">📄 {CONTRACTS[d.contract_type] || d.contract_type || '—'}</p>
        <p className="text-ink-600">📅 Embauché : {fmtDate(d.hire_date)}</p>
        {isSuper && d.salary != null && (
          <p className="font-bold text-accent-800 sm:col-span-2">💰 {Number(d.salary).toLocaleString('fr-FR')} {d.salary_currency}/mois</p>
        )}
      </div>

      {d.job_description && (
        <div>
          <p className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Fiche de poste</p>
          <p className="rounded-xl bg-cream p-4 text-sm leading-relaxed whitespace-pre-wrap text-ink-700">{d.job_description}</p>
        </div>
      )}

      <div>
        <p className="mb-3 text-xs font-bold tracking-wide text-ink-400 uppercase">Pièces et documents</p>
        <div className="rounded-2xl border border-dashed border-ink-200 bg-cream/50 p-4">
          <div className="flex flex-wrap gap-2">
            <label className="input flex-1 cursor-pointer !py-2.5 text-sm text-ink-500">
              {upload.file ? upload.file.name : 'Choisir un fichier (PDF, Word, image)…'}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif"
                onChange={(e) => setUpload({ ...upload, file: e.target.files?.[0] || null })}
              />
            </label>
            <input
              className="input !w-48 !py-2.5 text-sm"
              placeholder="Nom (ex. Contrat 2026)"
              value={upload.name}
              onChange={(e) => setUpload({ ...upload, name: e.target.value })}
            />
            <select className="input !w-44 !py-2.5 text-sm" value={upload.category} onChange={(e) => setUpload({ ...upload, category: e.target.value })}>
              {Object.entries(DOC_CATEGORIES).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <button className="btn-primary shrink-0 !px-5 !py-2.5 text-sm" onClick={doUpload} disabled={!upload.file || uploading}>
              {uploading ? 'Envoi…' : 'Ajouter'}
            </button>
          </div>
        </div>
        <ul className="mt-3 divide-y divide-ink-50 rounded-2xl bg-white ring-1 ring-ink-100">
          {(d.documents || []).map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-lg">📎</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-800">{doc.name}</p>
                <p className="text-xs text-ink-400">{DOC_CATEGORIES[doc.category] || doc.category} · {fmtDate(doc.created_at)}</p>
              </div>
              <button className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100" onClick={() => doDownload(doc)}>
                Télécharger
              </button>
              <button className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" onClick={() => doRemoveDoc(doc)} title="Supprimer">
                ✕
              </button>
            </li>
          ))}
        </ul>
        {(d.documents || []).length === 0 && (
          <p className="mt-3 text-center text-sm text-ink-400">Aucune pièce dans ce dossier pour l'instant.</p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Certificats PDF</p>
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-ink-200 bg-cream/50 p-4">
          <Field label="Type de certificat">
            <select className="input !py-2.5 text-sm" value={cert.type} onChange={(e) => setCert({ ...cert, type: e.target.value })}>
              <option value="emploi">Attestation d'emploi (en poste)</option>
              <option value="travail">Certificat de travail (après départ)</option>
            </select>
          </Field>
          {cert.type === 'travail' && (
            <Field label="Date de fin *">
              <input className="input !py-2.5 text-sm" type="date" value={cert.end_date} onChange={(e) => setCert({ ...cert, end_date: e.target.value })} />
            </Field>
          )}
          <button className="btn-primary shrink-0 !px-5 !py-2.5 text-sm" onClick={downloadCert} disabled={certBusy}>
            {certBusy ? 'Génération…' : '⬇ Télécharger le PDF'}
          </button>
        </div>
      </div>

      {isSuper && (d.salary_history || []).length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Historique salarial</p>
          <ul className="space-y-2">
            {d.salary_history.slice(0, 5).map((h, i) => (
              <li key={h.id} className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-2.5 text-sm">
                <span className="text-ink-600">
                  {h.old_salary != null ? fmtMoney(h.old_salary) : '—'} → <strong className="text-ink-800">{fmtMoney(h.new_salary)}</strong>
                </span>
                <span className="text-xs text-ink-400">{fmtDate(h.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Congés récents</p>
        <ul className="space-y-2">
          {(d.leaves || []).slice(0, 5).map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-2.5 text-sm">
              <span className="font-semibold text-ink-700">{LEAVE_TYPES[l.type] || l.type}</span>
              <span className="text-ink-500">
                {fmtDate(l.start_date)}{l.end_date ? ` → ${fmtDate(l.end_date)}` : ''}{l.days ? ` · ${l.days} j` : ''}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${LEAVE_STATUS_STYLES[l.status] || ''}`}>
                {LEAVE_STATUS[l.status] || l.status}
              </span>
            </li>
          ))}
        </ul>
        {(d.leaves || []).length === 0 && <p className="text-sm text-ink-400">Aucun congé enregistré.</p>}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}

const PRINT_BULLETIN_CSS = `
@page { size: A4; margin: 0; }
@media print {
  body * { visibility: hidden; }
  .print-bulletin, .print-bulletin * { visibility: visible; }
  .print-bulletin { position: fixed; top: 0; left: 50%; transform: translateX(-50%); box-shadow: none !important; margin: 0 !important; }
  .no-print { display: none !important; }
}
.print-bulletin { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
`;

function PaySlipSheet({ p, site }) {
  const rows = [
    ['Salaire de base', fmtMoney(p.base_salary, p.currency)],
    ...(p.bonus > 0 ? [[`Primes${p.bonus_label ? ` — ${p.bonus_label}` : ''}`, `+ ${fmtMoney(p.bonus, p.currency)}`]] : []),
    ...(p.deductions > 0 ? [[`Retenues${p.deductions_label ? ` — ${p.deductions_label}` : ''}`, `- ${fmtMoney(p.deductions, p.currency)}`]] : []),
    ['Total', fmtMoney(Number(p.base_salary) + Number(p.bonus), p.currency)]
  ];
  return (
    <div className="print-bulletin mx-auto w-full max-w-[720px] overflow-hidden rounded-xl bg-white shadow-lift ring-1 ring-ink-950/10">
      <div className="bg-brand-700 px-8 py-6 text-white">
        <p className="font-display text-sm font-bold tracking-widest">{(site.site_name || 'ADI ONG').toUpperCase()}</p>
        {site.site_tagline && <p className="mt-0.5 text-xs text-white/70">{site.site_tagline}</p>}
        <div className="mt-3 flex items-end justify-between">
          <h3 className="font-display text-2xl font-extrabold">BULLETIN DE PAIE</h3>
          <p className="text-sm font-bold">Période : {monthLabelFr(p.month)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 px-8 pt-6">
        <div className="rounded-xl border border-ink-100 p-4">
          <p className="text-[10px] font-bold tracking-widest text-ink-400">ORGANISATION</p>
          <p className="mt-1 text-sm font-bold text-ink-900">{site.site_name || '—'}</p>
          {site.address && <p className="mt-1 text-xs text-ink-600">{site.address}</p>}
          {site.phone1 && <p className="text-xs text-ink-600">{site.phone1}</p>}
          {site.email && <p className="text-xs text-ink-600">{site.email}</p>}
        </div>
        <div className="rounded-xl border border-ink-100 p-4">
          <p className="text-[10px] font-bold tracking-widest text-ink-400">EMPLOYÉ</p>
          <p className="mt-1 text-sm font-bold text-ink-900">{p.full_name}</p>
          {p.position && <p className="mt-1 text-xs text-ink-600">Fonction : {p.position}</p>}
          {p.department && <p className="text-xs text-ink-600">Département : {p.department}</p>}
          {p.hire_date && <p className="text-xs text-ink-600">Embauché le : {fmtDate(p.hire_date)}</p>}
          {p.email && <p className="text-xs text-ink-600">{p.email}</p>}
        </div>
      </div>
      <div className="px-8 py-6">
        <div className="divide-y divide-ink-100">
          {rows.map(([label, val]) => (
            <div key={label} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-ink-700">{label}</span>
              <span className="font-semibold text-ink-800">{val}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-700 px-6 py-4 text-white">
          <p className="text-sm font-bold tracking-wide">NET À PAYER ({p.currency})</p>
          <p className="font-display text-2xl font-extrabold">{fmtMoney(p.net, p.currency)}</p>
        </div>
        <p className="mt-3 text-xs text-ink-400">
          Statut : {PAY_STATUS[p.status] || p.status} · Émis le {new Date().toLocaleDateString('fr-FR')}
        </p>
        <div className="mt-10 flex justify-between text-xs text-ink-400">
          <div className="w-48 border-t border-ink-300 pt-2 text-center">Signature de l'employeur</div>
          <div className="w-48 border-t border-ink-300 pt-2 text-center">Signature de l'employé</div>
        </div>
      </div>
    </div>
  );
}

function PaySlipForm({ initial, employees, month, onSaved, onClose }) {
  const [f, setF] = useState({
    employee_id: initial.employee_id ?? '',
    month: initial.month ?? month,
    base_salary: initial.base_salary ?? '',
    bonus: initial.bonus ?? 0,
    bonus_label: initial.bonus_label ?? '',
    deductions: initial.deductions ?? 0,
    deductions_label: initial.deductions_label ?? '',
    status: initial.status ?? 'brouillon'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const chosen = employees.find((x) => String(x.id) === String(f.employee_id));
  const pickEmployee = (id) => {
    const emp = employees.find((x) => String(x.id) === String(id));
    setF((cur) => ({ ...cur, employee_id: id, base_salary: cur.base_salary === '' || initial.employee_id ? (emp?.current_salary ?? emp?.salary ?? '') : cur.base_salary }));
  };
  const net = (Number(f.base_salary) || 0) + (Number(f.bonus) || 0) - (Number(f.deductions) || 0);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...f,
        employee_id: Number(f.employee_id) || null,
        base_salary: Number(f.base_salary) || 0,
        bonus: Math.max(0, Number(f.bonus) || 0),
        deductions: Math.max(0, Number(f.deductions) || 0)
      };
      if (initial.id) await api.grh.payroll.update(initial.id, payload);
      else await api.grh.payroll.create(payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Employé *">
          <select className="input" value={f.employee_id} onChange={(e) => pickEmployee(e.target.value)} disabled={!!initial.id}>
            <option value="">— Choisir —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}{e.position ? ` — ${e.position}` : ''}</option>
            ))}
          </select>
        </Field>
        <Field label="Mois *">
          <input className="input" type="month" value={f.month || ''} onChange={set('month')} />
        </Field>
        <Field label="Salaire de base">
          <input className="input" type="number" min="0" step="0.01" value={f.base_salary} onChange={set('base_salary')} placeholder={chosen?.current_salary ? `Défaut : ${chosen.current_salary}` : ''} />
        </Field>
        <Field label="Statut">
          <select className="input" value={f.status} onChange={set('status')}>
            {Object.entries(PAY_STATUS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Primes / avantages">
          <input className="input" type="number" min="0" step="0.01" value={f.bonus} onChange={set('bonus')} />
        </Field>
        <Field label="Détail primes">
          <input className="input" value={f.bonus_label} onChange={set('bonus_label')} placeholder="Ex. prime de rendement" />
        </Field>
        <Field label="Retenues">
          <input className="input" type="number" min="0" step="0.01" value={f.deductions} onChange={set('deductions')} />
        </Field>
        <Field label="Détail retenues">
          <input className="input" value={f.deductions_label} onChange={set('deductions_label')} placeholder="Ex. avance, mutuelle…" />
        </Field>
      </div>
      <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700">
        Net à payer : {fmtMoney(net, chosen?.salary_currency || 'USD')}
      </p>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={saving || !f.employee_id || !f.month}>
          {saving ? 'Enregistrement…' : 'Enregistrer le bulletin'}
        </button>
      </div>
    </div>
  );
}

function PayrollTab({ employees, onChanged }) {
  const { site } = useSite();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState([]);
  const [formModal, setFormModal] = useState(null);
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    api.grh.payroll.list(month).then(setRows).catch((e) => setError(e.message));
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (!confirm(`Générer les bulletins (brouillons) de ${monthLabelFr(month)} pour tous les employés actifs ayant un salaire ?`)) return;
    try {
      const r = await api.grh.payroll.generate(month);
      setMsg(`✓ ${r.created} bulletin(s) créé(s), ${r.skipped} déjà existant(s).`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  const exportCsv = async () => {
    try {
      setMsg('');
      await api.grh.payroll.exportCsv(month);
      setMsg('✓ Export CSV téléchargé.');
    } catch (e) {
      setError(e.message);
    }
  };
  const downloadPdf = async (p) => {
    try {
      await api.grh.payroll.downloadPdf(p.id, `bulletin-${p.full_name.replace(/\s+/g, '-').toLowerCase()}-${p.month}.pdf`);
    } catch (e) {
      setError(e.message);
    }
  };
  const markSent = async (p) => {
    try {
      await api.grh.payroll.update(p.id, { status: p.status === 'envoye' ? 'brouillon' : 'envoye' });
      setMsg(p.status === 'envoye' ? '✓ Repassé en brouillon.' : '✓ Bulletin marqué comme envoyé.');
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  const removeRow = async (p) => {
    if (!confirm(`Supprimer le bulletin de ${p.full_name} (${monthLabelFr(p.month)}) ?`)) return;
    try {
      await api.grh.payroll.remove(p.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const totalNet = rows.reduce((acc, r) => acc + (Number(r.net) || 0), 0);

  return (
    <div className="space-y-5">
      <style>{PRINT_BULLETIN_CSS}</style>
      <p className="rounded-2xl border border-accent-200 bg-accent-50 px-5 py-3.5 text-sm font-semibold text-accent-900">
        Module confidentiel : la paie est réservée au super administrateur.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink-950/5">
        <div className="flex items-center gap-2 px-1">
          <label className="text-sm font-bold text-ink-500">Mois</label>
          <input type="month" className="input !w-44 !py-2.5" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost !px-4 !py-2 text-sm" onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV
          </button>
          <button className="btn-ghost !px-4 !py-2 text-sm" onClick={generate}>
            Générer le mois
          </button>
          <button className="btn-primary !px-5 !py-2 text-sm" onClick={() => setFormModal({ month })}>
            + Bulletin
          </button>
        </div>
      </div>
      {msg && <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">{msg}</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      <GrhSection
        title={`Bulletins — ${monthLabelFr(month)}`}
        desc={rows.length ? `${rows.length} bulletin(s) · Masse nette ${fmtMoney(totalNet)}` : 'Aucun bulletin pour ce mois'}
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-cream/40 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-3.5">Employé</th>
                <th className="px-6 py-3.5">Base</th>
                <th className="px-6 py-3.5">Primes</th>
                <th className="px-6 py-3.5">Retenues</th>
                <th className="px-6 py-3.5">Net</th>
                <th className="px-6 py-3.5">Statut</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-ink-900">{r.full_name}</p>
                    <p className="text-xs text-ink-400">{r.position || ''}</p>
                  </td>
                  <td className="px-6 py-4 text-ink-600">{fmtMoney(r.base_salary, r.currency)}</td>
                  <td className="px-6 py-4 text-ink-600">{r.bonus ? `+${fmtMoney(r.bonus, r.currency)}` : '—'}</td>
                  <td className="px-6 py-4 text-ink-600">{r.deductions ? `−${fmtMoney(r.deductions, r.currency)}` : '—'}</td>
                  <td className="px-6 py-4 font-bold text-brand-700">{fmtMoney(r.net, r.currency)}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${r.status === 'envoye' ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>
                      {PAY_STATUS[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => setView(r)} className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100">
                        Bulletin
                      </button>
                      <button onClick={() => downloadPdf(r)} className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100">
                        PDF
                      </button>
                      <button onClick={() => setFormModal({ ...r })} className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100">
                        Éditer
                      </button>
                      <button onClick={() => removeRow(r)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" title="Supprimer">
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="py-12 text-center text-ink-400">
            Aucun bulletin pour {monthLabelFr(month)} — générez le mois ou créez un bulletin.
          </p>
        )}
      </GrhSection>

      <Modal open={!!formModal} onClose={() => setFormModal(null)} title={formModal?.id ? 'Modifier le bulletin' : 'Nouveau bulletin'} wide>
        {formModal && (
          <PaySlipForm
            initial={formModal}
            employees={employees.filter((e) => e.status === 'actif')}
            month={month}
            onSaved={() => { load(); onChanged(); }}
            onClose={() => setFormModal(null)}
          />
        )}
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} title={view ? `Bulletin — ${view.full_name} (${monthLabelFr(view.month)})` : ''} wide>
        {view && (
          <div className="space-y-4">
            <PaySlipSheet p={view} site={site} />
            <div className="no-print flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-4">
              <button className="btn-ghost !px-4 !py-2.5 text-sm" onClick={() => markSent(view)}>
                {view.status === 'envoye' ? '↩ Repasser en brouillon' : '✓ Marquer envoyé'}
              </button>
              <button className="btn-ghost !px-4 !py-2.5 text-sm" onClick={() => downloadPdf(view)}>
                ⬇ Télécharger le PDF
              </button>
              <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => window.print()}>
                🖨 Imprimer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const STAGE_LABELS = { recu: 'Reçu', entretien: 'Entretien', retenu: 'Retenu', refuse: 'Refusé', retire: 'Retiré' };
const STAGE_STYLES = {
  recu: 'bg-ink-100 text-ink-600',
  entretien: 'bg-accent-100 text-accent-800',
  retenu: 'bg-emerald-100 text-emerald-700',
  refuse: 'bg-red-100 text-red-700',
  retire: 'bg-ink-50 text-ink-400'
};

function JobForm({ initial, departments, onSaved, onClose }) {
  const [f, setF] = useState({
    title: initial.title ?? '',
    department_id: initial.department_id ?? '',
    contract_type: initial.contract_type ?? 'permanent',
    location: initial.location ?? '',
    salary_min: initial.salary_min ?? '',
    salary_max: initial.salary_max ?? '',
    salary_currency: initial.salary_currency ?? 'USD',
    deadline: initial.deadline ?? '',
    published: initial.published ?? 1,
    description: initial.description ?? '',
    requirements: initial.requirements ?? ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...f,
        department_id: f.department_id || null,
        salary_min: f.salary_min === '' ? null : Number(f.salary_min) || null,
        salary_max: f.salary_max === '' ? null : Number(f.salary_max) || null
      };
      if (initial.id) await api.grh.jobs.update(initial.id, payload);
      else await api.grh.jobs.create(payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Intitulé *">
          <input className="input" value={f.title} onChange={set('title')} placeholder="Ex. Enseignant en rééducation" />
        </Field>
        <Field label="Département">
          <select className="input" value={f.department_id ?? ''} onChange={set('department_id')}>
            <option value="">Non affecté</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Type de contrat">
          <select className="input" value={f.contract_type} onChange={set('contract_type')}>
            {Object.entries(CONTRACTS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Lieu">
          <input className="input" value={f.location || ''} onChange={set('location')} placeholder="Ex. Goma, Bukavu (déplacement)…" />
        </Field>
        <Field label="Salaire min">
          <input className="input" type="number" min="0" step="0.01" value={f.salary_min ?? ''} onChange={set('salary_min')} placeholder="Optionnel" />
        </Field>
        <Field label="Salaire max">
          <input className="input" type="number" min="0" step="0.01" value={f.salary_max ?? ''} onChange={set('salary_max')} placeholder="Optionnel" />
        </Field>
        <Field label="Date limite de candidature">
          <input className="input" type="date" value={f.deadline || ''} onChange={set('deadline')} />
        </Field>
        <Field label="Statut">
          <select className="input" value={f.published} onChange={(e) => setF({ ...f, published: e.target.value === '1' ? 1 : 0 })}>
            <option value="1">Publiée</option>
            <option value="0">Masquée</option>
          </select>
        </Field>
      </div>
      <Field label="Description du poste">
        <textarea className="input" rows={4} value={f.description || ''} onChange={set('description')} placeholder="Missions, contexte, conditions…" />
      </Field>
      <Field label="Profil recherché / exigences">
        <textarea className="input" rows={3} value={f.requirements || ''} onChange={set('requirements')} placeholder="Compétences, diplôme, expérience…" />
      </Field>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={saving || !f.title.trim()}>
          {saving ? 'Enregistrement…' : 'Enregistrer l’offre'}
        </button>
      </div>
    </div>
  );
}

function CandidateForm({ initial, jobs, onSaved, onClose }) {
  const [f, setF] = useState({
    job_id: initial.job_id ?? '',
    full_name: initial.full_name ?? '',
    email: initial.email ?? '',
    phone: initial.phone ?? '',
    stage: initial.stage ?? 'recu',
    interview_date: initial.interview_date ?? '',
    notes: initial.notes ?? '',
    cv: null
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (initial.id) {
        await api.grh.candidates.update(initial.id, {
          job_id: f.job_id || null,
          full_name: f.full_name, email: f.email, phone: f.phone,
          stage: f.stage, interview_date: f.interview_date, notes: f.notes
        });
      } else {
        const fd = new FormData();
        fd.append('job_id', f.job_id || '');
        fd.append('full_name', f.full_name);
        fd.append('email', f.email);
        fd.append('phone', f.phone);
        fd.append('stage', f.stage);
        fd.append('interview_date', f.interview_date);
        fd.append('notes', f.notes);
        if (f.cv) fd.append('cv', f.cv);
        await api.grh.candidates.create(fd);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet *">
          <input className="input" value={f.full_name} onChange={set('full_name')} placeholder="Prénom Nom" />
        </Field>
        <Field label="Offre liée">
          <select className="input" value={f.job_id ?? ''} onChange={set('job_id')}>
            <option value="">— Sans offre —</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={f.email || ''} onChange={set('email')} placeholder="candidat@exemple.org" />
        </Field>
        <Field label="Téléphone">
          <input className="input" value={f.phone || ''} onChange={set('phone')} placeholder="+243 …" />
        </Field>
        <Field label="Étape">
          <select className="input" value={f.stage} onChange={set('stage')}>
            {Object.entries(STAGE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Date d'entretien">
          <input className="input" type="date" value={f.interview_date || ''} onChange={set('interview_date')} />
        </Field>
      </div>
      {!initial.id && (
        <Field label="CV (PDF, Word, image)">
          <input
            type="file"
            className="input !py-2.5 text-sm"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
            onChange={(e) => setF({ ...f, cv: e.target.files?.[0] || null })}
          />
        </Field>
      )}
      <Field label="Notes">
        <textarea className="input" rows={3} value={f.notes || ''} onChange={set('notes')} placeholder="Motivation, points forts, à vérifier…" />
      </Field>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={saving || !f.full_name.trim()}>
          {saving ? 'Enregistrement…' : 'Enregistrer le candidat'}
        </button>
      </div>
    </div>
  );
}

function RecruitTab({ departments, onChanged }) {
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobModal, setJobModal] = useState(null);
  const [candModal, setCandModal] = useState(null);
  const [filterJob, setFilterJob] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    Promise.all([api.grh.jobs.list(), api.grh.candidates.list()])
      .then(([j, c]) => { setJobs(j); setCandidates(c); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const setStage = async (c, stage) => {
    try {
      await api.grh.candidates.update(c.id, { stage });
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const hire = async (c) => {
    if (!confirm(`Convertir ${c.full_name} en employé ?\nUn dossier sera créé dans l'onglet Équipe${c.job_id ? " avec l'offre liée" : ''}.`)) return;
    try {
      await api.grh.candidates.hire(c.id);
      setMsg(`✓ ${c.full_name} a été ajouté à l'équipe.`);
      setError('');
      load();
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };
  const removeJob = async (j) => {
    if (!confirm(`Supprimer l'offre « ${j.title} » ? Ses candidats seront conservés sans offre.`)) return;
    try {
      await api.grh.jobs.remove(j.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const removeCand = async (c) => {
    if (!confirm(`Supprimer le candidat « ${c.full_name} » et son CV ?`)) return;
    try {
      await api.grh.candidates.remove(c.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const downloadCv = async (c) => {
    try {
      await api.grh.candidates.downloadCv(c.id, `cv-${c.full_name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    } catch (e) {
      alert(e.message);
    }
  };

  const stageCounts = Object.keys(STAGE_LABELS).map((s) => ({
    stage: s,
    n: candidates.filter((c) => c.stage === s).length
  }));
  const visibleCandidates = candidates.filter(
    (c) => (!filterJob || String(c.job_id) === String(filterJob)) && (!filterStage || c.stage === filterStage)
  );

  return (
    <div className="space-y-5">
      <GrhSection
        title={`Offres d'emploi (${jobs.length})`}
        action={
          <button className="btn-primary !px-5 !py-2 text-sm" onClick={() => setJobModal({})}>
            + Nouvelle offre
          </button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((j) => (
            <div key={j.id} className="flex flex-col overflow-hidden rounded-xl bg-cream/60 p-4 ring-1 ring-ink-950/5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display font-bold text-ink-900">{j.title}</p>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${j.published ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>
                  {j.published ? 'Publiée' : 'Masquée'}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-ink-400">
                <p>{j.department || 'Non affecté'} · {CONTRACTS[j.contract_type] || j.contract_type}</p>
                {j.location && <p>{j.location}</p>}
                {(j.salary_min != null || j.salary_max != null) && (
                  <p>{fmtMoney(j.salary_min ?? 0, j.salary_currency)} — {fmtMoney(j.salary_max ?? 0, j.salary_currency)}</p>
                )}
                {j.deadline && <p>Jusqu'au {fmtDate(j.deadline)}</p>}
                <p className="font-bold text-brand-700">{j.candidates} candidat(s)</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100/80 pt-3">
                <button className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-ink-600 ring-1 ring-ink-100 hover:bg-ink-50" onClick={() => setJobModal({ ...j })}>
                  Modifier
                </button>
                <button
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-ink-600 ring-1 ring-ink-100 hover:bg-ink-50"
                  onClick={async () => {
                    try {
                      await api.grh.jobs.update(j.id, { published: j.published ? 0 : 1 });
                      load();
                    } catch (e) {
                      alert(e.message);
                    }
                  }}
                >
                  {j.published ? 'Masquer' : 'Publier'}
                </button>
                <button className="ml-auto rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" onClick={() => removeJob(j)}>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
        {jobs.length === 0 && (
          <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-ink-400">
            Aucune offre d'emploi — créez-en une pour structurer le recrutement.
          </p>
        )}
      </GrhSection>

      <GrhSection
        title={`Candidats (${candidates.length})`}
        action={
          <div className="flex flex-wrap gap-2">
            <select className="input !w-48 !py-2 text-sm" value={filterJob} onChange={(e) => setFilterJob(e.target.value)}>
              <option value="">Toutes les offres</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
            <button className="btn-primary !px-5 !py-2 text-sm" onClick={() => setCandModal({})}>
              + Candidat
            </button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {stageCounts.map(({ stage, n }) => (
            <button
              key={stage}
              onClick={() => setFilterStage(filterStage === stage ? '' : stage)}
              className={`rounded-full px-4 py-2 text-xs font-bold ring-1 transition-all ${
                filterStage === stage ? 'bg-brand-600 text-white ring-brand-600' : `bg-white ring-ink-200 hover:ring-brand-300 ${STAGE_STYLES[stage]}`
              }`}
            >
              {STAGE_LABELS[stage]} : {n}
            </button>
          ))}
        </div>

        {msg && <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">{msg}</p>}
        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

        <div className="overflow-hidden rounded-xl ring-1 ring-ink-100">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-ink-100 bg-cream/40 text-xs font-bold tracking-wide text-ink-400 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Candidat</th>
                  <th className="px-6 py-3.5">Offre</th>
                  <th className="px-6 py-3.5">Étape</th>
                  <th className="px-6 py-3.5">Entretien</th>
                  <th className="px-6 py-3.5">CV</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCandidates.map((c) => (
                  <tr key={c.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-ink-900">{c.full_name}</p>
                      <p className="text-xs text-ink-400">{c.email}{c.email && c.phone ? ' · ' : ''}{c.phone}</p>
                      {c.notes && <p className="mt-0.5 max-w-[220px] truncate text-xs text-ink-400" title={c.notes}>{c.notes}</p>}
                    </td>
                    <td className="px-6 py-4 text-ink-600">{c.job_title || '—'}</td>
                    <td className="px-6 py-4">
                      <select
                        className="input !w-32 !py-1.5 text-xs font-bold"
                        value={c.stage}
                        onChange={(e) => setStage(c, e.target.value)}
                        style={{ background: 'transparent' }}
                      >
                        {Object.entries(STAGE_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-ink-600">{fmtDate(c.interview_date)}</td>
                    <td className="px-6 py-4">
                      {c.cv_file ? (
                        <button className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100" onClick={() => downloadCv(c)}>
                          Télécharger
                        </button>
                      ) : (
                        <span className="text-xs text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1.5">
                        {c.stage !== 'retenu' && (
                          <button
                            onClick={() => hire(c)}
                            className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                            title="Créer le dossier employé"
                          >
                            ✓ Embaucher
                          </button>
                        )}
                        {c.stage === 'retenu' && (
                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700">
                            Embauché {c.hired_at ? fmtDate(c.hired_at) : ''}
                          </span>
                        )}
                        <button onClick={() => setCandModal({ ...c })} className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100">
                          Éditer
                        </button>
                        <button onClick={() => removeCand(c)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" title="Supprimer">
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleCandidates.length === 0 && (
            <p className="py-12 text-center text-ink-400">Aucun candidat{filterJob || filterStage ? ' pour ces filtres' : ''}.</p>
          )}
        </div>
      </GrhSection>

      <Modal open={!!jobModal} onClose={() => setJobModal(null)} title={jobModal?.id ? 'Modifier l’offre' : 'Nouvelle offre d’emploi'} wide>
        {jobModal && (
          <JobForm
            initial={jobModal}
            departments={departments}
            onSaved={load}
            onClose={() => setJobModal(null)}
          />
        )}
      </Modal>

      <Modal open={!!candModal} onClose={() => setCandModal(null)} title={candModal?.id ? 'Modifier le candidat' : 'Nouveau candidat'} wide>
        {candModal && (
          <CandidateForm
            initial={candModal}
            jobs={jobs}
            onSaved={load}
            onClose={() => setCandModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function EvaluationForm({ initial, employees, onSaved, onClose }) {
  const [f, setF] = useState({
    employee_id: initial.employee_id ?? '',
    period: initial.period ?? new Date().toISOString().slice(0, 7),
    criteria: initial.criteria?.length ? initial.criteria.map((c) => ({ ...c })) : EVAL_DEFAULTS.map((c) => ({ ...c })),
    comments: initial.comments ?? '',
    status: initial.status ?? 'brouillon'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setCrit = (i, key, value) =>
    setF((cur) => ({ ...cur, criteria: cur.criteria.map((c, j) => (j === i ? { ...c, [key]: value } : c)) }));
  const addCrit = () => setF((cur) => ({ ...cur, criteria: [...cur.criteria, { label: '', score: 3 }] }));
  const rmCrit = (i) => setF((cur) => ({ ...cur, criteria: cur.criteria.filter((_, j) => j !== i) }));
  const avg = f.criteria.length
    ? (f.criteria.reduce((a, c) => a + (Number(c.score) || 0), 0) / f.criteria.length).toFixed(1)
    : '—';

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        employee_id: Number(f.employee_id) || null,
        period: f.period,
        criteria: f.criteria.filter((c) => c.label.trim()).map((c) => ({ label: c.label.trim(), score: Number(c.score) || 3 })),
        comments: f.comments,
        status: f.status
      };
      if (initial.id) await api.grh.evaluations.update(initial.id, payload);
      else await api.grh.evaluations.create(payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Employé *">
          <select className="input" value={f.employee_id} onChange={set('employee_id')} disabled={!!initial.id}>
            <option value="">— Choisir —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}{e.position ? ` — ${e.position}` : ''}</option>
            ))}
          </select>
        </Field>
        <Field label="Période (mois) *">
          <input className="input" type="month" value={f.period} onChange={set('period')} />
        </Field>
        <Field label="Statut">
          <select className="input" value={f.status} onChange={set('status')}>
            {Object.entries(EVAL_STATUS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Critères (note sur 5)</p>
        <div className="space-y-2">
          {f.criteria.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="input flex-1 !py-2.5 text-sm"
                placeholder="Critère (ex. Qualité du travail)"
                value={c.label}
                onChange={(e) => setCrit(i, 'label', e.target.value)}
              />
              <select className="input !w-24 !py-2.5 text-sm font-bold" value={c.score} onChange={(e) => setCrit(i, 'score', e.target.value)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}/5</option>
                ))}
              </select>
              <button type="button" onClick={() => rmCrit(i)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" title="Retirer">
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={addCrit} className="text-sm font-bold text-brand-700 hover:text-brand-800">+ Ajouter un critère</button>
          <p className="text-sm font-bold text-ink-500">Moyenne : <span className="text-brand-700">{avg}/5</span></p>
        </div>
      </div>

      <Field label="Commentaires / points à améliorer">
        <textarea className="input" rows={4} value={f.comments} onChange={set('comments')} placeholder="Forces observées, axes de progression, objectifs pour la période suivante…" />
      </Field>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={saving || !f.employee_id || !f.criteria.some((c) => c.label.trim())}>
          {saving ? 'Enregistrement…' : 'Enregistrer l’évaluation'}
        </button>
      </div>
    </div>
  );
}

function EvaluationTab({ employees }) {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null);
  const [filterEmp, setFilterEmp] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api.grh.evaluations.list().then(setRows).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const validate = async (r) => {
    try {
      await api.grh.evaluations.update(r.id, { status: 'validee' });
      setMsg(`✓ Évaluation de ${r.full_name} validée.`);
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const remove = async (r) => {
    if (!confirm(`Supprimer l'évaluation de ${r.full_name} (${monthLabelFr(r.period)}) ?`)) return;
    try {
      await api.grh.evaluations.remove(r.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const visible = rows.filter((r) => !filterEmp || String(r.employee_id) === String(filterEmp));
  const scoreColor = (n) => (n >= 4 ? 'text-emerald-600' : n >= 3 ? 'text-brand-700' : 'text-red-600');

  return (
    <div className="space-y-5">
      {msg && <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">{msg}</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      <GrhSection
        title={`Évaluations (${visible.length})`}
        desc="Critères personnalisables notés sur 5, commentaires et validation."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select className="input !w-52 !py-2 text-sm" value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)}>
              <option value="">Tous les employés</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>
            <button className="btn-primary !px-5 !py-2 text-sm" onClick={() => setModal({})}>+ Nouvelle évaluation</button>
          </div>
        }
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-cream/40 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-3.5">Employé</th>
                <th className="px-6 py-3.5">Période</th>
                <th className="px-6 py-3.5">Moyenne</th>
                <th className="px-6 py-3.5">Critères</th>
                <th className="px-6 py-3.5">Commentaires</th>
                <th className="px-6 py-3.5">Statut</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-ink-900">{r.full_name}</p>
                    <p className="text-xs text-ink-400">{r.position || ''}</p>
                  </td>
                  <td className="px-6 py-4 font-bold text-ink-700">{monthLabelFr(r.period)}</td>
                  <td className="px-6 py-4">
                    <span className={`font-display text-lg font-extrabold ${scoreColor(r.overall)}`}>{Number(r.overall).toFixed(1)}</span>
                    <span className="text-xs font-bold text-ink-300">/5</span>
                  </td>
                  <td className="max-w-[240px] px-6 py-4 text-xs text-ink-500">
                    {(r.criteria || []).map((c) => `${c.label} (${c.score})`).join(' · ')}
                  </td>
                  <td className="max-w-[220px] truncate px-6 py-4 text-xs text-ink-400" title={r.comments}>{r.comments || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${r.status === 'validee' ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>
                      {EVAL_STATUS[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1.5">
                      {r.status === 'brouillon' && (
                        <button onClick={() => validate(r)} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                          ✓ Valider
                        </button>
                      )}
                      <button onClick={() => setModal({ ...r })} className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100">
                        Éditer
                      </button>
                      <button onClick={() => remove(r)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" title="Supprimer">
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && <p className="py-12 text-center text-ink-400">Aucune évaluation — créez la première pour un employé.</p>}
      </GrhSection>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? `Modifier — ${modal.full_name || ''} (${monthLabelFr(modal.period)})` : 'Nouvelle évaluation'} wide>
        {modal && (
          <EvaluationForm
            initial={modal}
            employees={employees.filter((e) => e.status === 'actif')}
            onSaved={() => { load(); setMsg(''); }}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function TrainingForm({ initial, employees, onSaved, onClose }) {
  const [f, setF] = useState({
    title: initial.title ?? '',
    type: initial.type ?? 'externe',
    provider: initial.provider ?? '',
    start_date: initial.start_date ?? '',
    end_date: initial.end_date ?? '',
    cost: initial.cost ?? '',
    cost_currency: initial.cost_currency ?? 'USD',
    notes: initial.notes ?? '',
    employee_ids: initial.attendees ? initial.attendees.map((a) => a.employee_id) : []
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleEmp = (id) =>
    setF((cur) => ({
      ...cur,
      employee_ids: cur.employee_ids.includes(Number(id))
        ? cur.employee_ids.filter((x) => x !== Number(id))
        : [...cur.employee_ids, Number(id)]
    }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...f, cost: f.cost === '' || f.cost == null ? null : Number(f.cost) || null };
      if (initial.id) await api.grh.trainings.update(initial.id, payload);
      else await api.grh.trainings.create(payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Intitulé *">
          <input className="input" value={f.title} onChange={set('title')} placeholder="Ex. Formation premiers secours" />
        </Field>
        <Field label="Type">
          <select className="input" value={f.type} onChange={set('type')}>
            {Object.entries(TRAIN_TYPES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Organisme">
          <input className="input" value={f.provider} onChange={set('provider')} placeholder="Ex. Croissant-Rouge, atelier interne…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début">
            <input className="input" type="date" value={f.start_date} onChange={set('start_date')} />
          </Field>
          <Field label="Fin">
            <input className="input" type="date" value={f.end_date} onChange={set('end_date')} />
          </Field>
        </div>
        <Field label="Coût">
          <input className="input" type="number" min="0" step="0.01" value={f.cost} onChange={set('cost')} placeholder="Optionnel" />
        </Field>
        <Field label="Devise">
          <select className="input" value={f.cost_currency} onChange={set('cost_currency')}>
            {['USD', 'EUR', 'CDF'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Participants ({f.employee_ids.length})</p>
        <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-2xl border border-ink-100 p-3 sm:grid-cols-2">
          {employees.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-cream">
              <input type="checkbox" className="h-4 w-4 accent-[#0f3a88]" checked={f.employee_ids.includes(e.id)} onChange={() => toggleEmp(e.id)} />
              <span className="truncate text-ink-700">{e.full_name}</span>
            </label>
          ))}
        </div>
        {employees.length === 0 && <p className="mt-2 text-sm text-ink-400">Aucun employé actif — ajoutez d'abord l'équipe.</p>}
      </div>

      <Field label="Notes">
        <textarea className="input" rows={3} value={f.notes} onChange={set('notes')} placeholder="Objectifs de la formation, logistique…" />
      </Field>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={saving || !f.title.trim()}>
          {saving ? 'Enregistrement…' : 'Enregistrer la formation'}
        </button>
      </div>
    </div>
  );
}

function TrainingTab({ employees }) {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null);
  const [addEmp, setAddEmp] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.grh.trainings.list().then(setRows).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const setAttendeeStatus = async (a, status) => {
    try {
      await api.grh.trainings.updateAttendee(a.id, { status });
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const removeAttendee = async (a) => {
    if (!confirm(`Retirer ${a.full_name} de cette formation ?`)) return;
    try {
      await api.grh.trainings.removeAttendee(a.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const addAttendee = async (t, employeeId) => {
    if (!employeeId) return;
    try {
      await api.grh.trainings.addAttendee(t.id, Number(employeeId));
      setAddEmp((cur) => ({ ...cur, [t.id]: '' }));
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const remove = async (t) => {
    if (!confirm(`Supprimer la formation « ${t.title} » ?`)) return;
    try {
      await api.grh.trainings.remove(t.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-5">
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      <GrhSection
        title={`Formations (${rows.length})`}
        desc="Planifiez, inscrivez les participants et suivez la progression."
        action={
          <button className="btn-primary !px-5 !py-2 text-sm" onClick={() => setModal({})}>+ Nouvelle formation</button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((t) => (
            <div key={t.id} className="flex flex-col overflow-hidden rounded-xl bg-cream/50 p-4 ring-1 ring-ink-950/5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display font-bold text-ink-900">{t.title}</p>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${t.type === 'interne' ? 'bg-brand-100 text-brand-700' : 'bg-accent-100 text-accent-800'}`}>
                  {TRAIN_TYPES[t.type] || t.type}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-ink-400">
                {t.provider && <p>{t.provider}</p>}
                {(t.start_date || t.end_date) && (
                  <p>{t.start_date ? fmtDate(t.start_date) : ''}{t.start_date && t.end_date ? ' → ' : ''}{t.end_date ? fmtDate(t.end_date) : ''}</p>
                )}
                {t.cost != null && <p>{fmtMoney(t.cost, t.cost_currency)}</p>}
                {t.notes && <p className="truncate" title={t.notes}>{t.notes}</p>}
              </div>

              <div className="mt-4 flex-1">
                <p className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Participants ({t.attendees.length})</p>
                <ul className="space-y-1.5">
                  {t.attendees.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-ink-100">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink-800">{a.full_name}</p>
                        <p className="truncate text-[11px] text-ink-400">{a.position || ''}</p>
                      </div>
                      <select
                        className="input !w-28 !py-1.5 text-xs font-bold"
                        value={a.status}
                        onChange={(e) => setAttendeeStatus(a, e.target.value)}
                      >
                        {Object.entries(TRAIN_STATUS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                      <button onClick={() => removeAttendee(a)} className="rounded-lg bg-red-50 px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" title="Retirer">
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                {t.attendees.length === 0 && (
                  <p className="rounded-xl border border-dashed border-ink-200 px-3 py-3 text-center text-xs text-ink-400">Aucun participant inscrit.</p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
                <select
                  className="input !w-48 !py-2 text-xs"
                  value={addEmp[t.id] ?? ''}
                  onChange={(e) => setAddEmp((cur) => ({ ...cur, [t.id]: e.target.value }))}
                >
                  <option value="">+ Participant…</option>
                  {employees.filter((e) => !t.attendees.some((a) => a.employee_id === e.id)).map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
                <button
                  className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-40"
                  disabled={!addEmp[t.id]}
                  onClick={() => addAttendee(t, addEmp[t.id])}
                >
                  Inscrire
                </button>
                <div className="ml-auto flex gap-1.5">
                  <button onClick={() => setModal({ ...t })} className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100">
                    Modifier
                  </button>
                  <button onClick={() => remove(t)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-ink-400">
            Aucune formation enregistrée — planifiez la première.
          </p>
        )}
      </GrhSection>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Modifier la formation' : 'Nouvelle formation'} wide>
        {modal && (
          <TrainingForm
            initial={modal}
            employees={employees.filter((e) => e.status === 'actif')}
            onSaved={load}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function AnnouncementForm({ initial, onSaved, onClose }) {
  const [f, setF] = useState({
    title: initial.title ?? '',
    content: initial.content ?? '',
    pinned: initial.pinned ?? 0,
    expires_at: initial.expires_at ?? ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...f, pinned: f.pinned ? 1 : 0 };
      if (initial.id) await api.grh.announcements.update(initial.id, payload);
      else await api.grh.announcements.create(payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Field label="Titre *">
        <input className="input" value={f.title} onChange={set('title')} placeholder="Ex. Journée portes ouvertes" />
      </Field>
      <Field label="Contenu *">
        <textarea className="input" rows={6} value={f.content} onChange={set('content')} placeholder="Le message affiché dans « Mon espace » de chaque employé…" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date d'expiration (optionnel)">
          <input className="input" type="date" value={f.expires_at} onChange={set('expires_at')} />
        </Field>
        <label className="mt-7 flex cursor-pointer items-center gap-3 rounded-xl border border-ink-100 px-4 py-3">
          <input type="checkbox" className="h-4 w-4 accent-[#0f3a88]" checked={!!f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked ? 1 : 0 })} />
          <span className="text-sm font-semibold text-ink-700">📌 Épingler en tête de liste</span>
        </label>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={saving || !f.title.trim() || !f.content.trim()}>
          {saving ? 'Enregistrement…' : 'Publier l’annonce'}
        </button>
      </div>
    </div>
  );
}

function AnnouncementTab() {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.grh.announcements.list().then(setRows).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const togglePin = async (a) => {
    try {
      await api.grh.announcements.update(a.id, { pinned: a.pinned ? 0 : 1 });
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const remove = async (a) => {
    if (!confirm(`Supprimer l'annonce « ${a.title} » ?`)) return;
    try {
      await api.grh.announcements.remove(a.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-5">
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      <GrhSection
        title={`Annonces (${rows.length})`}
        desc="Visibles dans « Mon espace ». Les annonces épinglées restent en tête."
        action={
          <button className="btn-primary !px-5 !py-2 text-sm" onClick={() => setModal({})}>+ Nouvelle annonce</button>
        }
      >
        <div className="space-y-3">
          {rows.map((a) => (
            <div key={a.id} className={`rounded-xl bg-cream/50 p-4 ring-1 ${a.pinned ? 'ring-brand-200' : 'ring-ink-950/5'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-bold text-ink-900">
                    {a.pinned ? '📌 ' : ''}{a.title}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    {fmtDate(a.created_at)}{a.expires_at ? ` · expire le ${fmtDate(a.expires_at)}` : ' · sans expiration'}
                    {a.created_by_name ? ` · par ${a.created_by_name}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => togglePin(a)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-ink-600 ring-1 ring-ink-100 hover:bg-ink-50">
                    {a.pinned ? 'Désépingler' : 'Épingler'}
                  </button>
                  <button onClick={() => setModal({ ...a })} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-ink-600 ring-1 ring-ink-100 hover:bg-ink-50">
                    Éditer
                  </button>
                  <button onClick={() => remove(a)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" title="Supprimer">
                    ✕
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-600">{a.content}</p>
            </div>
          ))}
        </div>
        {rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-ink-400">
            Aucune annonce interne — publiez la première.
          </p>
        )}
      </GrhSection>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Modifier l’annonce' : 'Nouvelle annonce interne'} wide>
        {modal && (
          <AnnouncementForm initial={modal} onSaved={load} onClose={() => setModal(null)} />
        )}
      </Modal>
    </div>
  );
}

function OrgNode({ node, level = 0, onOpenFile }) {
  return (
    <li className="relative">
      <div
        className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-ink-950/5 transition-shadow hover:shadow-soft"
        style={{ marginLeft: level * 22 }}
      >
        {node.photo ? (
          <img src={node.photo} alt={node.full_name} className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-brand-50" />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 font-display text-sm font-bold text-brand-700">
            {node.full_name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <button className="block max-w-full truncate text-left text-sm font-bold text-ink-900 hover:text-brand-700" onClick={() => onOpenFile(node)}>
            {node.full_name}
          </button>
          <p className="truncate text-xs text-ink-400">{node.position || '—'}</p>
        </div>
        {node.department && (
          <span className="hidden shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 sm:block">
            {node.department}
          </span>
        )}
        {node.status !== 'actif' && (
          <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-bold text-ink-500">Inactif</span>
        )}
      </div>
      {node.children?.length > 0 && (
        <ul className="mt-2 space-y-2 border-l-2 border-brand-100/80 pl-2" style={{ marginLeft: level * 22 + 20 }}>
          {node.children.map((c) => (
            <OrgNode key={c.id} node={c} level={level + 1} onOpenFile={onOpenFile} />
          ))}
        </ul>
      )}
    </li>
  );
}

const TASK_STATUS = { a_faire: 'À faire', en_cours: 'En cours', terminee: 'Terminée' };
const TASK_STATUS_CLS = { a_faire: 'bg-ink-100 text-ink-600', en_cours: 'bg-accent-100 text-accent-800', terminee: 'bg-emerald-100 text-emerald-700' };
const TASK_PRIORITY = { basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: 'Urgente' };
const TASK_PRIORITY_CLS = { basse: 'bg-ink-100 text-ink-500', normale: 'bg-brand-50 text-brand-700', haute: 'bg-accent-100 text-accent-800', urgente: 'bg-red-100 text-red-700' };
const PROJECT_STATUS = { planifie: 'Planifié', en_cours: 'En cours', cloture: 'Clôturé', annule: 'Annulé' };
const PROJECT_STATUS_CLS = { planifie: 'bg-ink-100 text-ink-600', en_cours: 'bg-accent-100 text-accent-800', cloture: 'bg-emerald-100 text-emerald-700', annule: 'bg-red-100 text-red-700' };
const frTaskDate = (d) => {
  if (!d) return '';
  const dt = new Date(String(d).slice(0, 10) + 'T00:00:00Z');
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

function ProjectFormModal({ initial, employees, onSaved, onClose }) {
  const [f, setF] = useState({
    name: initial.name ?? '',
    client: initial.client ?? '',
    deadline: initial.deadline ?? '',
    status: initial.status ?? 'planifie',
    description: initial.description ?? '',
    member_ids: (initial.members || []).map((m) => m.id)
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleMember = (id) =>
    setF((cur) => ({ ...cur, member_ids: cur.member_ids.includes(id) ? cur.member_ids.filter((m) => m !== id) : [...cur.member_ids, id] }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...f, deadline: f.deadline || null, member_ids: f.member_ids };
      if (initial.id) await api.grh.projects.update(initial.id, payload);
      else await api.grh.projects.create(payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du projet *">
          <input className="input" value={f.name} onChange={set('name')} placeholder="Ex. Programme alphabétisation 2026" />
        </Field>
        <Field label="Client / bailleur (optionnel)">
          <input className="input" value={f.client} onChange={set('client')} placeholder="Ex. Mairie de Goma, PNUD…" />
        </Field>
        <Field label="Échéance">
          <input className="input" type="date" value={f.deadline} onChange={set('deadline')} />
        </Field>
        <Field label="Statut">
          <select className="input" value={f.status} onChange={set('status')}>
            {Object.entries(PROJECT_STATUS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Description">
        <textarea className="input min-h-[90px]" value={f.description} onChange={set('description')} placeholder="Objectifs, livrables, périmètre…" />
      </Field>
      <Field label={`Équipe (${f.member_ids.length} membre(s))`}>
        <div className="grid max-h-52 gap-1.5 overflow-y-auto rounded-xl bg-cream p-3 sm:grid-cols-2">
          {employees.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white">
              <input type="checkbox" checked={f.member_ids.includes(e.id)} onChange={() => toggleMember(e.id)} />
              <span className="truncate text-ink-700">{e.full_name}</span>
              <span className="ml-auto truncate text-xs text-ink-400">{e.position}</span>
            </label>
          ))}
          {employees.length === 0 && <p className="text-sm text-ink-400">Aucun employé — créez d'abord l'équipe.</p>}
        </div>
      </Field>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end border-t border-ink-100 pt-4">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={saving || !f.name.trim()}>
          {saving ? 'Enregistrement…' : 'Enregistrer le projet'}
        </button>
      </div>
    </div>
  );
}

function ProjectsTab({ employees }) {
  const [projects, setProjects] = useState([]);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.grh.projects.list().then(setProjects).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const removeProject = async (p) => {
    if (!confirm(`Supprimer le projet « ${p.name} » ?\nSes tâches seront conservées, rattachées à aucun projet.`)) return;
    try {
      await api.grh.projects.remove(p.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-500">Projets de l'organisation : équipe, échéance et suivi des tâches associées.</p>
        <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => setModal({})}>+ Nouveau projet</button>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-cream/70 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-4">Projet</th>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Échéance</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Équipe</th>
                <th className="px-6 py-4">Tâches</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-ink-900">{p.name}</p>
                    {p.description && <p className="mt-0.5 max-w-[280px] truncate text-xs text-ink-400" title={p.description}>{p.description}</p>}
                  </td>
                  <td className="px-6 py-4 text-ink-600">{p.client || '—'}</td>
                  <td className="px-6 py-4 text-ink-600">{p.deadline ? frTaskDate(p.deadline) : '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${PROJECT_STATUS_CLS[p.status] || ''}`}>{PROJECT_STATUS[p.status] || p.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {(p.members || []).slice(0, 4).map((m) => (
                        <span key={m.id} title={`${m.full_name} — ${m.position || ''}`} className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-[10px] font-extrabold text-brand-700">
                          {m.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      ))}
                      {(p.members || []).length > 4 && <span className="text-xs font-bold text-ink-400">+{p.members.length - 4}</span>}
                      {(p.members || []).length === 0 && <span className="text-ink-400">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-ink-600">
                    <span className={p.open_count > 0 ? 'font-bold text-accent-800' : ''}>{p.open_count} en cours</span>
                    <span className="text-ink-400"> / {p.tasks_count}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => setModal({ ...p })} className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100">Modifier</button>
                      <button onClick={() => removeProject(p)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" title="Supprimer">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {projects.length === 0 && <p className="py-12 text-center text-ink-400">Aucun projet — créez le premier.</p>}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? `Modifier — ${modal.name}` : 'Nouveau projet'} wide>
        {modal && <ProjectFormModal initial={modal} employees={employees} onSaved={load} onClose={() => setModal(null)} />}
      </Modal>
    </div>
  );
}

function TaskFormModal({ initial, employees, projects, onSaved, onClose }) {
  const [f, setF] = useState({
    title: initial.title ?? '',
    description: initial.description ?? '',
    project_id: initial.project_id ?? '',
    assignee_id: initial.assignee_id ?? '',
    priority: initial.priority ?? 'normale',
    due_date: initial.due_date ?? '',
    status: initial.status ?? 'a_faire'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...f, project_id: f.project_id || null, assignee_id: f.assignee_id || null, due_date: f.due_date || null };
      if (initial.id) await api.grh.tasks.update(initial.id, payload);
      else await api.grh.tasks.create(payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Field label="Intitulé *">
        <input className="input" value={f.title} onChange={set('title')} placeholder="Ex. Rédiger le rapport d'avancement du projet" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Projet">
          <select className="input" value={f.project_id ?? ''} onChange={set('project_id')}>
            <option value="">Sans projet</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Assigné à">
          <select className="input" value={f.assignee_id ?? ''} onChange={set('assignee_id')}>
            <option value="">Non assigné</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name} — {e.position || 'sans poste'}</option>
            ))}
          </select>
        </Field>
        <Field label="Priorité">
          <select className="input" value={f.priority} onChange={set('priority')}>
            {Object.entries(TASK_PRIORITY).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Échéance">
          <input className="input" type="date" value={f.due_date ?? ''} onChange={set('due_date')} />
        </Field>
        {!initial.id && (
          <Field label="Statut initial">
            <select className="input" value={f.status} onChange={set('status')}>
              {Object.entries(TASK_STATUS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <Field label="Description">
        <textarea className="input min-h-[100px]" value={f.description} onChange={set('description')} placeholder="Consignes, livrables attendus, contexte…" />
      </Field>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end border-t border-ink-100 pt-4">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={saving || !f.title.trim()}>
          {saving ? 'Enregistrement…' : 'Enregistrer la tâche'}
        </button>
      </div>
    </div>
  );
}

function TaskDetailModal({ taskId, onChanged, onEdit, onClose }) {
  const [task, setTask] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.grh.tasks.get(taskId).then(setTask).catch((e) => setError(e.message));
  }, [taskId]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (status) => {
    try {
      await api.grh.tasks.setStatus(taskId, status);
      load();
      onChanged();
    } catch (e) {
      alert(e.message);
    }
  };
  const addNote = async () => {
    if (!note.trim()) return;
    try {
      await api.grh.tasks.addNote(taskId, note.trim());
      setNote('');
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const download = async () => {
    try {
      await api.grh.tasks.downloadPdf(taskId, `tache-${taskId}.pdf`);
    } catch (e) {
      alert(e.message);
    }
  };
  const remove = async () => {
    if (!confirm('Supprimer cette tâche et son historique de commentaires ?')) return;
    try {
      await api.grh.tasks.remove(taskId);
      onChanged();
      onClose();
    } catch (e) {
      alert(e.message);
    }
  };

  if (!task) return <p className="py-8 text-center text-sm text-ink-400">Chargement…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-ink-900">{task.title}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${TASK_STATUS_CLS[task.status] || ''}`}>{TASK_STATUS[task.status] || task.status}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${TASK_PRIORITY_CLS[task.priority] || ''}`}>Priorité {TASK_PRIORITY[task.priority] || task.priority}</span>
            {task.project_name && <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">📁 {task.project_name}</span>}
            {task.due_date && (
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${task.status !== 'terminee' && task.due_date < new Date().toISOString().slice(0, 10) ? 'bg-red-100 text-red-700' : 'bg-ink-100 text-ink-600'}`}>
                Échéance {frTaskDate(task.due_date)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <p className="text-ink-500">👤 {task.assignee_name || 'Non assignée'}</p>
        {task.assignee_position && <p className="text-ink-500">🏷 {task.assignee_position}</p>}
        <p className="text-ink-500">📅 Créée le {frTaskDate(task.created_at)}</p>
        <p className="text-ink-500">✅ {task.completed_at ? `Terminée le ${frTaskDate(task.completed_at)}` : 'Non terminée'}</p>
      </div>
      {task.description && (
        <div className="rounded-xl bg-cream px-4 py-3 text-sm text-ink-700">{task.description}</div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Historique des échanges ({task.notes.length})</p>
        <ul className="max-h-56 space-y-2 overflow-y-auto">
          {task.notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-cream px-4 py-2.5 text-sm">
              <p className="text-xs font-bold text-brand-700">{n.author_name || 'Inconnu'} — {frTaskDate(n.created_at)}</p>
              <p className="mt-0.5 text-ink-700">{n.body}</p>
            </li>
          ))}
          {task.notes.length === 0 && <p className="text-sm text-ink-400">Aucun commentaire pour le moment.</p>}
        </ul>
        <div className="mt-2 flex gap-2">
          <input className="input" placeholder="Ajouter un commentaire / point d'avancement…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} />
          <button className="btn-ghost shrink-0 !px-4 text-sm" onClick={addNote} disabled={!note.trim()}>Ajouter</button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4">
        {task.status === 'a_faire' && <button className="btn-ghost !px-4 !py-2.5 text-sm" onClick={() => setStatus('en_cours')}>▶ Commencer</button>}
        {task.status === 'en_cours' && <button className="btn-ghost !px-4 !py-2.5 text-sm" onClick={() => setStatus('a_faire')}>↩ Remettre à faire</button>}
        {task.status !== 'terminee'
          ? <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => setStatus('terminee')}>✓ Marquer terminée</button>
          : <button className="btn-ghost !px-4 !py-2.5 text-sm" onClick={() => setStatus('en_cours')}>↻ Rouvrir</button>}
        <button className="btn-ghost !px-4 !py-2.5 text-sm" onClick={download}>⬇ Fiche PDF</button>
        <button className="btn-ghost !px-4 !py-2.5 text-sm" onClick={() => onEdit(task)}>✎ Modifier</button>
        <button className="btn-ghost !px-4 !py-2.5 !text-red-600 text-sm" onClick={remove}>Supprimer</button>
      </div>
    </div>
  );
}

function TasksTab({ employees }) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [fProject, setFProject] = useState('');
  const [fAssignee, setFAssignee] = useState('');
  const [formModal, setFormModal] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const p = {};
    if (fProject) p.project_id = fProject;
    if (fAssignee) p.assignee_id = fAssignee;
    api.grh.tasks.list(p).then(setTasks).catch((e) => setError(e.message));
  }, [fProject, fAssignee]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.grh.projects.list().then(setProjects).catch(() => {});
  }, []);

  const quickStatus = async (t, status) => {
    try {
      await api.grh.tasks.setStatus(t.id, status);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const columns = Object.keys(TASK_STATUS).map((status) => ({
    status,
    label: TASK_STATUS[status],
    items: tasks.filter((t) => t.status === status)
  }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <select className="input !w-56 !py-2.5 text-sm" value={fProject} onChange={(e) => setFProject(e.target.value)}>
          <option value="">Tous les projets</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className="input !w-56 !py-2.5 text-sm" value={fAssignee} onChange={(e) => setFAssignee(e.target.value)}>
          <option value="">Tous les employés</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>
        <button className="btn-primary ml-auto !px-5 !py-2.5 text-sm" onClick={() => setFormModal({})}>+ Nouvelle tâche</button>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => (
          <div key={col.status} className="rounded-2xl bg-cream/70 p-3">
            <div className="mb-3 flex items-center justify-between px-2">
              <p className="font-display text-sm font-bold text-ink-700">
                {col.label}
              </p>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${TASK_STATUS_CLS[col.status]}`}>{col.items.length}</span>
            </div>
            <div className="space-y-2.5">
              {col.items.map((t) => {
                const overdue = t.due_date && t.status !== 'terminee' && t.due_date < today;
                return (
                  <div key={t.id} className="card cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:shadow-soft" onClick={() => setDetailId(t.id)}>
                    <p className="text-sm font-bold text-ink-900">{t.title}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.project_name && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">📁 {t.project_name}</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TASK_PRIORITY_CLS[t.priority] || ''}`}>{TASK_PRIORITY[t.priority] || t.priority}</span>
                      {t.due_date && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${overdue ? 'bg-red-100 text-red-700' : 'bg-ink-100 text-ink-500'}`}>
                          {overdue ? '⚠ ' : ''}{frTaskDate(t.due_date)}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <span className="truncate text-xs text-ink-500">
                        {t.assignee_name || 'Non assignée'}
                        {t.notes_count != null && t.notes_count > 0 && ` · 💬 ${t.notes_count}`}
                      </span>
                      <span className="flex gap-1">
                        {t.status === 'a_faire' && (
                          <button title="Passer en cours" onClick={() => quickStatus(t, 'en_cours')} className="rounded-lg bg-accent-50 px-2 py-1 text-xs font-bold text-accent-800 hover:bg-accent-100">▶</button>
                        )}
                        {t.status !== 'terminee' && (
                          <button title="Marquer terminée" onClick={() => quickStatus(t, 'terminee')} className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100">✓</button>
                        )}
                        {t.status === 'terminee' && (
                          <button title="Rouvrir" onClick={() => quickStatus(t, 'en_cours')} className="rounded-lg bg-ink-50 px-2 py-1 text-xs font-bold text-ink-600 hover:bg-ink-100">↻</button>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
              {col.items.length === 0 && (
                <p className="rounded-xl border border-dashed border-ink-200 py-6 text-center text-xs text-ink-400">Aucune tâche</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!formModal} onClose={() => setFormModal(null)} title={formModal?.id ? `Modifier — ${formModal.title}` : 'Nouvelle tâche'} wide>
        {formModal && (
          <TaskFormModal initial={formModal} employees={employees} projects={projects} onSaved={load} onClose={() => setFormModal(null)} />
        )}
      </Modal>

      <Modal open={detailId != null} onClose={() => setDetailId(null)} title="Détail de la tâche" wide>
        {detailId != null && (
          <TaskDetailModal
            taskId={detailId}
            onChanged={load}
            onEdit={(t) => { setDetailId(null); setFormModal({ ...t }); }}
            onClose={() => setDetailId(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function ChatTab() {
  const [threads, setThreads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const loadThreads = useCallback(() => {
    api.grh.chat.threads().then(setThreads).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { loadThreads(); }, [loadThreads]);
  useEffect(() => {
    const id = setInterval(loadThreads, 20000);
    return () => clearInterval(id);
  }, [loadThreads]);
  useEffect(() => {
    if (selected == null) { setMessages([]); return; }
    api.grh.chat.thread(selected).then((m) => { setMessages(m); loadThreads(); }).catch((e) => setError(e.message));
  }, [selected]);

  const send = async () => {
    if (!input.trim() || selected == null) return;
    try {
      await api.grh.chat.send(selected, input.trim());
      setInput('');
      const m = await api.grh.chat.thread(selected);
      setMessages(m);
      loadThreads();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 bg-cream/70 px-5 py-4">
          <h3 className="font-display text-base font-bold text-ink-900">Messagerie</h3>
          <p className="text-xs text-ink-400">Échanges avec chaque employé</p>
        </div>
        <ul className="max-h-[560px] overflow-y-auto">
          {threads.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => setSelected(t.id)}
                className={`flex w-full items-start gap-3 border-b border-ink-50 px-4 py-3 text-left transition-colors ${selected === t.id ? 'bg-brand-50' : 'hover:bg-cream/60'}`}
              >
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700">
                  {t.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-ink-900">{t.full_name}</span>
                    {t.unread > 0 && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-extrabold text-white">{t.unread}</span>}
                  </span>
                  <span className="block truncate text-xs text-ink-400">{t.position || 'Employé(e)'}</span>
                  {t.last_body && <span className="mt-0.5 block truncate text-xs text-ink-500">{t.last_body}</span>}
                </span>
              </button>
            </li>
          ))}
          {threads.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-400">Aucun employé.</p>}
        </ul>
      </div>

      <div className="card flex min-h-[420px] flex-col overflow-hidden">
        {selected == null ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <span className="text-4xl">💬</span>
              <p className="mt-3 text-sm font-semibold text-ink-500">Sélectionnez un employé pour ouvrir la conversation.</p>
              <p className="text-xs text-ink-400">Les employés voient leurs messages dans leur espace membre.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-ink-100 bg-cream/70 px-5 py-3.5">
              <h3 className="font-display text-base font-bold text-ink-900">{threads.find((t) => t.id === selected)?.full_name}</h3>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-cream/30 px-5 py-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${m.sender === 'admin' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white text-ink-800 ring-1 ring-ink-100'}`}>
                    <p>{m.body}</p>
                    <p className={`mt-1 text-[10px] ${m.sender === 'admin' ? 'text-white/70' : 'text-ink-400'}`}>
                      {m.sender === 'admin' ? (m.sender_name || 'Administration') : 'Employé(e)'} · {new Date(String(m.created_at).replace(' ', 'T') + 'Z').toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && <p className="py-10 text-center text-sm text-ink-400">Aucun message — démarrez la conversation.</p>}
            </div>
            <div className="flex gap-2 border-t border-ink-100 p-4">
              <input
                className="input"
                placeholder="Écrire un message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <button className="btn-primary shrink-0 !px-5 text-sm" onClick={send} disabled={!input.trim()}>Envoyer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AdminDocsTab() {
  const [docs, setDocs] = useState([]);
  const [form, setForm] = useState({ name: '', category: 'autre', expires_on: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.grh.adminDocs.list().then(setDocs).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const fmtSize = (n) => {
    if (n == null) return '';
    if (n < 1024) return `${n} o`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
    return `${(n / 1024 / 1024).toFixed(1)} Mo`;
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await api.grh.adminDocs.upload(file, form);
      setFile(null);
      setForm({ name: '', category: 'autre', expires_on: '' });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const download = async (d) => {
    try {
      await api.grh.adminDocs.download(d.id, d.name + pathExt(d.file));
    } catch (e) {
      alert(e.message);
    }
  };
  const removeDoc = async (d) => {
    if (!confirm(`Supprimer le document « ${d.name} » ?`)) return;
    try {
      await api.grh.adminDocs.remove(d.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const pathExt = (f) => {
    const i = String(f || '').lastIndexOf('.');
    return i >= 0 ? String(f).slice(i) : '';
  };

  const today = new Date().toISOString().slice(0, 10);
  const expSoon = (d) => {
    if (!d.expires_on) return '';
    if (d.expires_on < today) return 'bg-red-100 text-red-700';
    const limit = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    if (d.expires_on <= limit) return 'bg-accent-100 text-accent-800';
    return 'bg-ink-100 text-ink-600';
  };

  return (
    <div className="space-y-5">
      <div className="card p-6">
        <h3 className="mb-4 font-display text-lg font-bold text-ink-900">Déposer un document administratif</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Fichier *">
            <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </Field>
          <Field label="Nom (affiché)">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex. Statuts de l'ONG" />
          </Field>
          <Field label="Catégorie">
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="statut">Statuts / actes officiels</option>
              <option value="contrat">Contrats</option>
              <option value="decision">Décisions</option>
              <option value="rapport">Rapports</option>
              <option value="certificat">Certificats / autorisations</option>
              <option value="autre">Autre</option>
            </select>
          </Field>
          <Field label="Date d'expiration (optionnel)">
            <input className="input" type="date" value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} />
          </Field>
        </div>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        <div className="mt-4 flex justify-end">
          <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={upload} disabled={busy || !file}>
            {busy ? 'Dépôt…' : '⬆ Déposer le document'}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-cream/70 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-4">Document</th>
                <th className="px-6 py-4">Catégorie</th>
                <th className="px-6 py-4">Taille</th>
                <th className="px-6 py-4">Expiration</th>
                <th className="px-6 py-4">Déposé par</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                  <td className="px-6 py-4 font-semibold text-ink-900">
                    <span className="mr-2">{d.mime?.includes('pdf') ? '📄' : d.mime?.startsWith('image/') ? '🖼' : '📁'}</span>
                    {d.name}
                  </td>
                  <td className="px-6 py-4 text-ink-600">{d.category}</td>
                  <td className="px-6 py-4 text-ink-600">{fmtSize(d.size)}</td>
                  <td className="px-6 py-4">
                    {d.expires_on
                      ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${expSoon(d)}`}>{frTaskDate(d.expires_on)}</span>
                      : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-6 py-4 text-ink-600">{d.created_by_name || '—'}</td>
                  <td className="px-6 py-4 text-ink-600">{frTaskDate(d.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => download(d)} className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100">⬇ Télécharger</button>
                      <button onClick={() => removeDoc(d)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" title="Supprimer">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {docs.length === 0 && <p className="py-12 text-center text-ink-400">Aucun document administratif déposé.</p>}
      </div>
    </div>
  );
}


function AttendanceForm({ initial, onSaved, onClose }) {
  const [f, setF] = useState({
    date: initial.date ?? '',
    clock_in: initial.clock_in ? String(initial.clock_in).slice(11, 16) : '',
    clock_out: initial.clock_out ? String(initial.clock_out).slice(11, 16) : ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.grh.attendance.update(initial.id, {
        date: f.date,
        clock_in: f.clock_in,
        clock_out: f.clock_out
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-500">
        Corriger le pointage de <strong>{initial.employee_name}</strong> (ex. oubli de présence, horaires particuliers).
        Les pointages corrigés sont signalés dans le tableau.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date *">
          <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Heure de début *">
          <input className="input" type="time" value={f.clock_in} onChange={(e) => setF({ ...f, clock_in: e.target.value })} />
        </Field>
        <Field label="Heure de fin">
          <input className="input" type="time" value={f.clock_out} onChange={(e) => setF({ ...f, clock_out: e.target.value })} />
        </Field>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={saving || !f.date || !f.clock_in}>
          {saving ? 'Enregistrement…' : 'Enregistrer la correction'}
        </button>
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

function AttendanceTab({ employees }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [fEmp, setFEmp] = useState('');
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    const p = {};
    if (/^\d{4}-\d{2}$/.test(month)) p.month = month;
    if (fEmp) p.employee_id = fEmp;
    api.grh.attendance.list(p).then(setRows).catch((e) => setError(e.message));
  }, [month, fEmp]);
  useEffect(() => { load(); }, [load]);

  const removeRow = async (r) => {
    if (!confirm(`Supprimer le pointage de ${r.employee_name} du ${fmtDate(r.date)} ?`)) return;
    try {
      await api.grh.attendance.remove(r.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const exportCsv = async () => {
    try {
      setMsg('');
      await api.grh.attendance.exportCsv(month);
      setMsg('✓ Export CSV téléchargé.');
    } catch (e) {
      setError(e.message);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const distinctEmps = new Set(rows.map((r) => r.employee_id)).size;
  const totalMin = rows.reduce((acc, r) => {
    const s = new Date(String(r.clock_in || r.last_seen).replace(' ', 'T') + 'Z').getTime();
    const e = new Date(String(r.clock_out || r.last_seen).replace(' ', 'T') + 'Z').getTime();
    return acc + (isNaN(s) || isNaN(e) || e < s ? 0 : Math.round((e - s) / 60000));
  }, 0);

  return (
    <div className="space-y-5">
      <p className="rounded-2xl border border-accent-200 bg-accent-50 px-5 py-3.5 text-sm font-semibold text-accent-900">
        Pointage automatique : l’heure de début est la première activité de la journée dans « Mon espace » de l’employé ;
        l’heure de fin est sa dernière activité. Vous pouvez corriger chaque pointage ou l’exporter.
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-ink-950/5">
        <label className="px-1 text-sm font-bold text-ink-500">Mois</label>
        <input type="month" className="input !w-44 !py-2.5" value={month} onChange={(e) => setMonth(e.target.value)} />
        <select className="input !w-56 !py-2.5 text-sm" value={fEmp} onChange={(e) => setFEmp(e.target.value)}>
          <option value="">Tous les employés</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>
        <button className="btn-ghost !px-4 !py-2 text-sm" onClick={exportCsv} disabled={rows.length === 0}>Export CSV</button>
        <div className="ml-auto flex flex-wrap gap-2 text-xs font-bold text-ink-500">
          <span className="rounded-full bg-brand-50 px-3 py-1.5 text-brand-700">{rows.length} jour(s) pointé(s)</span>
          <span className="rounded-full bg-brand-50 px-3 py-1.5 text-brand-700">{distinctEmps} employé(s)</span>
          <span className="rounded-full bg-accent-100 px-3 py-1.5 text-accent-800">
            Total : {Math.floor(totalMin / 60)} h {String(totalMin % 60).padStart(2, '0')}
          </span>
        </div>
      </div>

      {msg && <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">{msg}</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      <GrhSection title={`Pointages — ${monthLabelFr(month)}`} padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-cream/40 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Employé</th>
                <th className="px-6 py-3.5">Début</th>
                <th className="px-6 py-3.5">Fin</th>
                <th className="px-6 py-3.5">Durée</th>
                <th className="px-6 py-3.5">Type</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ongoing = r.date === today && !r.clock_out;
                return (
                  <tr key={r.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                    <td className="px-6 py-4 font-bold text-ink-700">{fmtDate(r.date)}</td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-ink-900">{r.employee_name}</p>
                      <p className="text-xs text-ink-400">{r.employee_position || ''}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-ink-700">{attHm(r.clock_in) || '—'}</td>
                    <td className="px-6 py-4 font-mono text-ink-700">
                      {ongoing
                        ? <span className="font-bold text-accent-800">{attHm(r.last_seen)} (en cours)</span>
                        : attHm(r.clock_out || r.last_seen) || '—'}
                    </td>
                    <td className="px-6 py-4 font-bold text-brand-700">{attDuration(r) || '—'}</td>
                    <td className="px-6 py-4">
                      {r.corrected
                        ? <span className="rounded-full bg-accent-100 px-3 py-1 text-xs font-bold text-accent-800">Corrigé</span>
                        : <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-bold text-ink-500">Automatique</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setModal(r)} className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100">
                          Corriger
                        </button>
                        <button onClick={() => removeRow(r)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" title="Supprimer">
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="py-12 text-center text-ink-400">
            Aucun pointage pour {monthLabelFr(month)} — les présences apparaissent dès qu’un employé utilise son espace de travail.
          </p>
        )}
      </GrhSection>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal ? `Corriger le pointage — ${modal.employee_name}` : ''}>
        {modal && <AttendanceForm initial={modal} onSaved={load} onClose={() => setModal(null)} />}
      </Modal>
    </div>
  );
}

export default function GrhAdmin() {
  const isSuper = getSavedUser()?.role === 'super_admin';
  const [tab, setTab] = useState('overview');
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [overview, setOverview] = useState(null);

  const [q, setQ] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLeaveStatus, setFilterLeaveStatus] = useState('');

  const [empModal, setEmpModal] = useState(null);
  const [fileModal, setFileModal] = useState(null);
  const [leaveModal, setLeaveModal] = useState(null);
  const [newDept, setNewDept] = useState('');
  const [orgTree, setOrgTree] = useState([]);
  const [calMonth, setCalMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [leavesMonth, setLeavesMonth] = useState([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [em, de, le, ov, og] = await Promise.all([
        api.grh.employees.list(),
        api.grh.departments.list(),
        api.grh.leaves.list(),
        api.grh.overview(),
        api.grh.orgchart()
      ]);
      setEmployees(em);
      setDepartments(de);
      setLeaves(le);
      setOverview(ov);
      setOrgTree(og);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    api.grh.leaves.list({ month: calMonth, status: 'approuve' })
      .then(setLeavesMonth)
      .catch(() => setLeavesMonth([]));
  }, [calMonth, tab]);

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((e) => e.full_name?.toLowerCase().includes(s) || e.email?.toLowerCase().includes(s) || e.position?.toLowerCase().includes(s));
    }
    if (filterDept) list = list.filter((e) => String(e.department_id) === String(filterDept));
    if (filterStatus) list = list.filter((e) => e.status === filterStatus);
    return list;
  }, [employees, q, filterDept, filterStatus]);

  const filteredLeaves = useMemo(
    () => (filterLeaveStatus ? leaves.filter((l) => l.status === filterLeaveStatus) : leaves),
    [leaves, filterLeaveStatus]
  );

  const maxDept = Math.max(1, ...(overview?.byDept || []).map((d) => d.n));
  const contractSlices = useMemo(
    () =>
      (overview?.byContract || [])
        .map((r) => ({
          key: r.type,
          value: Number(r.n || 0),
          color: CONTRACT_COLORS[r.type] || '#94a3b8',
          label: CONTRACTS[r.type] || r.type
        }))
        .filter((s) => s.value > 0),
    [overview]
  );
  const leaveSlices = useMemo(
    () =>
      (overview?.leavesByType || [])
        .map((r) => ({
          key: r.type,
          value: Number(r.n || 0),
          color: LEAVE_COLORS[r.type] || '#94a3b8',
          label: LEAVE_TYPES[r.type] || r.type
        }))
        .filter((s) => s.value > 0),
    [overview]
  );
  const hireYear = (overview?.hires_series || []).reduce((a, p) => a + Number(p.n || 0), 0);
  const maxLeaveType = Math.max(1, ...leaveSlices.map((s) => s.value));

  const shiftMonth = (delta) => {
    const [y, m] = calMonth.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setCalMonth(d.toISOString().slice(0, 7));
  };
  const monthLabel = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  const leavesOnDay = (day) => {
    const ds = `${calMonth}-${String(day).padStart(2, '0')}`;
    return leavesMonth.filter((l) => l.start_date <= ds && (!l.end_date || l.end_date >= ds));
  };

  const quickSetLeaveStatus = async (l, status) => {
    try {
      await api.grh.leaves.update(l.id, { status });
      loadAll();
    } catch (e) {
      alert(e.message);
    }
  };

  const removeEmployee = async (e) => {
    if (!confirm(`Supprimer la fiche de « ${e.full_name} » ? Ses congés seront également supprimés.`)) return;
    try {
      await api.grh.employees.remove(e.id);
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  const removeLeave = async (l) => {
    if (!confirm('Supprimer ce congé ?')) return;
    try {
      await api.grh.leaves.remove(l.id);
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  const addDepartment = async () => {
    const name = newDept.trim();
    if (!name) return;
    try {
      await api.grh.departments.create({ name });
      setNewDept('');
      loadAll();
    } catch (e) {
      alert(e.message);
    }
  };

  const renameDepartment = async (d, name) => {
    try {
      await api.grh.departments.update(d.id, { name });
      loadAll();
    } catch (e) {
      alert(e.message);
    }
  };

  const removeDepartment = async (d) => {
    if (!confirm(`Supprimer le département « ${d.name} » ?`)) return;
    try {
      await api.grh.departments.remove(d.id);
      loadAll();
    } catch (e) {
      alert(e.message);
    }
  };

  const visibleTabs = TABS.filter((t) => t.id !== 'payroll' || isSuper);
  const activeId = visibleTabs.some((t) => t.id === tab) ? tab : 'overview';
  const activeTab = visibleTabs.find((t) => t.id === activeId) || visibleTabs[0];
  const groups = [...new Set(visibleTabs.map((t) => t.group))];

  if (!loaded) return <PageTitle title="GRH" />;

  if (error)
    return (
      <div className="mx-auto max-w-lg overflow-hidden rounded-2xl bg-white p-8 text-center ring-1 ring-ink-950/5">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600">
          <TabIcon d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </span>
        <p className="mt-4 text-sm font-bold text-ink-900">{error}</p>
        <p className="mt-2 text-sm text-ink-500">
          Si le module GRH a été désactivé par le super administrateur, demandez-lui de le réactiver
          (Paramètres → Modules).
        </p>
        <button className="btn-ghost mt-5 text-sm" onClick={loadAll}>Réessayer</button>
      </div>
    );

  return (
    <div>
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside className="mb-6 lg:sticky lg:top-24 lg:mb-0">
          {groups.map((g) => (
            <div key={g} className="mb-5 last:mb-0">
              <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">{g}</p>
              <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                {visibleTabs.filter((t) => t.group === g).map((t) => {
                  const on = activeId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors lg:w-full ${
                        on ? 'bg-white text-brand-800 shadow-soft ring-1 ring-brand-100' : 'text-ink-600 hover:bg-white/70'
                      }`}
                    >
                      <span className={`relative grid h-9 w-9 place-items-center rounded-lg ${on ? 'bg-brand-600 text-white' : 'bg-white text-ink-500 ring-1 ring-ink-100'}`}>
                        <TabIcon d={t.icon} />
                        {t.id === 'leaves' && overview?.leavesPending > 0 && (
                          <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent-400 px-1 text-[9px] font-black text-ink-950">
                            {overview.leavesPending}
                          </span>
                        )}
                      </span>
                      <span className="hidden min-w-0 lg:block">
                        <span className="block text-sm font-bold">{t.label}</span>
                        <span className="block text-[11px] font-medium text-ink-400">{t.hint}</span>
                      </span>
                      <span className="text-sm font-bold lg:hidden">{t.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </aside>

        <div>
          <div className="sticky top-16 z-20 -mx-4 mb-6 border-b border-ink-100 bg-[#f4f6fb]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-2xl lg:border lg:bg-white/90 lg:px-5 lg:shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-ink-900">{activeTab.label}</h2>
                <p className="text-sm text-ink-400">{activeTab.hint}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeId === 'employees' && (
                  <button type="button" className="btn-primary !px-5 !py-2 text-sm" onClick={() => setEmpModal({ ...emptyEmployee })}>
                    + Ajouter un employé
                  </button>
                )}
                {activeId === 'leaves' && (
                  <button type="button" className="btn-primary !px-5 !py-2 text-sm" onClick={() => setLeaveModal({ ...emptyLeave })}>
                    + Demander un congé
                  </button>
                )}
                {activeId === 'overview' && (
                  <button type="button" className="btn-ghost !px-4 !py-2 text-sm" onClick={() => setTab('employees')}>
                    Voir l’équipe
                  </button>
                )}
                {activeId === 'departments' && (
                  <button type="button" className="btn-ghost !px-4 !py-2 text-sm" onClick={() => setTab('employees')}>
                    Voir l’équipe
                  </button>
                )}
              </div>
            </div>
          </div>

      {activeId === 'overview' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
            <GrhKpi
              icon={TABS.find((t) => t.id === 'employees').icon}
              label="Actifs"
              value={overview?.active ?? '—'}
              hint={`${overview?.inactive ?? 0} inactif${(overview?.inactive || 0) > 1 ? 's' : ''} · ${overview?.total ?? 0} total`}
              onClick={() => setTab('employees')}
            />
            <GrhKpi
              icon={TABS.find((t) => t.id === 'leaves').icon}
              label="Congés à valider"
              value={overview?.leavesPending ?? '—'}
              hint="Demandes en attente"
              tone="bg-amber-50 text-amber-800"
              onClick={() => setTab('leaves')}
            />
            <GrhKpi
              icon="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              label="Absents aujourd’hui"
              value={overview?.leavesOngoing ?? '—'}
              hint="Congés en cours"
              tone="bg-accent-50 text-accent-800"
              onClick={() => setTab('leaves')}
            />
            <GrhKpi
              icon={TABS.find((t) => t.id === 'attendance').icon}
              label="Présents"
              value={overview?.presentToday ?? '—'}
              hint="Pointages du jour"
              tone="bg-ink-50 text-ink-600"
              onClick={() => setTab('attendance')}
            />
            <GrhKpi
              icon={TABS.find((t) => t.id === 'recruit').icon}
              label="Candidats"
              value={overview?.candidatesOpen ?? '—'}
              hint="Reçus ou en entretien"
              tone="bg-accent-50 text-accent-800"
              onClick={() => setTab('recruit')}
            />
            <GrhKpi
              icon={TABS.find((t) => t.id === 'tasks').icon}
              label="Tâches ouvertes"
              value={overview?.tasksOpen ?? '—'}
              hint={`${overview?.projectsActive ?? 0} projet${(overview?.projectsActive || 0) > 1 ? 's' : ''} en cours`}
              tone="bg-ink-50 text-ink-600"
              onClick={() => setTab('tasks')}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 p-5 text-white">
              <div
                className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full opacity-30"
                style={{ background: 'radial-gradient(circle, #fc7a03 0%, transparent 70%)' }}
              />
              <p className="text-[11px] font-bold tracking-[0.16em] text-white/55 uppercase">Effectif actif</p>
              <p className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-accent-300">
                {overview?.active ?? 0}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/70">
                {departments.length} département{departments.length > 1 ? 's' : ''}
                {(overview?.leavesOngoing || 0) > 0 && <> · {overview.leavesOngoing} en congé</>}
              </p>
              <p className="mt-4 text-[11px] font-semibold text-white/50">
                {overview?.presentToday ?? 0} présent{(overview?.presentToday || 0) > 1 ? 's' : ''} aujourd’hui
              </p>
              <button
                type="button"
                onClick={() => setTab('employees')}
                className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-accent-300 hover:text-white"
              >
                Voir l’équipe
                <TabIcon d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" className="h-4 w-4" />
              </button>
            </div>

            <GrhCard
              className="lg:col-span-2"
              title="Embauches — 12 mois"
              action={<span className="text-xs font-bold text-ink-400">{hireYear} arrivée{hireYear > 1 ? 's' : ''}</span>}
            >
              {hireYear === 0 ? (
                <p className="py-10 text-center text-sm text-ink-400">Aucune embauche sur la période.</p>
              ) : (
                <GrhBars series={overview?.hires_series || []} />
              )}
            </GrhCard>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <GrhCard title="Contrats">
              {contractSlices.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-400">Aucun employé actif.</p>
              ) : (
                <div className="flex items-center gap-4">
                  <GrhDonut slices={contractSlices} unit="actifs" />
                  <ul className="min-w-0 flex-1 space-y-2">
                    {contractSlices.map((s) => (
                      <li key={s.key} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-2 font-semibold text-ink-600">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                          <span className="truncate">{s.label}</span>
                        </span>
                        <span className="font-extrabold text-ink-900">{s.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </GrhCard>

            <GrhCard
              title="Par département"
              action={
                <button type="button" className="text-xs font-bold text-brand-600 hover:underline" onClick={() => setTab('departments')}>
                  Gérer
                </button>
              }
            >
              {(overview?.byDept || []).length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-400">Aucun employé actif.</p>
              ) : (
                <ul className="space-y-2.5">
                  {(overview?.byDept || []).map((d) => (
                    <li key={d.name} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-xs font-bold text-ink-700">{d.name}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-50">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.max(8, (d.n / maxDept) * 100)}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-xs font-extrabold text-ink-900">{d.n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </GrhCard>

            <GrhCard title="Congés validés" action={<span className="text-[11px] font-bold text-ink-400">Cette année</span>}>
              {leaveSlices.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-400">Aucun congé validé.</p>
              ) : (
                <ul className="space-y-2.5">
                  {leaveSlices.map((s) => (
                    <li key={s.key}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold text-ink-700">{s.label}</span>
                        <span className="font-extrabold text-ink-900">{s.value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-ink-50">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(8, (s.value / maxLeaveType) * 100)}%`, background: s.color }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </GrhCard>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <GrhCard
              title="Dernières embauches"
              action={
                <button type="button" className="text-xs font-bold text-brand-600 hover:underline" onClick={() => setTab('employees')}>
                  Équipe
                </button>
              }
            >
              {(overview?.recentHires || []).length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-400">Aucune embauche enregistrée.</p>
              ) : (
                <ul className="divide-y divide-ink-50">
                  {(overview?.recentHires || []).map((h) => (
                    <li key={h.id || h.full_name} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      {h.photo ? (
                        <img src={h.photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-ink-100" />
                      ) : (
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-[10px] font-extrabold text-brand-700">
                          {String(h.full_name || '?').slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink-800">{h.full_name}</p>
                        <p className="truncate text-[11px] font-semibold text-ink-400">{h.position || '—'}</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold text-ink-400">{fmtDate(h.hire_date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </GrhCard>

            <GrhCard
              title="Prochains congés"
              action={
                <button type="button" className="text-xs font-bold text-brand-600 hover:underline" onClick={() => setTab('leaves')}>
                  Congés
                </button>
              }
            >
              {(overview?.upcomingLeaves || []).length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-400">Aucun congé à venir.</p>
              ) : (
                <ul className="divide-y divide-ink-50">
                  {(overview?.upcomingLeaves || []).map((l, i) => (
                    <li key={`${l.full_name}-${l.start_date}-${i}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink-800">{l.full_name}</p>
                        <p className="truncate text-[11px] font-semibold text-ink-400">{LEAVE_TYPES[l.type] || l.type}</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold text-ink-400">
                        {fmtDate(l.start_date)}{l.end_date ? ` → ${fmtDate(l.end_date)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </GrhCard>
          </div>
        </div>
      )}

      {activeId === 'employees' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-ink-950/5">
            <input
              className="input !w-56 !py-2.5 text-sm"
              placeholder="Rechercher (nom, email, fonction)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="input !w-44 !py-2.5 text-sm" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">Tous les départements</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select className="input !w-36 !py-2.5 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Tous statuts</option>
              <option value="actif">Actifs</option>
              <option value="inactif">Inactifs</option>
            </select>
            <span className="ml-auto px-2 text-xs font-bold text-ink-400">{filteredEmployees.length} fiche{filteredEmployees.length > 1 ? 's' : ''}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredEmployees.map((e) => (
              <div key={e.id} className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-ink-950/5 transition-shadow hover:shadow-soft">
                <div className="flex gap-4 p-5">
                  {e.photo ? (
                    <img src={e.photo} alt={e.full_name} className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-brand-50" />
                  ) : (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-50 font-display text-lg font-bold text-brand-700">
                      {e.full_name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-display font-bold text-ink-900">{e.full_name}</p>
                        <p className="truncate text-sm text-ink-500">{e.position || 'Fonction non renseignée'}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${e.status === 'actif' ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>
                        {e.status === 'actif' ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-ink-400">
                      <p className="truncate">{e.department || 'Non affecté'} · {CONTRACTS[e.contract_type] || e.contract_type}</p>
                      {e.hire_date && <p>Depuis le {fmtDate(e.hire_date)}</p>}
                      {(e.email || e.phone) && (
                        <p className="truncate">{e.email}{e.email && e.phone ? ' · ' : ''}{e.phone}</p>
                      )}
                      {isSuper && e.salary != null && (
                        <p className="font-bold text-accent-800">{Number(e.salary).toLocaleString('fr-FR')} {e.salary_currency}/mois</p>
                      )}
                      <p>
                        Congés restants :{' '}
                        <span className={e.balance && e.balance.remaining < 0 ? 'font-bold text-red-600' : 'font-bold text-brand-700'}>
                          {e.balance?.remaining ?? '—'} j
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-auto flex gap-2 border-t border-ink-50 px-5 py-3">
                  <button
                    onClick={() => setFileModal(e)}
                    className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100"
                  >
                    Dossier
                  </button>
                  <button
                    onClick={() => setEmpModal({ ...e, salary: e.salary ?? '' })}
                    className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100"
                  >
                    Modifier
                  </button>
                </div>
              </div>
            ))}
          </div>
          {filteredEmployees.length === 0 && (
            <p className="rounded-2xl border border-dashed border-ink-200 bg-white py-12 text-center text-ink-400">
              Aucun employé ne correspond aux filtres.
            </p>
          )}
        </div>
      )}

      {activeId === 'orgchart' && (
        <GrhSection
          title="Hiérarchie"
          desc="Cliquez sur un nom pour ouvrir le dossier. Le supérieur se renseigne dans la fiche employé."
        >
          {orgTree.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">Aucun employé — ajoutez des membres dans Équipe.</p>
          ) : (
            <ul className="space-y-2">
              {orgTree.map((n) => (
                <OrgNode key={n.id} node={n} onOpenFile={setFileModal} />
              ))}
            </ul>
          )}
        </GrhSection>
      )}

      {activeId === 'payroll' && isSuper && (
        <PayrollTab employees={employees} onChanged={loadAll} />
      )}

      {activeId === 'attendance' && (
        <AttendanceTab employees={employees} />
      )}

      {activeId === 'recruit' && (
        <RecruitTab departments={departments} onChanged={loadAll} />
      )}

      {activeId === 'evaluations' && (
        <EvaluationTab employees={employees} />
      )}

      {activeId === 'trainings' && (
        <TrainingTab employees={employees} />
      )}

      {activeId === 'announcements' && (
        <AnnouncementTab />
      )}

      {activeId === 'leaves' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {['', ...Object.keys(LEAVE_STATUS)].map((st) => (
              <button
                key={st || 'all'}
                onClick={() => setFilterLeaveStatus(st)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                  filterLeaveStatus === st ? 'bg-brand-600 text-white shadow-soft' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:ring-brand-300'
                }`}
              >
                {st ? LEAVE_STATUS[st] : 'Tous'}
              </button>
            ))}
          </div>

          <GrhSection
            title="Calendrier — congés approuvés"
            action={
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => shiftMonth(-1)} className="grid h-9 w-9 place-items-center rounded-lg bg-ink-50 font-bold text-ink-600 hover:bg-ink-100">←</button>
                <span className="w-40 text-center text-sm font-bold capitalize text-ink-700">{monthLabel(calMonth)}</span>
                <button type="button" onClick={() => shiftMonth(1)} className="grid h-9 w-9 place-items-center rounded-lg bg-ink-50 font-bold text-ink-600 hover:bg-ink-100">→</button>
              </div>
            }
          >
            {(() => {
              const [y, m] = calMonth.split('-').map(Number);
              const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
              const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
              const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
              return (
                <div>
                  <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold tracking-wide text-ink-400 uppercase">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                      <div key={d} className="py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {cells.map((day, i) =>
                      day === null ? (
                        <div key={`x${i}`} />
                      ) : (
                        <div key={day} className={`min-h-[68px] rounded-lg p-1.5 ${i % 7 >= 5 ? 'bg-ink-50/60' : 'bg-cream'}`}>
                          <span className="text-[10px] font-bold text-ink-400">{day}</span>
                          {leavesOnDay(day).slice(0, 2).map((l) => (
                            <p
                              key={l.id}
                              className={`mt-0.5 truncate rounded px-1 py-0.5 text-[10px] font-semibold ${
                                l.type === 'conge' ? 'bg-brand-100 text-brand-700' : 'bg-accent-100 text-accent-800'
                              }`}
                              title={`${l.employee_name} — ${LEAVE_TYPES[l.type] || l.type}`}
                            >
                              {l.employee_name.split(' ')[0]}
                            </p>
                          ))}
                          {leavesOnDay(day).length > 2 && (
                            <p className="text-[9px] font-bold text-ink-400">+{leavesOnDay(day).length - 2}</p>
                          )}
                        </div>
                      )
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-400">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand-100" /> Congé annuel</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-accent-100" /> Autres absences</span>
                  </div>
                </div>
              );
            })()}
          </GrhSection>

          <GrhSection title="Demandes de congé" desc={`${filteredLeaves.length} demande${filteredLeaves.length > 1 ? 's' : ''}`} padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-ink-100 bg-cream/40 text-xs font-bold tracking-wide text-ink-400 uppercase">
                  <tr>
                    <th className="px-6 py-3.5">Employé</th>
                    <th className="px-6 py-3.5">Type</th>
                    <th className="px-6 py-3.5">Période</th>
                    <th className="px-6 py-3.5">Jours</th>
                    <th className="px-6 py-3.5">Motif</th>
                    <th className="px-6 py-3.5">Statut</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.map((l) => (
                    <tr key={l.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-ink-900">{l.employee_name}</p>
                        <p className="text-xs text-ink-400">{l.employee_position || ''}</p>
                      </td>
                      <td className="px-6 py-4 text-ink-600">{LEAVE_TYPES[l.type] || l.type}</td>
                      <td className="px-6 py-4 text-ink-600">
                        {fmtDate(l.start_date)}{l.end_date ? ` → ${fmtDate(l.end_date)}` : ''}
                      </td>
                      <td className="px-6 py-4 font-bold text-ink-700">{l.days || '—'}</td>
                      <td className="max-w-[220px] truncate px-6 py-4 text-ink-500" title={l.reason}>{l.reason || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${LEAVE_STATUS_STYLES[l.status] || 'bg-ink-100 text-ink-600'}`}>
                          {LEAVE_STATUS[l.status] || l.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1.5">
                          {l.status === 'en_attente' && (
                            <>
                              <button onClick={() => quickSetLeaveStatus(l, 'approuve')} className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100">
                                ✓ Approuver
                              </button>
                              <button onClick={() => quickSetLeaveStatus(l, 'rejette')} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                                ✕ Rejeter
                              </button>
                            </>
                          )}
                          <button onClick={() => setLeaveModal({ ...l, employee_id: l.employee_id })} className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100">
                            Éditer
                          </button>
                          <button onClick={() => removeLeave(l)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" title="Supprimer">
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredLeaves.length === 0 && <p className="py-12 text-center text-ink-400">Aucun congé enregistré.</p>}
          </GrhSection>
        </div>
      )}

      {activeId === 'projects' && (
        <ProjectsTab employees={employees.filter((e) => e.status === 'actif')} />
      )}

      {activeId === 'tasks' && (
        <TasksTab employees={employees.filter((e) => e.status === 'actif')} />
      )}

      {activeId === 'chat' && (
        <ChatTab />
      )}

      {activeId === 'admindocs' && (
        <AdminDocsTab />
      )}

      {activeId === 'departments' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <GrhSection title="Nouveau département" desc="Créer un service pour rattacher l’équipe.">
            <div className="flex gap-2">
              <input
                className="input"
                value={newDept}
                placeholder="Ex. Communication, Finance, Projets…"
                onChange={(e) => setNewDept(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addDepartment()}
              />
              <button className="btn-primary shrink-0 !px-5 text-sm" onClick={addDepartment} disabled={!newDept.trim()}>
                Ajouter
              </button>
            </div>
          </GrhSection>
          <GrhSection title={`Départements (${departments.length})`} padded={false}>
            <ul>
              {departments.map((d) => (
                <li key={d.id} className="flex items-center gap-3 border-b border-ink-50 px-6 py-3 last:border-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <TabIcon d={TABS.find((t) => t.id === 'departments').icon} className="h-4 w-4" />
                  </span>
                  <input
                    className="input !w-56 !border-0 !bg-transparent !px-2 !py-1.5 font-semibold text-ink-800 focus:!ring-1"
                    defaultValue={d.name}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== d.name && renameDepartment(d, e.target.value.trim())}
                    onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                  />
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                    {d.employees} actif(s)
                  </span>
                  <button
                    onClick={() => removeDepartment(d)}
                    className="ml-auto rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                    title="Supprimer"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            {departments.length === 0 && <p className="py-10 text-center text-ink-400">Aucun département — ajoutez-en un à gauche.</p>}
          </GrhSection>
        </div>
      )}
        </div>
      </div>

      <Modal open={!!empModal} onClose={() => setEmpModal(null)} title={empModal?.id ? `Modifier — ${empModal.full_name}` : 'Nouvel employé'} wide>
        {empModal && (
          <EmployeeForm
            initial={empModal}
            departments={departments}
            employees={employees.filter((x) => x.status === 'actif')}
            isSuper={isSuper}
            onSaved={loadAll}
            onClose={() => setEmpModal(null)}
          />
        )}
      </Modal>

      <Modal open={!!fileModal} onClose={() => setFileModal(null)} title={`Dossier — ${fileModal?.full_name || ''}`} wide>
        {fileModal && (
          <EmployeeFileModal
            employee={fileModal}
            isSuper={isSuper}
            onChanged={loadAll}
            onClose={() => setFileModal(null)}
          />
        )}
      </Modal>

      <Modal open={!!leaveModal} onClose={() => setLeaveModal(null)} title={leaveModal?.id ? 'Modifier le congé' : 'Nouveau congé'}>
        {leaveModal && (
          <LeaveForm
            initial={leaveModal}
            employees={employees.filter((e) => e.status === 'actif')}
            onSaved={loadAll}
            onClose={() => setLeaveModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}
