import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getSavedUser, setSavedUser } from '../../api.js';
import { PageTitle, Modal, DeleteButton, Field } from './AdminUI.jsx';
import { emptyUser, ROLE_STYLES, ROLE_LABELS, ROLE_DESCRIPTIONS, UserProfileFields, MemberQrCard } from './UserProfileFields.jsx';

const INVITE_ROLES = [
  ['editor', 'Éditeur', 'Publie les articles, causes, campagnes ; gère la médiathèque'],
  ['viewer', 'Consultation', 'Consulte le tableau de bord, dons et messages'],
  ['admin', 'Administrateur', 'Accès complet (hors modules et super admin)']
];
const INVITE_STATE = {
  available: { label: 'Disponible', cls: 'bg-brand-100 text-brand-700' },
  used: { label: 'Utilisé', cls: 'bg-ink-100 text-ink-500' },
  expired: { label: 'Expiré', cls: 'bg-accent-100 text-accent-800' }
};
const emptyInvite = { email: '', role: 'editor', label: '', days: 7 };

function PermissionsCard() {
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
      setMsg('✓ Permissions enregistrées — appliquées immédiatement.');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const reset = () => {
    setDraft(rows.map((r) => ({ ...r, permissions: r.permissions.map((p) => ({ ...p })) })));
    setMsg('');
    setError('');
  };

  if (!draft) return null;

  return (
    <div className="card mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-cream/70 px-6 py-4">
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900">Droits d'accès par rôle</h3>
          <p className="mt-0.5 text-sm text-ink-400">
            Cochez les zones accessibles à chaque rôle. Le super admin conserve toujours tous les droits.
          </p>
        </div>
        {isSuper && (
          <div className="flex gap-2">
            <button className="btn-ghost !px-4 !py-2 text-sm" onClick={reset}>Réinitialiser</button>
            <button className="btn-primary !px-5 !py-2 text-sm" onClick={save} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>
      {!isSuper && (
        <p className="border-b border-ink-100 bg-accent-50 px-6 py-3 text-sm font-semibold text-accent-900">
          Lecture seule — seul le super administrateur peut modifier les permissions.
        </p>
      )}
      {msg && <p className="border-b border-ink-100 bg-brand-50 px-6 py-3 text-sm font-semibold text-brand-700">{msg}</p>}
      {error && <p className="border-b border-ink-100 bg-red-50 px-6 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-ink-100 bg-cream/40 text-xs font-bold tracking-wide text-ink-400 uppercase">
            <tr>
              <th className="px-6 py-3.5">Rôle</th>
              {areas.map((a) => (
                <th key={a.id} className="px-4 py-3.5 text-center" title={a.desc}>{a.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.map((r) => (
              <tr key={r.role} className="border-b border-ink-50 last:border-0">
                <td className="px-6 py-3.5">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${ROLE_STYLES[r.role] || 'bg-ink-100 text-ink-600'}`}>
                    {ROLE_LABELS[r.role] || r.role}
                  </span>
                  {r.locked && (
                    <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-500">accès complet</span>
                  )}
                </td>
                {areas.map((a) => {
                  const p = r.permissions.find((x) => x.area === a.id);
                  return (
                    <td key={a.id} className="px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-[#0f3a88]"
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
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
      loadInvites();
    } catch (e) {
      setInviteError(e.message);
    }
  };

  const revokeInvite = async (inv) => {
    if (!confirm(`Révoquer ce lien${inv.label ? ` « ${inv.label} »` : ''} ? L'invité ne pourra plus s'inscrire avec.`)) return;
    try {
      await api.invites.remove(inv.id);
      if (created?.id === inv.id) setCreated(null);
      loadInvites();
    } catch (e) {
      alert(e.message);
    }
  };

  const meUser = useMemo(() => getSavedUser(), [users]);

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
    if (!confirm('Générer un nouveau code ? L’ancien QR code ne fonctionnera plus.')) return;
    try {
      const updated = await api.adminUsers.regenerateCode(editing.id);
      setEditing({ ...updated, password: '' });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const remove = async (u) => {
    if (!confirm(`Supprimer le compte « ${u.email} » ?`)) return;
    try {
      await api.adminUsers.remove(u.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div>
      <PageTitle
        title="Utilisateurs & rôles"
        subtitle={`${users.length} compte(s) — fiche complète, photo, code unique et QR code`}
        action={
          <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => setEditing({ ...emptyUser })}>
            + Nouveau utilisateur
          </button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
          <div key={role} className="card p-5">
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${ROLE_STYLES[role]}`}>
              {users.find((u) => u.role === role)?.role_label || role}
            </span>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">{desc}</p>
            <p className="mt-2 text-xs font-bold text-ink-400">
              {users.filter((u) => u.role === role).length} compte(s)
            </p>
          </div>
        ))}
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-cream/70 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-4">Utilisateur</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Rôle</th>
                <th className="px-6 py-4">Créé le</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {u.photo ? (
                        <img src={u.photo} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-brand-100" />
                      ) : (
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 font-display text-sm font-bold text-brand-700">
                        {(u.full_name || u.email).slice(0, 2).toUpperCase()}
                      </span>
                      )}
                      <div>
                        <p className="font-semibold text-ink-900">
                          {u.full_name}
                          {meUser?.email === u.email && <span className="ml-2 rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-bold text-ink-950">VOUS</span>}
                        </p>
                        <p className="text-xs text-ink-400">{u.job_title || u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 font-mono text-xs font-bold text-brand-700">
                      {u.unique_code || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
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
                      className={`rounded-full px-3 py-1.5 text-xs font-bold outline-none disabled:opacity-60 ${ROLE_STYLES[u.role]}`}
                    >
                      <option value="super_admin">Super admin</option>
                      <option value="admin">Administrateur</option>
                      <option value="cashier">Caissier</option>
                      <option value="editor">Éditeur</option>
                      <option value="viewer">Consultation</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-ink-500">
                    {new Date((u.created_at || '') + (u.created_at?.includes('T') ? '' : 'Z')).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditing({ ...emptyUser, ...u, password: '' })}
                        className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100"
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
        </div>
      </div>

      <PermissionsCard />

      <div className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-cream/70 px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900">Liens d'invitation</h3>
            <p className="mt-0.5 text-sm text-ink-400">
              Génerez un lien privé à envoyer à un employé : il crée lui-même son compte (mot de passe inclus).
              L'inscription n'est jamais ouverte au public.
            </p>
          </div>
          <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => { setInviteError(''); setCreated(null); setInviteModal({ ...emptyInvite }); }}>
            + Générer un lien
          </button>
        </div>

        {created && (
          <div className="border-b border-ink-100 bg-brand-50 px-6 py-5">
            <p className="text-xs font-bold tracking-wide text-brand-700 uppercase">Nouveau lien généré — envoyez-le à votre invité :</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 ring-1 ring-brand-200">
                {inviteUrl(created)}
              </code>
              <button onClick={() => copyInvite(created)} className="btn-primary shrink-0 !px-4 !py-2.5 text-sm">
                {copied === created.token ? '✓ Copié' : 'Copier le lien'}
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-400">
              Lien à usage unique, expirant le {new Date(created.expires_at + 'T12:00:00').toLocaleDateString('fr-FR')}.
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-ink-100 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-3.5">Invitation</th>
                <th className="px-6 py-3.5">Rôle</th>
                <th className="px-6 py-3.5">Statut</th>
                <th className="px-6 py-3.5">Créée par</th>
                <th className="px-6 py-3.5">Expire le</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const st = INVITE_STATE[inv.state] || INVITE_STATE.available;
                return (
                  <tr key={inv.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-ink-900">{inv.label || inv.email || 'Sans objet'}</p>
                      <p className="text-xs text-ink-400">{inv.email || 'Email choisi par l’invité'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${ROLE_STYLES[inv.role] || 'bg-ink-100 text-ink-600'}`}>
                        {ROLE_LABELS[inv.role] || inv.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-6 py-4 text-ink-500">{inv.created_by_name || '—'}</td>
                    <td className="px-6 py-4 text-ink-500">
                      {new Date(inv.expires_at + 'T12:00:00').toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1.5">
                        {inv.state === 'available' && (
                          <>
                            <button onClick={() => copyInvite(inv)} className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100">
                              {copied === inv.token ? '✓' : 'Copier'}
                            </button>
                            <button onClick={() => revokeInvite(inv)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
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
            <p className="py-10 text-center text-ink-400">Aucun lien d'invitation — générez-en un pour inviter un employé.</p>
          )}
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-ink-100 bg-cream/70 px-6 py-4">
          <h3 className="font-display text-lg font-bold text-ink-900">Sécurité — derniers événements</h3>
          <p className="mt-0.5 text-sm text-ink-400">Connexions réussies/échouées et déconnexions (100 derniers) — utile pour repérer des tentatives d'intrusion.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-ink-100 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-3.5">Événement</th>
                <th className="px-6 py-3.5">Email</th>
                <th className="px-6 py-3.5">Adresse IP</th>
                <th className="px-6 py-3.5 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {securityEvents.map((ev) => (
                <tr key={ev.id} className="border-b border-ink-50 last:border-0">
                  <td className="px-6 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                      ev.type === 'login_fail' ? 'bg-red-100 text-red-700' : ev.type === 'login_ok' ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'
                    }`}>
                      {ev.type === 'login_fail' ? 'Échec connexion' : ev.type === 'login_ok' ? 'Connexion' : ev.type === 'logout' ? 'Déconnexion' : ev.type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-ink-600">{ev.email || '—'}</td>
                  <td className="px-6 py-3 font-mono text-xs text-ink-500">{ev.ip || '—'}</td>
                  <td className="px-6 py-3 text-right text-ink-400">
                    {new Date((ev.created_at || '') + 'Z').toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {securityEvents.length === 0 && (
            <p className="py-10 text-center text-ink-400">Aucun événement enregistré pour le moment.</p>
          )}
        </div>
      </div>

      <Modal open={!!inviteModal} onClose={() => setInviteModal(null)} title="Générer un lien d'invitation">
        {inviteModal && (
          <div className="space-y-5">
            <Field label="Email de l'invité (optionnel)" hint="S'il est renseigné, seul cet email pourra créer le compte">
              <input className="input" type="email" value={inviteModal.email} onChange={(e) => setInviteModal({ ...inviteModal, email: e.target.value })} placeholder="prenom@adiong.org" />
            </Field>
            <Field label="Rôle du compte">
              <div className="space-y-2">
                {INVITE_ROLES.map(([value, label, desc]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setInviteModal({ ...inviteModal, role: value })}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      inviteModal.role === value
                        ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                        : 'border-ink-200 hover:border-brand-300'
                    }`}
                  >
                    <span className={`mt-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${ROLE_STYLES[value]}`}>{label}</span>
                    <span className="text-sm leading-snug text-ink-600">{desc}</span>
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Objet (optionnel)" hint="Ex. « Poste de rédacteur »">
                <input className="input" value={inviteModal.label} onChange={(e) => setInviteModal({ ...inviteModal, label: e.target.value })} placeholder="Poste de rédacteur" />
              </Field>
              <Field label="Validité du lien">
                <select className="input" value={inviteModal.days} onChange={(e) => setInviteModal({ ...inviteModal, days: Number(e.target.value) })}>
                  <option value={3}>3 jours</option>
                  <option value={7}>7 jours</option>
                  <option value={14}>14 jours</option>
                  <option value={30}>30 jours</option>
                </select>
              </Field>
            </div>

            {inviteError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{inviteError}</p>}
            <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
              <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={createInvite}>
                Générer le lien
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Modifier l’utilisateur' : 'Nouvel utilisateur'} wide>
        {editing && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div>
              <UserProfileFields
                value={editing}
                onChange={setEditing}
                showRole
                passwordRequired={!editing.id}
              />
              {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
              <div className="mt-6 flex justify-end gap-3 border-t border-ink-100 pt-5">
                <button
                  className="btn-primary !px-6 !py-2.5 text-sm"
                  onClick={save}
                  disabled={saving || !editing.email || (!editing.id && !editing.password)}
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
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
