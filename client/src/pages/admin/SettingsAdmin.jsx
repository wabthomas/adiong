import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { PageTitle, Field, Modal, ImageInput } from './AdminUI.jsx';

const TABS = [
  ['identite', 'Identité & contact'],
  ['marque', 'Logo, favicone & SEO'],
  ['accueil', 'Accueil'],
  ['pages', 'En-têtes de pages'],
  ['apropos', 'À propos'],
  ['dons', 'Don & collectes'],
  ['compteurs', 'Compteurs & valeurs']
];

function FlatListEditor({ items, onChange, placeholder = 'Texte…', numeric = false }) {
  const list = items || [];
  return (
    <div className="space-y-2">
      {list.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            className="input !py-2.5 text-sm"
            type={numeric ? 'number' : 'text'}
            value={it}
            placeholder={placeholder}
            onChange={(e) => {
              const copy = [...list];
              copy[i] = numeric ? Number(e.target.value) || 0 : e.target.value;
              onChange(copy);
            }}
          />
          <button
            type="button"
            onClick={() => onChange(list.filter((_, j) => j !== i))}
            className="shrink-0 rounded-lg bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...list, numeric ? 0 : ''])}
        className="text-sm font-bold text-brand-600 hover:underline"
      >
        + Ajouter
      </button>
    </div>
  );
}

function PageHeaderEditor({ header, onChange }) {
  const h = header || {};
  const set = (k, v) => onChange({ ...h, [k]: v });
  return (
    <div className="rounded-2xl bg-cream p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Petit titre (kicker)">
          <input className="input !py-2.5 text-sm" value={h.kicker || ''} onChange={(e) => set('kicker', e.target.value)} />
        </Field>
        <Field label="Titre de page">
          <input className="input !py-2.5 text-sm" value={h.title || ''} onChange={(e) => set('title', e.target.value)} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Texte d'accompagnement">
          <textarea className="input !py-2.5 text-sm" rows={2} value={h.text || ''} onChange={(e) => set('text', e.target.value)} />
        </Field>
      </div>
      <div className="mt-3">
        <ImageInput label="Image d'en-tête" value={h.image || ''} onChange={(v) => set('image', v)} />
      </div>
    </div>
  );
}

function ItemListEditor({ items, onChange, fields = [['title', 'Titre'], ['text', 'Texte']], numericFirst = false }) {
  const list = items || [];
  return (
    <div className="space-y-4">
      {list.map((it, i) => (
        <div key={i} className="rounded-2xl bg-cream p-4">
          <div className="grid gap-3 sm:grid-cols-[200px_1fr_160px_auto]">
            {fields.map(([k, label], fi) => (
              <div key={k}>
                <label className="label !mb-1 text-xs">{label}</label>
                {k === 'text' ? (
                  <textarea
                    className="input !py-2 text-sm"
                    rows={2}
                    value={it[k] || ''}
                    onChange={(e) => {
                      const copy = list.map((x) => ({ ...x }));
                      copy[i] = { ...copy[i], [k]: e.target.value };
                      onChange(copy);
                    }}
                  />
                ) : (
                  <input
                    className="input !py-2 text-sm"
                    type={numericFirst && fi === 0 ? 'number' : 'text'}
                    value={it[k] ?? ''}
                    onChange={(e) => {
                      const copy = list.map((x) => ({ ...x }));
                      copy[i] = { ...copy[i], [k]: numericFirst && fi === 0 ? Number(e.target.value) || 0 : e.target.value };
                      onChange(copy);
                    }}
                  />
                )}
              </div>
            ))}
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => onChange(list.filter((_, j) => j !== i))}
                className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
              >
                Retirer
              </button>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...list, Object.fromEntries(fields.map(([k], fi) => [k, numericFirst && fi === 0 ? 0 : '']))])}
        className="text-sm font-bold text-brand-600 hover:underline"
      >
        + Ajouter un élément
      </button>
    </div>
  );
}

export default function SettingsAdmin() {
  const [s, setS] = useState(null);
  const [tab, setTab] = useState('identite');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState(null);

  useEffect(() => {
    api.adminSettings.get().then(setS).catch(() => {});
  }, []);

  if (!s) return <PageTitle title="Paramètres" />;

  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const setTextarea = (k) => (e) => setS({ ...s, [k]: e.target.value });

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const updated = await api.adminSettings.update(s);
      setS(updated);
      setMsg('✓ Tous les changements sont enregistrés et visibles sur le site');
    } catch (e) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const changePw = async () => {
    setPwMsg(null);
    if (pw.next !== pw.confirm) return setPwMsg({ ok: false, text: 'La confirmation ne correspond pas' });
    try {
      await api.password({ current: pw.current, next: pw.next });
      setPwMsg({ ok: true, text: '✓ Mot de passe modifié' });
      setPw({ current: '', next: '', confirm: '' });
    } catch (e) {
      setPwMsg({ ok: false, text: e.message });
    }
  };

  return (
    <div>
      <PageTitle
        title="Paramètres du site"
        subtitle="Tout le contenu du site est éditable ici — chaque changement est visible immédiatement après enregistrement"
        action={
          <div className="flex gap-2">
            <button className="btn-ghost !px-5 !py-2.5 text-sm" onClick={() => setPwOpen(true)}>
              Changer le mot de passe
            </button>
            <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={save} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer les changements'}
            </button>
          </div>
        }
      />

      {msg && (
        <p className={`mb-5 rounded-xl px-4 py-3 text-sm font-semibold ${msg.startsWith('✓') ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>
          {msg}
        </p>
      )}

      {}
      <div className="mb-8 flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
              tab === id ? 'bg-brand-600 text-white shadow-soft' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:ring-brand-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'identite' && (
        <div className="card grid gap-5 p-7 sm:grid-cols-2">
          <Field label="Nom du site"><input className="input" value={s.site_name || ''} onChange={set('site_name')} /></Field>
          <Field label="Slogan (tagline)"><input className="input" value={s.site_tagline || ''} onChange={set('site_tagline')} /></Field>
          <div className="sm:col-span-2">
            <Field label="Adresse"><input className="input" value={s.address || ''} onChange={set('address')} /></Field>
          </div>
          <Field label="Téléphone 1"><input className="input" value={s.phone1 || ''} onChange={set('phone1')} /></Field>
          <Field label="Téléphone 2"><input className="input" value={s.phone2 || ''} onChange={set('phone2')} /></Field>
          <Field label="Email"><input className="input" value={s.email || ''} onChange={set('email')} /></Field>
          <Field label="WhatsApp (format international)"><input className="input" value={s.whatsapp || ''} onChange={set('whatsapp')} /></Field>
          <Field label="Lien Facebook"><input className="input" value={s.facebook || ''} onChange={set('facebook')} /></Field>
          <Field label="Lien X / Twitter"><input className="input" value={s.twitter || ''} onChange={set('twitter')} /></Field>
          <Field label="Lien Instagram"><input className="input" value={s.instagram || ''} onChange={set('instagram')} /></Field>
          <Field label="Lien Pinterest"><input className="input" value={s.pinterest || ''} onChange={set('pinterest')} /></Field>
          <Field label="Lien de la vidéo (bouton « Voir la vidéo » sur l'accueil, optionnel)"><input className="input" value={s.video_url || ''} onChange={set('video_url')} /></Field>
          <div className="sm:col-span-2">
            <Field label="Texte de copyright (pied de page)"><input className="input" value={s.copyright || ''} onChange={set('copyright')} /></Field>
          </div>
        </div>
      )}

      {tab === 'marque' && (
        <div className="space-y-6">
          <div className="card space-y-5 p-7">
            <h3 className="font-display text-lg font-bold text-ink-900">Logo & favicone</h3>
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <ImageInput
                  label="Logo du site (barre de navigation & pied de page)"
                  hint="PNG/SVG avec fond transparent recommandé — laisser vide pour le logo par défaut"
                  value={s.logo || ''}
                  onChange={(v) => setS({ ...s, logo: v })}
                />
                {s.logo && (
                  <div className="mt-3 flex items-center gap-4 rounded-xl bg-cream p-3">
                    <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-ink-100">
                      <img src={s.logo} alt="Aperçu logo" className="h-9 max-w-[120px] object-contain" />
                      <span className="text-xs font-bold text-ink-700">{s.site_name}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-ink-400">Aperçu dans la navigation</span>
                  </div>
                )}
              </div>
              <div>
                <ImageInput
                  label="Favicone (icône de l'onglet du navigateur)"
                  hint="Image carrée 512×512 minimum"
                  value={s.favicon || ''}
                  onChange={(v) => setS({ ...s, favicon: v })}
                />
                {s.favicon && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl bg-cream p-3">
                    <img src={s.favicon} alt="Favicone" className="h-8 w-8 rounded" />
                    <span className="text-[11px] font-semibold text-ink-400">Icône de l'onglet du navigateur</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card space-y-5 p-7">
            <h3 className="font-display text-lg font-bold text-ink-900">SEO global</h3>
            <p className="text-sm text-ink-400">
              Utilisé sur toutes les pages sans SEO propre (l'accueil notamment). Les articles ont leur propre SEO,
              éditables dans chaque article.
            </p>
            <Field label="Titre par défaut (onglet du navigateur)" hint={`${(s.seo_title || '').length}/60 caractères recommandés`}>
              <input className="input" value={s.seo_title || ''} onChange={set('seo_title')} />
            </Field>
            <Field label="Description par défaut (Google & partage)" hint={`${(s.seo_description || '').length}/160 caractères recommandés`}>
              <textarea className="input" rows={3} value={s.seo_description || ''} onChange={setTextarea('seo_description')} />
            </Field>
            <Field label="Mots-clés (optionnel, séparés par des virgules)">
              <input className="input" value={s.seo_keywords || ''} onChange={set('seo_keywords')} />
            </Field>
            <div className="grid gap-5 lg:grid-cols-2">
              <ImageInput
                label="Image de partage par défaut (Open Graph)"
                hint="Affichée quand vous partagez une page sur Facebook, WhatsApp, X…"
                value={s.og_image || ''}
                onChange={(v) => setS({ ...s, og_image: v })}
              />
              <Field label="Compte X / Twitter">
                <input className="input" value={s.twitter_handle || ''} onChange={set('twitter_handle')} placeholder="@adiong" />
              </Field>
            </div>
            <div className="rounded-2xl bg-cream p-5">
              <p className="text-xs font-bold tracking-wide text-ink-400 uppercase">Aperçu de la carte de partage</p>
              <div className="mt-3 max-w-sm overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-ink-950/5">
                <img src={s.og_image || '/uploads/seed/hero.jpg'} alt="" className="h-40 w-full object-cover" />
                <div className="p-4">
                  <p className="text-[10px] font-bold uppercase text-ink-300">{window.location.host}</p>
                  <p className="mt-1 text-sm font-bold text-ink-900">{s.seo_title || 'ADI ONG'}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500 line-clamp-2">{s.seo_description || ''}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'accueil' && (
        <div className="space-y-6">
          <div className="card space-y-5 p-7">
            <h3 className="font-display text-lg font-bold text-ink-900">Section d'accueil (hero)</h3>
            <ImageInput label="Image de fond de l'accueil" value={s.hero_image || ''} onChange={(v) => setS({ ...s, hero_image: v })} />
            <Field label="Petit titre (kicker)">
              <input className="input" value={s.hero_kicker || ''} onChange={set('hero_kicker')} />
            </Field>
            <Field label="Grand titre">
              <textarea className="input" rows={2} value={s.hero_title || ''} onChange={setTextarea('hero_title')} />
            </Field>
            <Field label="Texte d'accompagnement">
              <textarea className="input" rows={3} value={s.hero_text || ''} onChange={setTextarea('hero_text')} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Badge — titre">
                <input className="input" value={s.hero_badge_title || ''} onChange={set('hero_badge_title')} />
              </Field>
              <Field label="Badge — sous-titre">
                <input className="input" value={s.hero_badge_sub || ''} onChange={set('hero_badge_sub')} />
              </Field>
            </div>
          </div>

          <div className="card space-y-5 p-7">
            <h3 className="font-display text-lg font-bold text-ink-900">Section « Notre mission »</h3>
            <Field label="Image de la section">
              <ImageInput label="" value={s.about_image || ''} onChange={(v) => setS({ ...s, about_image: v })} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Petit titre (kicker)">
                <input className="input" value={s.mission_title || ''} onChange={set('mission_title')} />
              </Field>
              <Field label="Grand titre">
                <input className="input" value={s.home_mission_heading || ''} onChange={set('home_mission_heading')} />
              </Field>
            </div>
            <Field label="Texte de la mission">
              <textarea className="input" rows={4} value={s.mission_text || ''} onChange={setTextarea('mission_text')} />
            </Field>
          </div>

          <div className="card space-y-5 p-7">
            <h3 className="font-display text-lg font-bold text-ink-900">Bandeau défilant (mots-clés)</h3>
            <Field label="Les mots séparés par ✦" hint="Chaque élément est une case ci-dessous">
              <FlatListEditor items={s.marquee_items || []} onChange={(v) => setS({ ...s, marquee_items: v })} placeholder="Mot ou expression" />
            </Field>
          </div>

          <div className="card grid gap-5 p-7 sm:grid-cols-3">
            <div>
              <h3 className="mb-4 font-display text-lg font-bold text-ink-900">Section « Notre travail »</h3>
              <Field label="Kicker"><input className="input" value={s.home_work_kicker || ''} onChange={set('home_work_kicker')} /></Field>
              <div className="mt-4"><Field label="Titre"><input className="input" value={s.home_work_title || ''} onChange={set('home_work_title')} /></Field></div>
              <div className="mt-4"><Field label="Texte"><textarea className="input" rows={3} value={s.home_work_text || ''} onChange={setTextarea('home_work_text')} /></Field></div>
            </div>
            <div>
              <h3 className="mb-4 font-display text-lg font-bold text-ink-900">Section « Actualités »</h3>
              <Field label="Kicker"><input className="input" value={s.home_news_kicker || ''} onChange={set('home_news_kicker')} /></Field>
              <div className="mt-4"><Field label="Titre"><input className="input" value={s.home_news_title || ''} onChange={set('home_news_title')} /></Field></div>
              <div className="mt-4"><Field label="Texte"><textarea className="input" rows={3} value={s.home_news_text || ''} onChange={setTextarea('home_news_text')} /></Field></div>
            </div>
            <div>
              <h3 className="mb-4 font-display text-lg font-bold text-ink-900">Bannière « Coup de main »</h3>
              <Field label="Kicker"><input className="input" value={s.cta_kicker || ''} onChange={set('cta_kicker')} /></Field>
              <div className="mt-4"><Field label="Titre"><textarea className="input" rows={2} value={s.cta_title || ''} onChange={setTextarea('cta_title')} /></Field></div>
              <div className="mt-4"><Field label="Texte"><textarea className="input" rows={3} value={s.cta_text || ''} onChange={setTextarea('cta_text')} /></Field></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'pages' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {[
            ['about_header', 'Page « À propos »'],
            ['work_header', 'Page « Notre travail »'],
            ['news_header', 'Page « Actualités »'],
            ['campaigns_header', 'Page « Collectes »'],
            ['donate_header', 'Page « Faire un don »'],
            ['contact_header', 'Page « Contact »']
          ].map(([key, label]) => (
            <div key={key} className="card p-6">
              <h3 className="mb-4 font-display text-lg font-bold text-ink-900">{label}</h3>
              <PageHeaderEditor header={s[key] || {}} onChange={(v) => setS({ ...s, [key]: v })} />
            </div>
          ))}
        </div>
      )}

      {tab === 'apropos' && (
        <div className="space-y-6">
          <div className="card space-y-5 p-7">
            <h3 className="font-display text-lg font-bold text-ink-900">Présentation</h3>
            <Field label="Titre"><input className="input" value={s.about_title || ''} onChange={set('about_title')} /></Field>
            <Field label="Texte"><textarea className="input" rows={4} value={s.about_text || ''} onChange={setTextarea('about_text')} /></Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="card space-y-5 p-7">
              <h3 className="font-display text-lg font-bold text-ink-900">Section « Valeurs »</h3>
              <Field label="Kicker"><input className="input" value={s.about_values_kicker || ''} onChange={set('about_values_kicker')} /></Field>
              <Field label="Titre"><input className="input" value={s.about_values_title || ''} onChange={set('about_values_title')} /></Field>
            </div>
            <div className="card space-y-5 p-7">
              <h3 className="font-display text-lg font-bold text-ink-900">Section « Méthode de travail »</h3>
              <Field label="Kicker"><input className="input" value={s.about_method_kicker || ''} onChange={set('about_method_kicker')} /></Field>
              <Field label="Titre"><input className="input" value={s.about_method_title || ''} onChange={set('about_method_title')} /></Field>
              <Field label="Texte d'intro"><textarea className="input" rows={2} value={s.about_method_text || ''} onChange={setTextarea('about_method_text')} /></Field>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="card space-y-5 p-7">
              <h3 className="font-display text-lg font-bold text-ink-900">Carte « Notre présence »</h3>
              <Field label="Titre"><input className="input" value={s.about_presence_title || ''} onChange={set('about_presence_title')} /></Field>
              <Field label="Texte"><textarea className="input" rows={4} value={s.about_presence_text || ''} onChange={setTextarea('about_presence_text')} /></Field>
            </div>
            <div className="card space-y-5 p-7">
              <h3 className="font-display text-lg font-bold text-ink-900">Carte « Carrière & bénévolat »</h3>
              <Field label="Titre"><input className="input" value={s.about_career_title || ''} onChange={set('about_career_title')} /></Field>
              <Field label="Texte" hint="Le mail de contact est inséré automatiquement à la fin">
                <textarea className="input" rows={4} value={s.about_career_text || ''} onChange={setTextarea('about_career_text')} />
              </Field>
            </div>
          </div>
        </div>
      )}

      {tab === 'dons' && (
        <div className="space-y-6">
          <div className="card space-y-5 p-7">
            <h3 className="font-display text-lg font-bold text-ink-900">Page « Faire un don »</h3>
            <Field label="Montants proposés (USD)" hint="Les boutons de montants rapides sur le formulaire">
              <FlatListEditor numeric items={s.donate_amounts || []} onChange={(v) => setS({ ...s, donate_amounts: v })} placeholder="Montant" />
            </Field>
            <Field label="Titre « Pourquoi donner »">
              <input className="input" value={s.donate_why_title || ''} onChange={set('donate_why_title')} />
            </Field>
            <Field label="Points « Pourquoi donner »">
              <FlatListEditor items={s.donate_why_points || []} onChange={(v) => setS({ ...s, donate_why_points: v })} placeholder="Point de vente" />
            </Field>
          </div>
          <div className="card space-y-5 p-7">
            <h3 className="font-display text-lg font-bold text-ink-900">Pages des campagnes</h3>
            <Field label="Points de réassurance (« À quoi sert cette collecte ? »)">
              <FlatListEditor items={s.campaign_points || []} onChange={(v) => setS({ ...s, campaign_points: v })} placeholder="Point de réassurance" />
            </Field>
          </div>
        </div>
      )}

      {tab === 'compteurs' && (
        <div className="space-y-6">
          <div className="card space-y-5 p-7">
            <h3 className="font-display text-lg font-bold text-ink-900">Statistiques (compteurs animés de l'accueil)</h3>
            <p className="text-sm text-ink-400">Le 1ᵉ compteur est aussi affiché dans la carte flottante du hero.</p>
            <ItemListEditor
              numericFirst
              items={s.stats || []}
              onChange={(v) => setS({ ...s, stats: v })}
              fields={[
                ['value', 'Valeur (nombre)'],
                ['suffix', 'Suffixe (ex. +, ans)'],
                ['label', 'Libellé']
              ]}
            />
          </div>
          <div className="card space-y-5 p-7">
            <h3 className="font-display text-lg font-bold text-ink-900">Valeurs (page À propos)</h3>
            <ItemListEditor items={s.values || []} onChange={(v) => setS({ ...s, values: v })} />
          </div>
          <div className="card space-y-5 p-7">
            <h3 className="font-display text-lg font-bold text-ink-900">Méthode de travail (page À propos)</h3>
            <ItemListEditor items={s.method || []} onChange={(v) => setS({ ...s, method: v })} />
          </div>
        </div>
      )}

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Changer le mot de passe">
        <div className="space-y-5">
          <Field label="Mot de passe actuel">
            <input type="password" className="input" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </Field>
          <Field label="Nouveau mot de passe" hint="8 caractères minimum">
            <input type="password" className="input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </Field>
          <Field label="Confirmation">
            <input type="password" className="input" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </Field>
          {pwMsg && (
            <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${pwMsg.ok ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>
              {pwMsg.text}
            </p>
          )}
          <button className="btn-primary w-full" onClick={changePw} disabled={!pw.current || pw.next.length < 8}>
            Mettre à jour
          </button>
        </div>
      </Modal>
    </div>
  );
}
