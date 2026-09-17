import React, { useCallback, useEffect, useState } from 'react';
import { api, fmtDate } from '../../api.js';
import { PageTitle, Modal, Field, ImageInput, Toggle, DeleteButton } from './AdminUI.jsx';
import { categoryLabel } from '../../components/Cards.jsx';
import RichTextEditor from '../../components/RichTextEditor.jsx';
import { useSite } from '../../hooks/useSite.jsx';

const emptyArticle = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  category: '',
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
  const { reload } = useSite();
  const [tab, setTab] = useState('articles');
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [error, setError] = useState('');
  const [catError, setCatError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.adminArticles.list().then(setItems).catch(() => {});
    api.adminArticleCategories.list().then(setCats).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const defaultCat = cats[0]?.slug || 'actualites';

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...editing, category: editing.category || defaultCat };
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

  const saveCat = async () => {
    setSaving(true);
    setCatError('');
    try {
      if (editingCat.id) await api.adminArticleCategories.update(editingCat.id, editingCat);
      else await api.adminArticleCategories.create(editingCat);
      setEditingCat(null);
      load();
      reload?.();
    } catch (e) {
      setCatError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeCat = async (c) => {
    if (!confirm(`Supprimer la catégorie « ${c.name} » ?`)) return;
    try {
      await api.adminArticleCategories.remove(c.id);
      load();
      reload?.();
    } catch (e) {
      alert(e.message);
    }
  };

  const moveCat = async (c, dir) => {
    const list = [...cats];
    const idx = list.findIndex((x) => x.id === c.id);
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    try {
      for (let i = 0; i < list.length; i++) {
        const order = (i + 1) * 10;
        if (list[i].sort_order !== order) {
          await api.adminArticleCategories.update(list[i].id, { ...list[i], sort_order: order });
        }
      }
      load();
      reload?.();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div>
      <PageTitle
        title="Articles"
        subtitle="Publiez vos actualités et gérez les catégories du site"
        action={
          tab === 'articles' ? (
            <button
              className="btn-primary !px-5 !py-2.5 text-sm"
              onClick={() => setEditing({ ...emptyArticle, category: defaultCat })}
            >
              + Nouvel article
            </button>
          ) : (
            <button
              className="btn-primary !px-5 !py-2.5 text-sm"
              onClick={() => setEditingCat({ name: '', slug: '', sort_order: (cats.length + 1) * 10 })}
            >
              + Nouvelle catégorie
            </button>
          )
        }
      />

      <div className="mb-5 flex gap-2">
        {[
          ['articles', 'Articles'],
          ['categories', 'Catégories']
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              tab === id ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-100'
            }`}
          >
            {label}
            {id === 'categories' && (
              <span className="ml-1.5 text-[11px] opacity-80">{cats.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'articles' && (
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
                        {categoryLabel(a.category, cats)}
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
      )}

      {tab === 'categories' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-ink-100 bg-cream/70 text-xs font-bold tracking-wide text-ink-400 uppercase">
                <tr>
                  <th className="px-6 py-4">Ordre</th>
                  <th className="px-6 py-4">Nom</th>
                  <th className="px-6 py-4">Slug</th>
                  <th className="px-6 py-4">Articles</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cats.map((c, i) => (
                  <tr key={c.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => moveCat(c, -1)}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-ink-50 text-ink-600 disabled:opacity-30"
                          aria-label="Monter"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={i === cats.length - 1}
                          onClick={() => moveCat(c, 1)}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-ink-50 text-ink-600 disabled:opacity-30"
                          aria-label="Descendre"
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-ink-900">{c.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-ink-500">{c.slug}</td>
                    <td className="px-6 py-4 text-ink-600">{c.articles || 0}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingCat({ ...c })}
                          className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100"
                        >
                          Modifier
                        </button>
                        <DeleteButton onConfirm={() => removeCat(c)} />
                      </div>
                    </td>
                  </tr>
                ))}
                {cats.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-ink-400">Aucune catégorie.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-ink-50 px-6 py-3 text-xs text-ink-400">
            Les filtres de la page Actualités et les libellés du site utilisent ces catégories. Une catégorie utilisée par des articles ne peut pas être supprimée.
          </p>
        </div>
      )}

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
                  value={editing.category || defaultCat}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                >
                  {cats.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.name}</option>
                  ))}
                  {editing.category && !cats.some((c) => c.slug === editing.category) && (
                    <option value={editing.category}>{editing.category}</option>
                  )}
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

      <Modal open={!!editingCat} onClose={() => setEditingCat(null)} title={editingCat?.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}>
        {editingCat && (
          <div className="space-y-5">
            <Field label="Nom *">
              <input
                className="input"
                value={editingCat.name}
                onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                placeholder="Ex. Plaidoyer"
              />
            </Field>
            <Field label="Slug (URL / filtre)" hint="Vide = généré depuis le nom. Changer le slug met à jour les articles rattachés.">
              <input
                className="input font-mono"
                value={editingCat.slug}
                onChange={(e) => setEditingCat({ ...editingCat, slug: e.target.value })}
                placeholder="ex. plaidoyer"
              />
            </Field>
            <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-5">
              {catError && <span className="text-sm font-semibold text-red-600">{catError}</span>}
              <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={saveCat} disabled={saving || !editingCat.name.trim()}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
