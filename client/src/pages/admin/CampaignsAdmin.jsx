import React, { useCallback, useEffect, useState } from 'react';
import { api, fmtMoney, fmtDate } from '../../api.js';
import { PageTitle, Modal, Field, ImageInput, Toggle, DeleteButton } from './AdminUI.jsx';

const empty = {
  title: '',
  slug: '',
  description: '',
  image: '',
  goal_amount: 1000,
  collected_amount: 0,
  deadline: '',
  cause_slug: '',
  published: true
};

export default function CampaignsAdmin() {
  const [items, setItems] = useState([]);
  const [causes, setCauses] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.adminCampaigns.list().then(setItems).catch(() => {});
    api.adminCauses.list().then(setCauses).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...editing,
        goal_amount: Number(editing.goal_amount) || 0,
        collected_amount: Number(editing.collected_amount) || 0
      };
      if (editing.id) await api.adminCampaigns.update(editing.id, payload);
      else await api.adminCampaigns.create(payload);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!confirm(`Supprimer la campagne « ${item.title} » ?`)) return;
    await api.adminCampaigns.remove(item.id);
    load();
  };

  return (
    <div>
      <PageTitle
        title="Campagnes de collecte"
        subtitle="Créez et gérez vos levées de fonds"
        action={
          <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => setEditing({ ...empty })}>
            + Nouvelle campagne
          </button>
        }
      />

      <div className="grid gap-5 md:grid-cols-2">
        {items.map((c) => {
          const pct = Math.min(100, Math.round((c.collected_amount / (c.goal_amount || 1)) * 100));
          return (
            <div key={c.id} className="card overflow-hidden">
              <div className="relative h-40">
                {c.image && <img src={c.image} alt="" className="h-full w-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 to-transparent" />
                <p className="absolute bottom-3 left-5 font-display text-lg font-bold text-white drop-shadow">{c.title}</p>
                {!c.published && (
                  <span className="absolute top-3 right-3 rounded-full bg-ink-950/70 px-3 py-1 text-xs font-bold text-white">Brouillon</span>
                )}
              </div>
              <div className="p-6">
                <div className="mb-1.5 flex justify-between text-sm font-semibold text-ink-600">
                  <span>{fmtMoney(c.collected_amount)}</span>
                  <span>Objectif {fmtMoney(c.goal_amount)}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-400" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-ink-50 pt-4">
                  <span className="text-xs font-bold text-ink-400">
                    {c.deadline ? `Jusqu'au ${fmtDate(c.deadline)}` : 'Sans échéance'}
                  </span>
                  <div className="flex items-center gap-2">
                    <Toggle
                      value={!!c.published}
                      onChange={async (v) => {
                        await api.adminCampaigns.update(c.id, { ...c, published: v });
                        load();
                      }}
                    />
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
            </div>
          );
        })}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Modifier la campagne' : 'Nouvelle campagne'} wide>
        {editing && (
          <div className="space-y-5">
            <Field label="Titre *">
              <input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </Field>
            <Field label="Slug (URL)" hint="Laissez vide pour générer automatiquement">
              <input className="input" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
            </Field>
            <Field label="Description">
              <textarea className="input min-h-[100px]" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Objectif (USD)">
                <input type="number" min="0" className="input" value={editing.goal_amount} onChange={(e) => setEditing({ ...editing, goal_amount: e.target.value })} />
              </Field>
              <Field label="Déjà collecté (USD)">
                <input type="number" min="0" className="input" value={editing.collected_amount} onChange={(e) => setEditing({ ...editing, collected_amount: e.target.value })} />
              </Field>
              <Field label="Échéance">
                <input type="date" className="input" value={editing.deadline} onChange={(e) => setEditing({ ...editing, deadline: e.target.value })} />
              </Field>
            </div>
            <Field label="Cause liée (optionnel)">
              <select className="input" value={editing.cause_slug} onChange={(e) => setEditing({ ...editing, cause_slug: e.target.value })}>
                <option value="">Aucune</option>
                {causes.map((c) => (
                  <option key={c.id} value={c.slug}>{c.title}</option>
                ))}
              </select>
            </Field>
            <ImageInput value={editing.image} onChange={(v) => setEditing({ ...editing, image: v })} />
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
