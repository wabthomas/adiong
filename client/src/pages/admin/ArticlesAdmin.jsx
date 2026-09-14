import React, { useCallback, useEffect, useState } from 'react';
import { api, fmtDate } from '../../api.js';
import { PageTitle, Modal, Field, ImageInput, Toggle, DeleteButton } from './AdminUI.jsx';
import { categoryLabel } from '../../components/Cards.jsx';
import RichTextEditor from '../../components/RichTextEditor.jsx';

const empty = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  category: 'plaidoyer',
  image: '',
  author: 'ADI ONG',
  date: new Date().toISOString().slice(0, 10),
  published: true,
  seo_title: '',
  seo_description: '',
  seo_image: '',
  seo_noindex: false
};

const stripHtml = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div.textContent || '';
};

export default function ArticlesAdmin() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api.adminArticles.list().then(setItems).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...editing };
      if (!payload.excerpt?.trim()) {
        const text = stripHtml(payload.content).replace(/\s+/g, ' ').trim();
        payload.excerpt = text.length > 160 ? `${text.slice(0, 157)}…` : text;
      }
      if (editing.id) await api.adminArticles.update(editing.id, payload);
      else await api.adminArticles.create(payload);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!confirm(`Supprimer « ${item.title} » ?`)) return;
    await api.adminArticles.remove(item.id);
    load();
  };

  return (
    <div>
      <PageTitle
        title="Articles"
        subtitle="Publiez vos actualités, classées par domaine"
        action={
          <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => setEditing({ ...empty })}>
            + Nouvel article
          </button>
        }
      />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-cream/70 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-4">Titre</th>
                <th className="px-6 py-4">Catégorie</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {a.image && <img src={a.image} alt="" className="h-10 w-14 rounded-lg object-cover" />}
                      <span className="font-semibold text-ink-900 line-clamp-1 max-w-md">{a.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                      {categoryLabel(a.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-ink-500">{fmtDate(a.date)}</td>
                  <td className="px-6 py-4">
                    <Toggle
                      value={!!a.published}
                      onChange={async (v) => {
                        await api.adminArticles.update(a.id, { ...a, published: v });
                        load();
                      }}
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditing({ ...a, published: !!a.published })}
                        className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100"
                      >
                        Modifier
                      </button>
                      <DeleteButton onConfirm={() => remove(a)} />
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-ink-400">Aucun article.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Modifier l’article' : 'Nouvel article'} wide>
        {editing && (
          <div className="space-y-5">
            <Field label="Titre *">
              <input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Slug (URL)" hint="Laissez vide pour générer automatiquement">
                <input className="input" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
              </Field>
              <Field label="Catégorie">
                <select
                  className="input"
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                >
                  <option value="plaidoyer">Plaidoyer</option>
                  <option value="education">Éducation</option>
                  <option value="ecologie">Écologie</option>
                  <option value="socio_economique">Socio-économique</option>
                  <option value="entrepreneuriat">Entrepreneuriat</option>
                  <option value="actualites">Autre actualité</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Date">
                <input type="date" className="input" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
              </Field>
              <Field label="Auteur">
                <input className="input" value={editing.author} onChange={(e) => setEditing({ ...editing, author: e.target.value })} />
              </Field>
            </div>
            <Field label="Contenu" hint="Éditeur riche : utilisez la barre d'outils (titres, listes, images, liens…)">
              <RichTextEditor
                value={editing.content}
                onChange={(html) => setEditing({ ...editing, content: html })}
              />
            </Field>
            <Field label="Extrait (affiché sur les cartes)" hint="Laissez vide pour générer automatiquement depuis le contenu">
              <textarea className="input min-h-[70px]" value={editing.excerpt || ''} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} />
            </Field>
            <ImageInput label="Image de couverture" value={editing.image} onChange={(v) => setEditing({ ...editing, image: v })} />

            <details className="group rounded-2xl bg-cream p-5">
              <summary className="cursor-pointer select-none font-display font-bold text-ink-900">
                🔍 SEO <span className="ml-1 text-xs font-medium text-ink-400">(titres de recherche & partage social)</span>
              </summary>
              <div className="mt-5 space-y-5">
                <Field label="Titre SEO (titre de l'onglet & Google)" hint="Vide = titre de l'article">
                  <input className="input" value={editing.seo_title || ''} onChange={(e) => setEditing({ ...editing, seo_title: e.target.value })} placeholder={editing.title ? `${editing.title} — ADI ONG` : 'Ex : Mon article — ADI ONG'} />
                </Field>
                <Field label="Description SEO (Google + partage)" hint={`${(editing.seo_description || '').length}/160 caractères recommandés`}>
                  <textarea className="input min-h-[70px]" value={editing.seo_description || ''} onChange={(e) => setEditing({ ...editing, seo_description: e.target.value })} />
                </Field>
                <ImageInput label="Image de partage (Open Graph)" hint="Vide = image de couverture" value={editing.seo_image || ''} onChange={(v) => setEditing({ ...editing, seo_image: v })} />
                <Toggle value={!!editing.seo_noindex} onChange={(v) => setEditing({ ...editing, seo_noindex: v })} label="Exclure des moteurs de recherche (noindex)" />
              </div>
            </details>
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
