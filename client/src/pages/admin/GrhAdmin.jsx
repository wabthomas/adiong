import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getSavedUser } from '../../api.js';
import { PageTitle, Field, Modal, ImageInput } from './AdminUI.jsx';

const TABS = [
  ['overview', 'Vue d’ensemble'],
  ['employees', 'Équipe'],
  ['orgchart', 'Organigramme'],
  ['leaves', 'Congés'],
  ['departments', 'Départements']
];

const CONTRACTS = {
  permanent: 'Permanent (CDI)',
  cdd: 'CDD',
  vacataire: 'Vacataire',
  benevole: 'Bénévole',
  stagiaire: 'Stagiaire'
};
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
const emptyLeave = { employee_id: null, type: 'conge', start_date: '', end_date: '', reason: '', status: 'en_attente' };

const fmtDate = (d) =>
  d ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="card flex items-center gap-4 p-6">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl">{icon}</span>
      <div className="min-w-0">
        <p className="font-display text-2xl font-bold text-ink-900">{value}</p>
        <p className="truncate text-sm font-semibold text-ink-500">{label}</p>
        {sub && <p className="text-xs text-ink-400">{sub}</p>}
      </div>
    </div>
  );
}

function EmployeeForm({ initial, departments, employees = [], isSuper, onSaved, onClose }) {
  const [f, setF] = useState({ ...initial, salary: initial.salary ?? '' });
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
        manager_id: f.manager_id ? Number(f.manager_id) : null,
        annual_days: f.annual_days === '' || f.annual_days == null ? 0 : Number(f.annual_days) || 0,
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

      <Field label="Photo (bibliothèque)">
        <ImageInput label="" value={f.photo || ''} onChange={(v) => setF({ ...f, photo: v })} />
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

function OrgNode({ node, level = 0, onOpenFile }) {
  return (
    <li className="relative">
      <div
        className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-ink-100"
        style={{ marginLeft: level * 26 }}
      >
        {node.photo ? (
          <img src={node.photo} alt={node.full_name} className="h-10 w-10 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 font-display text-sm font-bold text-brand-700">
            {node.full_name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <button className="block max-w-full truncate font-display text-sm font-bold text-ink-900 hover:text-brand-700" onClick={() => onOpenFile(node)}>
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
        <ul className="mt-2 space-y-2 border-l-2 border-brand-100 pl-2" style={{ marginLeft: level * 26 + 24 }}>
          {node.children.map((c) => (
            <OrgNode key={c.id} node={c} level={level + 1} onOpenFile={onOpenFile} />
          ))}
        </ul>
      )}
    </li>
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
    } catch (e) {
      setError(e.message);
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

  if (error)
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-red-50 p-8 text-center">
        <p className="text-sm font-bold text-red-700">{error}</p>
        <p className="mt-2 text-sm text-red-600">
          Si le module GRH a été désactivé par le super administrateur, demandez-lui de le réactiver
          (Paramètres → Modules).
        </p>
        <button className="btn-ghost mt-4 text-sm" onClick={loadAll}>Réessayer</button>
      </div>
    );

  return (
    <div>
      <PageTitle
        title="Gestion RH"
        subtitle="Équipe, départements et congés — module interne, activable par le super administrateur"
      />

      <div className="mb-8 flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
              tab === id ? 'bg-brand-600 text-white shadow-soft' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:ring-brand-300'
            }`}
          >
            {label}
            {id === 'leaves' && (overview?.leavesPending > 0) && (
              <span className="ml-2 rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-black text-ink-950">
                {overview.leavesPending}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon="👥" label="Employés actifs" value={overview?.active ?? '—'} sub={`${overview?.total ?? 0} au total`} />
            <StatCard icon="🏢" label="Départements" value={departments.length} />
            <StatCard icon="⏳" label="Congés en attente" value={overview?.leavesPending ?? '—'} sub="à valider dans l'onglet Congés" />
            <StatCard icon="🌴" label="Congés en cours" value={overview?.leavesOngoing ?? '—'} sub="approuvés et en cours aujourd'hui" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-7">
              <h3 className="mb-5 font-display text-lg font-bold text-ink-900">Effectif par département</h3>
              {(overview?.byDept || []).length === 0 && <p className="text-sm text-ink-400">Aucun employé actif pour le moment.</p>}
              <div className="space-y-4">
                {(overview?.byDept || []).map((d) => (
                  <div key={d.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold text-ink-700">{d.name}</span>
                      <span className="font-bold text-brand-700">{d.n}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(d.n / maxDept) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="card p-7">
                <h3 className="mb-4 font-display text-lg font-bold text-ink-900">Dernières embauches</h3>
                {(overview?.recentHires || []).length === 0 && <p className="text-sm text-ink-400">Aucune embauche enregistrée.</p>}
                <ul className="space-y-3">
                  {(overview?.recentHires || []).map((h, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink-800">{h.full_name}</p>
                        <p className="text-xs text-ink-400">{h.position || '—'}</p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-ink-400">{fmtDate(h.hire_date)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card p-7">
                <h3 className="mb-4 font-display text-lg font-bold text-ink-900">Prochains congés approuvés</h3>
                {(overview?.upcomingLeaves || []).length === 0 && <p className="text-sm text-ink-400">Aucun congé à venir.</p>}
                <ul className="space-y-3">
                  {(overview?.upcomingLeaves || []).map((l, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink-800">{l.full_name}</p>
                        <p className="text-xs text-ink-400">{LEAVE_TYPES[l.type] || l.type}</p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-ink-400">
                        {fmtDate(l.start_date)}{l.end_date ? ` → ${fmtDate(l.end_date)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'employees' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
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
            </div>
            <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => setEmpModal({ ...emptyEmployee })}>
              + Ajouter un employé
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredEmployees.map((e) => (
              <div key={e.id} className="card flex gap-4 p-5">
                {e.photo ? (
                  <img src={e.photo} alt={e.full_name} className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-ink-100" />
                ) : (
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-100 font-display text-lg font-bold text-brand-700">
                    {e.full_name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-display font-bold text-ink-900">{e.full_name}</p>
                      <p className="truncate text-sm text-ink-500">{e.position || 'Fonction non renseignée'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${e.status === 'actif' ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>
                      {e.status === 'actif' ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-ink-400">
                    <p className="truncate">🏢 {e.department || 'Non affecté'}</p>
                    <p>{CONTRACTS[e.contract_type] || e.contract_type}{e.hire_date ? ` · depuis le ${fmtDate(e.hire_date)}` : ''}</p>
                    {(e.email || e.phone) && (
                      <p className="truncate">{e.email}{e.email && e.phone ? ' · ' : ''}{e.phone}</p>
                    )}
                    {isSuper && e.salary != null && (
                      <p className="font-bold text-accent-800">💰 {Number(e.salary).toLocaleString('fr-FR')} {e.salary_currency}/mois</p>
                    )}
                    <p>
                      🌴 Congés restants :{' '}
                      <span className={e.balance && e.balance.remaining < 0 ? 'font-bold text-red-600' : 'font-bold text-brand-700'}>
                        {e.balance?.remaining ?? '—'} j
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col justify-end gap-2">
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
            <p className="py-10 text-center text-ink-400">Aucun employé ne correspond aux filtres.</p>
          )}
        </div>
      )}

      {tab === 'orgchart' && (
        <div className="space-y-6">
          <p className="text-sm text-ink-500">
            Arborescence par supérieur hiérarchique. Cliquez sur un nom pour ouvrir le dossier employé.
            Renseignez le « Supérieur hiérarchique » dans la fiche de chaque employé pour construire l'organigramme.
          </p>
          <div className="card p-6">
            {orgTree.length === 0 ? (
              <p className="py-10 text-center text-ink-400">Aucun employé — ajoutez des membres dans l'onglet Équipe.</p>
            ) : (
              <ul className="space-y-2">
                {orgTree.map((n) => (
                  <OrgNode key={n.id} node={n} onOpenFile={setFileModal} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'leaves' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
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
            <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => setLeaveModal({ ...emptyLeave })}>
              + Demander un congé
            </button>
          </div>

          <div className="card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-lg font-bold text-ink-900">Calendrier — congés approuvés</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => shiftMonth(-1)} className="grid h-9 w-9 place-items-center rounded-lg bg-ink-50 font-bold text-ink-600 hover:bg-ink-100">←</button>
                <span className="w-44 text-center text-sm font-bold text-ink-700 capitalize">{monthLabel(calMonth)}</span>
                <button onClick={() => shiftMonth(1)} className="grid h-9 w-9 place-items-center rounded-lg bg-ink-50 font-bold text-ink-600 hover:bg-ink-100">→</button>
              </div>
            </div>
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
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-ink-100 bg-cream/70 text-xs font-bold tracking-wide text-ink-400 uppercase">
                  <tr>
                    <th className="px-6 py-4">Employé</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Période</th>
                    <th className="px-6 py-4">Jours</th>
                    <th className="px-6 py-4">Motif</th>
                    <th className="px-6 py-4">Statut</th>
                    <th className="px-6 py-4 text-right">Actions</th>
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
          </div>
        </div>
      )}

      {tab === 'departments' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-7">
            <h3 className="mb-4 font-display text-lg font-bold text-ink-900">Nouveau département</h3>
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
          </div>
          <div className="card overflow-hidden">
            <div className="border-b border-ink-100 bg-cream/70 px-6 py-4">
              <h3 className="font-display text-lg font-bold text-ink-900">Départements ({departments.length})</h3>
            </div>
            <ul>
              {departments.map((d) => (
                <li key={d.id} className="flex items-center gap-3 border-b border-ink-50 px-6 py-3 last:border-0">
                  <span className="text-xl">🏢</span>
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
          </div>
        </div>
      )}

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
