import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { PageTitle, Modal, Field, ImageInput, Toggle, DeleteButton } from './AdminUI.jsx';
import { causeIcons } from '../../components/Icons.jsx';

const empty = {
  title: '',
  slug: '',
  tagline: '',
  description: '',
  long_content: '',
  icon: 'megaphone',
  image: '',
  link: '',
  sort_order: 99,
  published: true
};

const ICONS = ['megaphone', 'briefcase', 'education', 'leaf', 'heart', 'spark', 'target', 'globe', 'users', 'clipboard'];

export default function CausesAdmin() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api.adminCauses.list().then(setItems).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing.id) await api.adminCauses.update(editing.id, editing);
      else await api.adminCauses.create(editing);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!confirm(`Supprimer la cause « ${item.title} » ?`)) return;
    await api.adminCauses.remove(item.id);
    load();
  };

  return (
    <div>
      <PageTitle
        title="Causes (Notre travail)"
        subtitle="Les domaines d'action affichés sur le site"
        action={
          <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => setEditing({ ...empty })}>
            + Nouvelle cause
          </button>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((c) => {
          const Icon = causeIcons[c.icon] || causeIcons.megaphone;
          return (
            <div key={c.id} className="card p-6">
              <div className="flex items-start justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-100 text-accent-700">
                  <Icon className="h-6 w-6" />
                </span>
                <Toggle
                  value={!!c.published}
                  onChange={async (v) => {
                    await api.adminCauses.update(c.id, { ...c, published: v });
                    load();
                  }}
                />
              </div>
              <h3 className="mt-4 font-display font-bold text-ink-900">{c.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500 line-clamp-3">{c.description}</p>
              <div className="mt-5 flex items-center justify-between border-t border-ink-50 pt-4">
                <span className="text-xs font-bold text-ink-400">Ordre : {c.sort_order}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing({ ...c, published: !!c.published })}
                    className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100"
                  >
                    Modifier
                  </button>
                  <DeleteButton onConfirm={() => remove(c)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Modifier la cause' : 'Nouvelle cause'} wide>
        {editing && (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Titre *">
                <input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </Field>
              <Field label="Slug (URL)" hint="Ex. plaidoyer — le lien du site sera /notre-travail/&lt;slug&gt;">
                <input className="input" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
              </Field>
            </div>
            <Field label="Slogan court (tagline)">
              <input className="input" value={editing.tagline} onChange={(e) => setEditing({ ...editing, tagline: e.target.value })} />
            </Field>
            <Field label="Description (carte d'accueil)">
              <textarea className="input min-h-[80px]" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>
            <Field label="Contenu détaillé (page de la cause)" hint="Séparez les paragraphes par une ligne vide">
              <textarea className="input min-h-[160px]" value={editing.long_content} onChange={(e) => setEditing({ ...editing, long_content: e.target.value })} />
            </Field>
            <Field label="Icône">
              <div className="flex flex-wrap gap-2">
                {ICONS.map((ic) => {
                  const Icon = causeIcons[ic];
                  return (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setEditing({ ...editing, icon: ic })}
                      className={`grid h-11 w-11 place-items-center rounded-xl transition-all ${
                        editing.icon === ic ? 'bg-brand-600 text-white shadow-soft' : 'bg-ink-50 text-ink-500 hover:bg-brand-50'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            </Field>
            <ImageInput value={editing.image} onChange={(v) => setEditing({ ...editing, image: v })} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Lien personnalisé (optionnel)" hint="Vide = /notre-travail/&lt;slug&gt;">
                <input className="input" value={editing.link} onChange={(e) => setEditing({ ...editing, link: e.target.value })} placeholder="/notre-travail/plaidoyer" />
              </Field>
              <Field label="Ordre d'affichage">
                <input type="number" className="input" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
              </Field>
            </div>
            <div className="flex items-center justify-between border-t border-ink-100 pt-5">
              <Toggle value={editing.published} onChange={(v) => setEditing({ ...editing, published: v })} />
              <div className="flex items-center gap-3">
                {error && <span className="text-sm font-semibold text-red-600">{error}</span>}
                <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={saving || !editing.title}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
