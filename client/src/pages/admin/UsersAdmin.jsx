import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getSavedUser, setSavedUser } from '../../api.js';
import { PageTitle, Modal, DeleteButton, Field } from './AdminUI.jsx';
import { emptyUser, ROLE_STYLES, ROLE_LABELS, UserProfileFields, MemberQrCard } from './UserProfileFields.jsx';

const TABS = [
  { id: 'users', label: 'Comptes' },
  { id: 'invites', label: 'Invitations' },
  { id: 'perms', label: 'Rôles & droits' },
  { id: 'security', label: 'Sécurité' }
];

const INVITE_ROLES = [
  ['editor', 'Éditeur'],
  ['viewer', 'Consultation'],
  ['admin', 'Administrateur']
];
const INVITE_STATE = {
  available: { label: 'Disponible', cls: 'bg-brand-100 text-brand-700' },
  used: { label: 'Utilisé', cls: 'bg-ink-100 text-ink-500' },
  expired: { label: 'Expiré', cls: 'bg-accent-100 text-accent-800' }
};
const emptyInvite = { email: '', role: 'editor', label: '', days: 7 };

const ROLE_ORDER = ['super_admin', 'admin', 'editor', 'cashier', 'viewer'];
const ROLE_BLURB = {
  super_admin: 'Accès total',
  admin: 'Site, GRH et caisse',
  editor: 'Contenu et médiathèque',
  cashier: 'Encaissement et stock',
  viewer: 'Lecture seule'
};

function fmtDate(v) {
  if (!v) return '—';
  const s = String(v);
  return new Date(s + (s.includes('T') || s.includes('Z') ? '' : 'Z')).toLocaleDateString('fr-FR');
}
function fmtDateTime(v) {
  if (!v) return '—';
  return new Date(String(v) + (String(v).includes('Z') ? '' : 'Z')).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

function CheckBox({ on, partial }) {
  return (
    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-brand-600 bg-brand-600 text-white' : partial ? 'border-brand-400 bg-brand-100' : 'border-ink-300 bg-white'}`}>
      {on && (
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
        </svg>
      )}
    </span>
  );
}

function PermissionsPanel({ users, onRolesChange }) {
  const [groups, setGroups] = useState([]);
  const [areas, setAreas] = useState([]);
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState(null);
  const [role, setRole] = useState('admin');
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newRole, setNewRole] = useState({ label: '', key: '', description: '' });

  const load = useCallback(() => {
    api.permissions.get().then((d) => {
      setGroups(d.groups || []);
      setAreas(d.areas || []);
      setRows(d.matrix);
      setDraft(d.matrix.map((r) => ({ ...r, permissions: r.permissions.map((p) => ({ ...p })) })));
      setCanEdit(!!d.is_super);
      setRole((cur) => (d.matrix.some((r) => r.role === cur) ? cur : (d.matrix.find((r) => r.role !== 'super_admin')?.role || d.matrix[0]?.role)));
    }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const ordered = useMemo(() => {
    if (!draft) return [];
    const rank = (key) => {
      const i = ROLE_ORDER.indexOf(key);
      return i === -1 ? ROLE_ORDER.length : i;
    };
    return [...draft].sort((a, b) => rank(a.role) - rank(b.role) || String(a.label || a.role).localeCompare(String(b.label || b.role), 'fr'));
  }, [draft]);
  const counts = useMemo(() => {
    const map = {};
    for (const u of users || []) map[u.role] = (map[u.role] || 0) + 1;
    return map;
  }, [users]);

  const current = draft?.find((r) => r.role === role);
  const saved = rows.find((r) => r.role === role);
  const locked = !current || current.locked || !canEdit;
  const dirty = !!(saved && current && JSON.stringify(saved.permissions) !== JSON.stringify(current.permissions));
  const onCount = current?.permissions.filter((p) => p.enabled).length || 0;

  const isOn = (id) => !!current?.permissions.find((p) => p.area === id)?.enabled;

  const setEnabled = (ids, enabled) => {
    const set = new Set(ids);
    setDraft((cur) => cur.map((r) => (
      r.role !== role || r.locked
        ? r
        : { ...r, permissions: r.permissions.map((p) => (set.has(p.area) ? { ...p, enabled } : p)) }
    )));
    setMsg('');
  };

  const toggle = (area) => setEnabled([area], !isOn(area));

  const toggleGroup = (ids) => {
    const allOn = ids.every((id) => isOn(id));
    setEnabled(ids, !allOn);
  };

  const resetRole = () => {
    if (!saved) return;
    setDraft((cur) => cur.map((r) => (
      r.role !== role ? r : { ...saved, permissions: saved.permissions.map((p) => ({ ...p })) }
    )));
    setMsg('');
    setError('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMsg('');
    try {
      const matrix = {};
      draft.filter((r) => !r.locked).forEach((r) => {
        matrix[r.role] = Object.fromEntries(r.permissions.map((p) => [p.area, p.enabled]));
      });
      await api.permissions.save(matrix);
      setMsg(`Droits de « ${current?.label || ROLE_LABELS[role] || role} » enregistrés.`);
      load();
      onRolesChange?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const q = query.trim().toLowerCase();
  const visibleGroups = groups.map((g) => ({
    ...g,
    items: areas.filter((a) => a.group === g.id && (
      !q || a.label.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || g.label.toLowerCase().includes(q)
    ))
  })).filter((g) => g.items.length);

  const slugPreview = (value) => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

  const createRole = async () => {
    setSaving(true);
    setError('');
    try {
      const created = await api.permissions.createRole({
        label: newRole.label,
        key: newRole.key || slugPreview(newRole.label),
        description: newRole.description
      });
      setShowCreate(false);
      setNewRole({ label: '', key: '', description: '' });
      setRole(created.role.key);
      setMsg(`Rôle « ${created.role.label} » créé.`);
      load();
      onRolesChange?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async () => {
    if (!current || current.is_system) return;
    if (!confirm(`Supprimer le rôle « ${current.label || current.role} » ?`)) return;
    setSaving(true);
    setError('');
    try {
      await api.permissions.removeRole(current.role);
      setRole('admin');
      setMsg('Rôle supprimé.');
      load();
      onRolesChange?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!draft || !current) {
    return <p className="py-10 text-center text-sm text-ink-400">Chargement des rôles…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-400">
          Choisissez un rôle, puis cochez ce qu’il peut voir et modifier dans chaque fonction.
        </p>
        {canEdit && (
          <button type="button" className="btn-primary !rounded-xl !px-3 !py-2 text-xs" onClick={() => { setError(''); setShowCreate(true); }}>
            + Nouveau rôle
          </button>
        )}
      </div>
      <div className="grid min-h-[28rem] gap-3 lg:grid-cols-[240px_1fr]">
        <aside className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-ink-100">
          <div className="border-b border-ink-100 px-3 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Rôles ({ordered.length})</span>
          </div>
          <div className="space-y-0.5 overflow-y-auto p-1.5">
            {ordered.map((r) => {
              const active = role === r.role;
              const n = r.locked ? areas.length : r.permissions.filter((p) => p.enabled).length;
              return (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => { setRole(r.role); setQuery(''); setMsg(''); setError(''); }}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition ${active ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-cream'}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold">{r.label || ROLE_LABELS[r.role] || r.role}</span>
                    <span className={`text-[10px] font-bold tabular-nums ${active ? 'text-white/80' : 'text-ink-400'}`}>{counts[r.role] || 0}</span>
                  </span>
                  <span className={`mt-0.5 block truncate text-[10px] ${active ? 'text-white/75' : 'text-ink-400'}`}>
                    {r.locked ? 'Accès total' : `${n} droit${n > 1 ? 's' : ''} · ${r.description || ROLE_BLURB[r.role] || ''}`}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-ink-100">
          <div className="flex flex-col justify-between gap-3 border-b border-ink-100 px-4 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-ink-900">{current.label || ROLE_LABELS[role] || role}</h3>
              <p className="mt-0.5 truncate text-[11px] text-ink-400">
                {locked
                  ? 'Toutes les permissions — non modifiable'
                  : `${onCount} permission${onCount > 1 ? 's' : ''} active${onCount > 1 ? 's' : ''}${dirty ? ' · modifications non enregistrées' : ''}`}
              </p>
            </div>
            {canEdit && !current.locked && (
              <div className="flex shrink-0 gap-2">
                <button type="button" className="rounded-xl px-3 py-2 text-xs font-bold text-ink-500 hover:bg-cream disabled:opacity-40" disabled={!dirty || saving} onClick={resetRole}>
                  Annuler
                </button>
                <button type="button" className="btn-primary !rounded-xl !px-3.5 !py-2 text-xs" disabled={!dirty || saving} onClick={save}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                {!current.is_system && !(current.user_count || counts[role]) && (
                  <button type="button" className="rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50" disabled={saving} onClick={removeRole}>
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
          {msg && <p className="border-b border-ink-100 bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-700">{msg}</p>}
          {error && <p className="border-b border-ink-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">{error}</p>}
          <div className="border-b border-ink-100 px-4 py-2">
            <input
              className="input !py-2 text-xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer les permissions…"
            />
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {visibleGroups.length === 0 && (
              <p className="py-8 text-center text-sm text-ink-400">Aucun résultat pour « {query} ».</p>
            )}
            {visibleGroups.map((g) => {
              const ids = g.items.map((a) => a.id);
              const groupOn = ids.filter((id) => isOn(id)).length;
              const allOn = groupOn === ids.length;
              return (
                <div key={g.id} className="space-y-2">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => toggleGroup(ids)}
                    className="flex items-center gap-2 disabled:cursor-default"
                  >
                    <CheckBox on={allOn} partial={!allOn && groupOn > 0} />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{g.label}</span>
                    <span className="text-[10px] font-semibold tabular-nums text-ink-400">{groupOn}/{ids.length}</span>
                  </button>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {g.items.map((a) => {
                      const on = isOn(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          disabled={locked}
                          onClick={() => toggle(a.id)}
                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left ${locked ? 'cursor-not-allowed opacity-75' : ''} ${on ? 'border border-brand-200 bg-brand-50' : 'border border-transparent hover:bg-cream'}`}
                        >
                          <CheckBox on={on} />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-ink-800">{a.label}</span>
                            <span className="block truncate font-mono text-[10px] text-ink-400">{a.id}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau rôle">
        <div className="space-y-4">
          <Field label="Libellé">
            <input
              className="input"
              value={newRole.label}
              onChange={(e) => setNewRole({ ...newRole, label: e.target.value, key: newRole.key && newRole.key !== slugPreview(newRole.label) ? newRole.key : slugPreview(e.target.value) })}
              placeholder="Ex. Responsable RH"
            />
          </Field>
          <Field label="Clé" hint="Identifiant technique, non modifiable ensuite">
            <input
              className="input font-mono"
              value={newRole.key}
              onChange={(e) => setNewRole({ ...newRole, key: slugPreview(e.target.value) })}
              placeholder="responsable_rh"
            />
          </Field>
          <Field label="Description">
            <input
              className="input"
              value={newRole.description}
              onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
              placeholder="Ex. Dossiers employés et congés"
            />
          </Field>
          <p className="text-[11px] text-ink-400">Créé avec le tableau de bord et la messagerie. Les autres droits se règlent ensuite.</p>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <button type="button" className="rounded-xl px-3 py-2 text-xs font-bold text-ink-500 hover:bg-cream" onClick={() => setShowCreate(false)}>Annuler</button>
            <button type="button" className="btn-primary !rounded-xl !px-4 !py-2 text-xs" disabled={saving || !newRole.label.trim()} onClick={createRole}>
              {saving ? 'Création…' : 'Créer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function UsersAdmin() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  const [invites, setInvites] = useState([]);
  const [inviteModal, setInviteModal] = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState('');
  const [securityEvents, setSecurityEvents] = useState([]);

  const [roleCatalog, setRoleCatalog] = useState([]);
  const load = useCallback(() => api.adminUsers.list().then(setUsers).catch(() => {}), []);
  const loadRoles = useCallback(() => api.permissions.get().then((d) => setRoleCatalog(d.roles || [])).catch(() => {}), []);
  const loadInvites = useCallback(() => api.invites.list().then(setInvites).catch(() => {}), []);
  const loadSecurity = useCallback(() => api.adminSecurity.events().then(setSecurityEvents).catch(() => {}), []);
  useEffect(() => { load(); loadInvites(); loadSecurity(); loadRoles(); }, [load, loadInvites, loadSecurity, loadRoles]);

  const inviteUrl = (inv) => `${window.location.origin}/inscription?token=${inv.token}`;

  const copyInvite = async (inv) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(inv));
      setCopied(inv.token);
      setTimeout(() => setCopied(''), 1800);
    } catch { /* clipboard indisponible */ }
  };

  const createInvite = async () => {
    setInviteError('');
    try {
      const inv = await api.invites.create(inviteModal);
      setInviteModal(null);
      setCreated(inv);
      setTab('invites');
      loadInvites();
    } catch (e) {
      setInviteError(e.message);
    }
  };

  const revokeInvite = async (inv) => {
    if (!confirm(`Révoquer ce lien ?`)) return;
    try {
      await api.invites.remove(inv.id);
      if (created?.id === inv.id) setCreated(null);
      loadInvites();
    } catch (e) {
      alert(e.message);
    }
  };

  const meUser = useMemo(() => getSavedUser(), [users]);
  const actorIsSuper = meUser?.role === 'super_admin';
  const roleChoices = (roleCatalog.length ? roleCatalog.map((r) => r.key) : ROLE_ORDER)
    .filter((r) => actorIsSuper || r !== 'super_admin');
  const roleLabel = (key) => roleCatalog.find((r) => r.key === key)?.label || ROLE_LABELS[key] || key;

  const roleCounts = useMemo(() => {
    const map = Object.fromEntries(roleChoices.map((r) => [r, 0]));
    for (const u of users) if (map[u.role] != null) map[u.role] += 1;
    return map;
  }, [users, roleChoices]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) =>
      [u.full_name, u.email, u.job_title, u.unique_code, roleLabel(u.role)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(s)
    );
  }, [users, q]);

  const openInvites = invites.filter((i) => i.state === 'available').length;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        full_name: editing.full_name,
        email: editing.email,
        role: editing.role,
        photo: editing.photo || '',
        phone: editing.phone || '',
        job_title: editing.job_title || '',
        bio: editing.bio || ''
      };
      if (editing.password) payload.password = editing.password;
      if (editing.id) {
        const updated = await api.adminUsers.update(editing.id, payload);
        if (meUser?.id === updated.id) setSavedUser({ ...meUser, ...updated });
      } else {
        if (!editing.password) {
          setError('Mot de passe requis');
          setSaving(false);
          return;
        }
        await api.adminUsers.create({ ...payload, password: editing.password });
      }
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    if (!editing?.id) return;
    if (!confirm('Générer un nouveau code ? L’ancien QR ne fonctionnera plus.')) return;
    try {
      const updated = await api.adminUsers.regenerateCode(editing.id);
      setEditing({ ...updated, password: '' });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const remove = async (u) => {
    if (!confirm(`Supprimer « ${u.email} » ?`)) return;
    try {
      await api.adminUsers.remove(u.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageTitle
        title={tab === 'perms' ? 'Rôles et droits' : tab === 'security' ? 'Sécurité' : 'Utilisateurs'}
        subtitle={tab === 'perms'
          ? 'Définissez qui peut voir et modifier chaque fonction.'
          : tab === 'security'
            ? 'Connexions, échecs et déconnexions.'
            : `${users.length} compte${users.length > 1 ? 's' : ''}${openInvites ? ` · ${openInvites} invitation${openInvites > 1 ? 's' : ''}` : ''}`}
        action={tab === 'users' || tab === 'invites' ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-700 ring-1 ring-ink-100 hover:bg-cream"
              onClick={() => { setInviteError(''); setCreated(null); setInviteModal({ ...emptyInvite }); }}
            >
              + Invitation
            </button>
            <button type="button" className="btn-primary !px-4 !py-2 text-sm" onClick={() => setEditing({ ...emptyUser })}>
              + Compte
            </button>
          </div>
        ) : null}
      />

      {tab === 'users' && (
        <div className="flex flex-wrap gap-2">
          {roleChoices.map((role) => (
            <span
              key={role}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${ROLE_STYLES[role]}`}
            >
              {roleLabel(role)}
              <span className="opacity-80">{roleCounts[role] || 0}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-ink-100">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
              tab === t.id ? 'bg-brand-600 text-white' : 'text-ink-500 hover:bg-cream'
            }`}
          >
            {t.label}
            {t.id === 'invites' && openInvites > 0 && (
              <span className={`ml-1.5 ${tab === t.id ? 'text-white/80' : 'text-brand-600'}`}>{openInvites}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink-100">
          <div className="border-b border-ink-100 px-3 py-2.5">
            <input
              className="input !py-2 text-sm"
              placeholder="Rechercher…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-ink-100 bg-cream/50 text-[10px] font-bold uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-2.5">Utilisateur</th>
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Rôle</th>
                  <th className="px-4 py-2.5">Créé</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {u.photo ? (
                          <img src={u.photo} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-ink-100" />
                        ) : (
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 font-display text-[11px] font-bold text-brand-700">
                            {(u.full_name || u.email).slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink-900">
                            {u.full_name}
                            {meUser?.email === u.email && (
                              <span className="ml-1.5 rounded bg-accent-400/80 px-1.5 py-0.5 text-[9px] font-extrabold text-ink-950">vous</span>
                            )}
                          </p>
                          <p className="truncate text-[11px] text-ink-400">{u.job_title || u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11px] font-bold text-brand-700">{u.unique_code || '—'}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={u.role}
                        disabled={meUser?.email === u.email}
                        onChange={async (e) => {
                          try {
                            await api.adminUsers.update(u.id, { role: e.target.value });
                            load();
                          } catch (err) {
                            alert(err.message);
                          }
                        }}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold outline-none disabled:opacity-60 ${ROLE_STYLES[u.role]}`}
                      >
                        {roleChoices.map((r) => (
                          <option key={r} value={r}>{roleLabel(r)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink-400">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing({ ...emptyUser, ...u, password: '' })}
                          className="rounded-lg bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 hover:bg-brand-100"
                        >
                          Modifier
                        </button>
                        <DeleteButton onConfirm={() => remove(u)} disabled={meUser?.email === u.email} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-ink-400">Aucun compte.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'invites' && (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink-100">
          {created && (
            <div className="flex flex-wrap items-center gap-2 border-b border-brand-100 bg-brand-50 px-4 py-3">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs font-semibold text-ink-800 ring-1 ring-brand-100">
                {inviteUrl(created)}
              </code>
              <button type="button" onClick={() => copyInvite(created)} className="btn-primary shrink-0 !px-3 !py-2 text-xs">
                {copied === created.token ? 'Copié' : 'Copier'}
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-ink-100 bg-cream/50 text-[10px] font-bold uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-2.5">Invitation</th>
                  <th className="px-4 py-2.5">Rôle</th>
                  <th className="px-4 py-2.5">Statut</th>
                  <th className="px-4 py-2.5">Expire</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const st = INVITE_STATE[inv.state] || INVITE_STATE.available;
                  return (
                    <tr key={inv.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/40">
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-ink-900">{inv.label || inv.email || 'Sans objet'}</p>
                        <p className="text-[11px] text-ink-400">{inv.email || inv.created_by_name || '—'}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ROLE_STYLES[inv.role] || 'bg-ink-100 text-ink-600'}`}>
                          {roleLabel(inv.role)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-ink-400">{fmtDate(inv.expires_at)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          {inv.state === 'available' && (
                            <>
                              <button type="button" onClick={() => copyInvite(inv)} className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700 hover:bg-brand-100">
                                {copied === inv.token ? '✓' : 'Copier'}
                              </button>
                              <button type="button" onClick={() => revokeInvite(inv)} className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-100">
                                Révoquer
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {invites.length === 0 && (
              <p className="py-8 text-center text-sm text-ink-400">Aucune invitation.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'perms' && <PermissionsPanel users={users} onRolesChange={loadRoles} />}

      {tab === 'security' && (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink-100">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-ink-100 bg-cream/50 text-[10px] font-bold uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-2.5">Événement</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">IP</th>
                  <th className="px-4 py-2.5 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {securityEvents.map((ev) => (
                  <tr key={ev.id} className="border-b border-ink-50 last:border-0">
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        ev.type === 'login_fail' ? 'bg-red-100 text-red-700'
                          : ev.type === 'login_ok' ? 'bg-brand-100 text-brand-700'
                            : 'bg-ink-100 text-ink-500'
                      }`}>
                        {ev.type === 'login_fail' ? 'Échec' : ev.type === 'login_ok' ? 'Connexion' : ev.type === 'logout' ? 'Déconnexion' : ev.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-ink-600">{ev.email || '—'}</td>
                    <td className="px-4 py-2 font-mono text-[11px] text-ink-400">{ev.ip || '—'}</td>
                    <td className="px-4 py-2 text-right text-xs text-ink-400">{fmtDateTime(ev.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {securityEvents.length === 0 && (
              <p className="py-8 text-center text-sm text-ink-400">Aucun événement.</p>
            )}
          </div>
        </div>
      )}

      <Modal open={!!inviteModal} onClose={() => setInviteModal(null)} title="Nouvelle invitation">
        {inviteModal && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email (optionnel)">
                <input className="input" type="email" value={inviteModal.email} onChange={(e) => setInviteModal({ ...inviteModal, email: e.target.value })} placeholder="prenom@adiong.org" />
              </Field>
              <Field label="Rôle">
                <select className="input" value={inviteModal.role} onChange={(e) => setInviteModal({ ...inviteModal, role: e.target.value })}>
                  {roleChoices.filter((r) => r !== 'super_admin').map((value) => (
                    <option key={value} value={value}>{roleLabel(value)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Libellé">
                <input className="input" value={inviteModal.label} onChange={(e) => setInviteModal({ ...inviteModal, label: e.target.value })} placeholder="Ex. Rédacteur" />
              </Field>
              <Field label="Validité">
                <select className="input" value={inviteModal.days} onChange={(e) => setInviteModal({ ...inviteModal, days: Number(e.target.value) })}>
                  <option value={3}>3 jours</option>
                  <option value={7}>7 jours</option>
                  <option value={14}>14 jours</option>
                  <option value={30}>30 jours</option>
                </select>
              </Field>
            </div>
            {inviteError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{inviteError}</p>}
            <div className="flex justify-end border-t border-ink-100 pt-4">
              <button type="button" className="btn-primary !px-5 !py-2 text-sm" onClick={createInvite}>Générer</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Modifier le compte' : 'Nouveau compte'} wide>
        {editing && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_200px]">
            <div>
              <UserProfileFields
                value={editing}
                onChange={setEditing}
                showRole
                actorIsSuper={actorIsSuper}
                roles={roleChoices.map((key) => ({ key, label: roleLabel(key) }))}
                passwordRequired={!editing.id}
              />
              {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
              <div className="mt-5 flex justify-end border-t border-ink-100 pt-4">
                <button
                  type="button"
                  className="btn-primary !px-5 !py-2 text-sm"
                  onClick={save}
                  disabled={saving || !editing.email || (!editing.id && !editing.password)}
                >
                  {saving ? '…' : 'Enregistrer'}
                </button>
              </div>
            </div>
            <MemberQrCard user={editing} canRegenerate={!!editing.id} onRegenerate={regenerate} />
          </div>
        )}
      </Modal>
    </div>
  );
}
