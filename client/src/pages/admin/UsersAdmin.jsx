import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getSavedUser } from '../../api.js';
import { PageTitle, Modal, Field, DeleteButton } from './AdminUI.jsx';

const ROLE_STYLES = {
  super_admin: 'bg-brand-900 text-white',
  admin: 'bg-brand-100 text-brand-700',
  editor: 'bg-accent-100 text-accent-800',
  viewer: 'bg-ink-100 text-ink-600'
};
const ROLE_LABELS = { super_admin: 'Super admin', admin: 'Administrateur', editor: 'Éditeur', viewer: 'Consultation' };
const ROLE_DESCRIPTIONS = {
  super_admin: "Tout, y compris l'activation des modules (GRH) et la gestion des super admins",
  admin: 'Accès complet : contenu, paramètres, utilisateurs, GRH (si activée)',
  editor: 'Gère les articles, causes, campagnes et la médiathèque',
  viewer: 'Consultation seule (tableau de bord)'
};

const emptyUser = { email: '', password: '', full_name: '', role: 'editor' };

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
      if (editing.id) {
        const payload = { full_name: editing.full_name, role: editing.role };
        if (editing.password) payload.password = editing.password;
        await api.adminUsers.update(editing.id, payload);
      } else {
        await api.adminUsers.create(editing);
      }
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
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
        subtitle={`${users.length} compte(s) — contrôle de l'accès à l'espace d'administration`}
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
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-cream/70 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-4">Utilisateur</th>
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
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 font-display text-sm font-bold text-brand-700">
                        {(u.full_name || u.email).slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-semibold text-ink-900">
                          {u.full_name}
                          {meUser?.email === u.email && <span className="ml-2 rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-bold text-ink-950">VOUS</span>}
                        </p>
                        <p className="text-xs text-ink-400">{u.email}</p>
                      </div>
                    </div>
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
                      title={u.role === 'admin' && u.id === users.find((x) => x.role === 'admin')?.id ? 'Dernier administrateur : modifiable en dernier' : ''}
                    >
                      <option value="super_admin">Super admin</option>
                      <option value="admin">Administrateur</option>
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
                        onClick={() => setEditing({ ...u, password: '' })}
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Modifier l’utilisateur' : 'Nouvel utilisateur'}>
        {editing && (
          <div className="space-y-5">
            <Field label="Nom complet">
              <input className="input" value={editing.full_name || ''} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} placeholder="Prénom Nom" />
            </Field>
            <Field label="Email">
              <input
                className="input"
                type="email"
                value={editing.email}
                disabled={!!editing.id}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                placeholder="prenom@adiong.org"
              />
            </Field>
            <Field label={editing.id ? 'Nouveau mot de passe (laisser vide pour conserver)' : 'Mot de passe *'} hint="8 caractères minimum">
              <input
                className="input"
                type="password"
                value={editing.password || ''}
                onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                placeholder="••••••••"
              />
            </Field>
            <Field label="Rôle">
              <div className="space-y-2">
                {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setEditing({ ...editing, role })}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      editing.role === role
                        ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                        : 'border-ink-200 hover:border-brand-300'
                    }`}
                  >
                    <span className={`mt-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${ROLE_STYLES[role]}`}>
                      {ROLE_LABELS[role]}
                    </span>
                    <span className="text-sm leading-snug text-ink-600">{desc}</span>
                  </button>
                ))}
              </div>
            </Field>
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
            <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
              <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save}
                disabled={saving || !editing.email || (!editing.id && !editing.password)}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
