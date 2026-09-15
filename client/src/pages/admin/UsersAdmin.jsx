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

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api.adminUsers.list().then(setUsers).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

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
