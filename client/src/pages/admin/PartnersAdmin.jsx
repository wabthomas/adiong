import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { PageTitle, Field, Modal, ImageInput, DeleteButton } from './AdminUI.jsx';

const emptyPartner = { name: '', logo: '', link: '', sort_order: 0, published: true };

export default function PartnersAdmin() {
  const [partners, setPartners] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api.adminPartners.list().then(setPartners).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing.id) await api.adminPartners.update(editing.id, editing);
      else await api.adminPartners.create(editing);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!confirm(`Supprimer le partenaire « ${p.name} » ?`)) return;
    try {
      await api.adminPartners.remove(p.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const togglePublish = async (p) => {
    try {
      await api.adminPartners.update(p.id, { ...p, published: !p.published });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const move = async (p, dir) => {
    const list = [...partners];
    const idx = list.findIndex((x) => x.id === p.id);
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    try {
      for (let i = 0; i < list.length; i++) {
        if (list[i].sort_order !== (i + 1) * 10) {
          await api.adminPartners.update(list[i].id, { ...list[i], sort_order: (i + 1) * 10 });
        }
      }
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div>
      <PageTitle
        title="Partenaires"
        subtitle="Logos affichés en défilement automatique au-dessus du pied de page du site (masqué si aucun partenaire publié)"
        action={
          <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => setEditing({ ...emptyPartner })}>
            + Ajouter un partenaire
          </button>
        }
      />

      {partners.length > 0 && (
        <div className="mb-6 rounded-2xl border border-ink-100 bg-white p-5">
          <p className="mb-3 text-xs font-bold tracking-wide text-ink-400 uppercase">Aperçu du bandeau</p>
          <div className="flex items-center gap-8 overflow-hidden">
            {partners.filter((p) => p.published).map((p) => (
              <img key={p.id} src={p.logo} alt={p.name} className="h-11 w-auto max-w-[150px] object-contain opacity-60 grayscale" />
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-cream/70 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-4">Partenaire</th>
                <th className="px-6 py-4">Lien</th>
                <th className="px-6 py-4">Ordre</th>
                <th className="px-6 py-4">Visibilité</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {p.logo ? (
                        <img src={p.logo} alt={p.name} className="h-10 w-16 shrink-0 rounded-lg bg-ink-50 object-contain p-1 ring-1 ring-ink-100" />
                      ) : (
                        <span className="grid h-10 w-16 shrink-0 place-items-center rounded-lg bg-ink-50 text-xs text-ink-300 ring-1 ring-ink-100">Logo</span>
                      )}
                      <p className="font-semibold text-ink-900">{p.name}</p>
                    </div>
                  </td>
                  <td className="max-w-[220px] truncate px-6 py-4 text-ink-500" title={p.link}>{p.link || '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => move(p, -1)} className="rounded-lg bg-ink-50 px-2 py-1 text-xs font-bold text-ink-500 hover:bg-ink-100" title="Monter">↑</button>
                      <span className="w-8 text-center text-xs font-bold text-ink-400">#{partners.indexOf(p) + 1}</span>
                      <button onClick={() => move(p, 1)} className="rounded-lg bg-ink-50 px-2 py-1 text-xs font-bold text-ink-500 hover:bg-ink-100" title="Descendre">↓</button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => togglePublish(p)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                        p.published ? 'bg-brand-100 text-brand-700 hover:bg-brand-200' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                      }`}
                    >
                      {p.published ? 'Publié' : 'Masqué'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditing({ ...p })} className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100">
                        Modifier
                      </button>
                      <DeleteButton onConfirm={() => remove(p)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {partners.length === 0 && (
          <p className="py-14 text-center text-ink-400">
            Aucun partenaire pour le moment. Ajoutez les logos de vos partenaires — le bandeau
            s'affichera automatiquement sur tout le site dès le premier partenaire publié.
          </p>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Modifier le partenaire' : 'Nouveau partenaire'}>
        {editing && (
          <div className="space-y-5">
            <Field label="Nom du partenaire *">
              <input className="input" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex. Ministère de la Santé" />
            </Field>
            <ImageInput
              label="Logo *"
              hint="PNG avec fond transparent recommandé (décliné en niveaux de gris sur le site)"
              value={editing.logo || ''}
              onChange={(v) => setEditing({ ...editing, logo: v })}
            />
            <Field label="Lien du site (optionnel)" hint="Cliquer sur le logo ouvrira ce lien dans un nouvel onglet">
              <input className="input" value={editing.link || ''} onChange={(e) => setEditing({ ...editing, link: e.target.value })} placeholder="https://…" />
            </Field>
            <Field label="Visibilité">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-cream p-4">
                <input
                  type="checkbox"
                  checked={!!editing.published}
                  onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                  className="h-5 w-5 accent-brand-600"
                />
                <span className="text-sm font-semibold text-ink-700">Afficher sur le site</span>
              </label>
            </Field>

            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
            <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
              <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={saving || !editing.name.trim() || !editing.logo.trim()}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
