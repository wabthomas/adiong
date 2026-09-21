import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getSavedUser, setSavedUser } from '../../api.js';
import { PageTitle, Modal, DeleteButton, Field } from './AdminUI.jsx';
import { emptyUser, ROLE_STYLES, ROLE_LABELS, UserProfileFields, MemberQrCard } from './UserProfileFields.jsx';

const TABS = [
  { id: 'users', label: 'Comptes' },
  { id: 'invites', label: 'Invitations' },
  { id: 'perms', label: 'Permissions' },
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

function PermissionsPanel() {
  const me = getSavedUser();
  const isSuper = me?.role === 'super_admin';
  const [areas, setAreas] = useState([]);
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.permissions.get().then((d) => {
      setAreas(d.areas);
      setRows(d.matrix);
      setDraft(d.matrix.map((r) => ({ ...r, permissions: r.permissions.map((p) => ({ ...p })) })));
    }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (role, area) =>
    setDraft((cur) => cur.map((r) =>
      r.role !== role || r.locked
        ? r
        : { ...r, permissions: r.permissions.map((p) => (p.area === area ? { ...p, enabled: !p.enabled } : p)) }
    ));

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
      setMsg('Enregistré');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!draft) {
    return <p className="py-10 text-center text-sm text-ink-400">Chargement…</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
        <p className="text-sm font-bold text-ink-800">
          Zones par rôle
          {!isSuper && <span className="ml-2 text-xs font-semibold text-ink-400">lecture seule</span>}
        </p>
        {isSuper && (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost !px-3 !py-1.5 text-xs"
              onClick={() => {
                setDraft(rows.map((r) => ({ ...r, permissions: r.permissions.map((p) => ({ ...p })) })));
                setMsg('');
                setError('');
              }}
            >
              Annuler
            </button>
            <button type="button" className="btn-primary !px-4 !py-1.5 text-xs" onClick={save} disabled={saving}>
              {saving ? '…' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>
      {msg && <p className="border-b border-ink-100 bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-700">{msg}</p>}
      {error && <p className="border-b border-ink-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-ink-100 bg-cream/50 text-[10px] font-bold uppercase tracking-wide text-ink-400">
            <tr>
              <th className="sticky left-0 z-10 bg-cream/95 px-4 py-2.5">Rôle</th>
              {areas.map((a) => (
                <th key={a.id} className="max-w-[5.5rem] px-2 py-2.5 text-center leading-tight" title={a.desc}>
                  {a.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.map((r) => (
              <tr key={r.role} className="border-b border-ink-50 last:border-0">
                <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ROLE_STYLES[r.role] || 'bg-ink-100 text-ink-600'}`}>
                    {ROLE_LABELS[r.role] || r.role}
                  </span>
                </td>
                {areas.map((a) => {
                  const p = r.permissions.find((x) => x.area === a.id);
                  return (
                    <td key={a.id} className="px-2 py-2.5 text-center" title={a.desc}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#0f3a88]"
                        checked={!!p?.enabled}
                        disabled={r.locked || !isSuper}
                        onChange={() => toggle(r.role, a.id)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

  const load = useCallback(() => api.adminUsers.list().then(setUsers).catch(() => {}), []);
  const loadInvites = useCallback(() => api.invites.list().then(setInvites).catch(() => {}), []);
  const loadSecurity = useCallback(() => api.adminSecurity.events().then(setSecurityEvents).catch(() => {}), []);
  useEffect(() => { load(); loadInvites(); loadSecurity(); }, [load, loadInvites, loadSecurity]);

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

  const roleCounts = useMemo(() => {
    const map = Object.fromEntries(ROLE_ORDER.map((r) => [r, 0]));
    for (const u of users) if (map[u.role] != null) map[u.role] += 1;
    return map;
  }, [users]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) =>
      [u.full_name, u.email, u.job_title, u.unique_code, ROLE_LABELS[u.role]]
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
        title="Utilisateurs"
        subtitle={`${users.length} compte${users.length > 1 ? 's' : ''}${openInvites ? ` · ${openInvites} invitation${openInvites > 1 ? 's' : ''}` : ''}`}
        action={
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
        }
      />

      <div className="flex flex-wrap gap-2">
        {ROLE_ORDER.map((role) => (
          <span
            key={role}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${ROLE_STYLES[role]}`}
          >
            {ROLE_LABELS[role]}
            <span className="opacity-80">{roleCounts[role] || 0}</span>
          </span>
        ))}
      </div>

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
                        {ROLE_ORDER.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
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
                          {ROLE_LABELS[inv.role] || inv.role}
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

      {tab === 'perms' && <PermissionsPanel />}

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
                  {INVITE_ROLES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
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
