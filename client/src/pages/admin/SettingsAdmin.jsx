import React, { useEffect, useState } from 'react';
import { api, getSavedUser, setMoneyCurrency } from '../../api.js';
import { useSite } from '../../hooks/useSite.jsx';
import { PageTitle, Field, Modal, ImageInput } from './AdminUI.jsx';

const TABS = [
  { id: 'identite', label: 'Identité', hint: 'Nom, contact, réseaux', icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z' },
  { id: 'marque', label: 'Marque & SEO', hint: 'Logo, favicone, Google', icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z' },
  { id: 'accueil', label: 'Accueil', hint: 'Hero, mission, bandeau', icon: 'M2.25 12 11.204 3.045c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25' },
  { id: 'pages', label: 'Pages', hint: 'En-têtes des pages', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' },
  { id: 'apropos', label: 'À propos', hint: 'Présentation, valeurs', icon: 'M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z' },
  { id: 'dons', label: 'Dons', hint: 'Montants et collectes', icon: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z' },
  { id: 'compteurs', label: 'Compteurs', hint: 'Stats et listes', icon: 'M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z' },
  { id: 'modules', label: 'Modules', hint: 'GRH, POS, maintenance', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z' }
];

function TabIcon({ d }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor" className="h-5 w-5 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function SettingsSection({ title, desc, children }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink-950/5">
      {(title || desc) && (
        <div className="border-b border-ink-100 px-6 py-4">
          {title && <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>}
          {desc && <p className="mt-0.5 text-sm text-ink-400">{desc}</p>}
        </div>
      )}
      <div className="space-y-5 p-6">{children}</div>
    </section>
  );
}

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
  const { reload } = useSite();
  const [s, setS] = useState(null);
  const [tab, setTab] = useState('identite');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const [modules, setModules] = useState(null);
  const [modMsg, setModMsg] = useState('');

  const isSuper = getSavedUser()?.role === 'super_admin';
  const visibleTabs = isSuper ? TABS : TABS.filter((t) => t.id !== 'modules');

  useEffect(() => {
    api.adminSettings.get().then((data) => {
      setS(data);
      setMoneyCurrency(data.currency);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isSuper) api.modules.get().then(setModules).catch(() => {});
  }, [isSuper]);

  const toggleGrh = async (value) => {
    setModMsg('');
    try {
      const m = await api.modules.update({ grh_enabled: value });
      setModules(m);
      setModMsg(value
        ? '✓ Module GRH activé — visible par les administrateurs dans le menu de gauche.'
        : '✓ Module GRH désactivé — le menu est masqué et l’API GRH fermée.');
    } catch (e) {
      setModMsg(`✗ ${e.message}`);
    }
  };

  const togglePos = async (value) => {
    setModMsg('');
    try {
      const m = await api.modules.update({ pos_enabled: value });
      setModules(m);
      setModMsg(value
        ? '✓ Point de vente activé — visible par les administrateurs dans le menu de gauche.'
        : '✓ Point de vente désactivé — le menu est masqué et l’API POS fermée.');
    } catch (e) {
      setModMsg(`✗ ${e.message}`);
    }
  };

  const toggleMaintenance = async (value) => {
    setModMsg('');
    try {
      const m = await api.modules.update({ maintenance_enabled: value });
      setModules(m);
      await reload();
      setModMsg(value
        ? '✓ Mode maintenance activé — le site public affiche la page de maintenance. L’admin reste accessible.'
        : '✓ Mode maintenance désactivé — le site public est de nouveau en ligne.');
    } catch (e) {
      setModMsg(`✗ ${e.message}`);
    }
  };

  const saveMaintenanceMessage = async () => {
    setModMsg('');
    try {
      const m = await api.modules.update({
        maintenance_message: modules?.maintenance_message || ''
      });
      setModules(m);
      await reload();
      setModMsg('✓ Message de maintenance enregistré.');
    } catch (e) {
      setModMsg(`✗ ${e.message}`);
    }
  };

  if (!s) return <PageTitle title="Paramètres" />;

  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const setTextarea = (k) => (e) => setS({ ...s, [k]: e.target.value });

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const updated = await api.adminSettings.update(s);
      setS(updated);
      setMoneyCurrency(updated.currency);
      reload?.();
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

  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];

  return (
    <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <aside className="mb-6 lg:sticky lg:top-24 lg:mb-0">
        <p className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">Rubriques</p>
        <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {visibleTabs.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors lg:w-full ${
                  on ? 'bg-white text-brand-800 shadow-soft ring-1 ring-brand-100' : 'text-ink-600 hover:bg-white/70'
                }`}
              >
                <span className={`grid h-9 w-9 place-items-center rounded-lg ${on ? 'bg-brand-600 text-white' : 'bg-white text-ink-500 ring-1 ring-ink-100'}`}>
                  <TabIcon d={t.icon} />
                </span>
                <span className="hidden min-w-0 lg:block">
                  <span className="block text-sm font-bold">{t.label}</span>
                  <span className="block text-[11px] font-medium text-ink-400">{t.hint}</span>
                </span>
                <span className="text-sm font-bold lg:hidden">{t.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

    <div>
        <div className="sticky top-16 z-20 -mx-4 mb-6 border-b border-ink-100 bg-[#f4f6fb]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-2xl lg:border lg:bg-white/90 lg:px-5 lg:shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-ink-900">{activeTab.label}</h2>
              <p className="text-sm text-ink-400">{activeTab.hint} — visible sur le site dès l'enregistrement</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost !px-4 !py-2 text-sm" onClick={() => setPwOpen(true)}>
                Mot de passe
            </button>
              <button type="button" className="btn-primary !px-5 !py-2 text-sm" onClick={save} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            </div>
          </div>
      {msg && (
            <p className={`mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold ${msg.startsWith('✓') ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>
          {msg}
        </p>
      )}
      </div>

      {tab === 'identite' && (
        <SettingsSection title="Identité & contact" desc="Coordonnées affichées dans le pied de page et la page Contact.">
          <div className="grid gap-5 sm:grid-cols-2">
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
            <div className="sm:col-span-2">
              <Field label="Mention à droite du copyright" hint="Écrivez {heart} pour afficher le cœur orange.">
                <input className="input" value={s.footer_credit || ''} onChange={set('footer_credit')} placeholder="Fait avec {heart} pour l'inclusion" />
              </Field>
          </div>
        </div>
        </SettingsSection>
      )}

      {tab === 'marque' && (
        <div className="space-y-5">
          <SettingsSection title="Logo & favicone" desc="PNG transparent recommandé pour le logo. Favicone carrée 512×512.">
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
          </SettingsSection>

          <SettingsSection title="SEO global" desc="Utilisé sur les pages sans SEO propre (accueil). Les articles ont leur propre fiche SEO.">
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
          </SettingsSection>
        </div>
      )}

      {tab === 'accueil' && (
        <div className="space-y-5">
          <SettingsSection title="Section d'accueil (hero)">
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
          </SettingsSection>

          <SettingsSection title="Section « Notre mission »">
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
          </SettingsSection>

          <SettingsSection title="Bandeau défilant (mots-clés)">
            <Field label="Les mots séparés par ✦" hint="Chaque élément est une case ci-dessous">
              <FlatListEditor items={s.marquee_items || []} onChange={(v) => setS({ ...s, marquee_items: v })} placeholder="Mot ou expression" />
            </Field>
          </SettingsSection>

          <div className="grid gap-5 lg:grid-cols-3">
            <SettingsSection title="Section « Notre travail »">
              <Field label="Kicker"><input className="input" value={s.home_work_kicker || ''} onChange={set('home_work_kicker')} /></Field>
              <Field label="Titre"><input className="input" value={s.home_work_title || ''} onChange={set('home_work_title')} /></Field>
              <Field label="Texte"><textarea className="input" rows={3} value={s.home_work_text || ''} onChange={setTextarea('home_work_text')} /></Field>
            </SettingsSection>
            <SettingsSection title="Section « Actualités »">
              <Field label="Kicker"><input className="input" value={s.home_news_kicker || ''} onChange={set('home_news_kicker')} /></Field>
              <Field label="Titre"><input className="input" value={s.home_news_title || ''} onChange={set('home_news_title')} /></Field>
              <Field label="Texte"><textarea className="input" rows={3} value={s.home_news_text || ''} onChange={setTextarea('home_news_text')} /></Field>
            </SettingsSection>
            <SettingsSection title="Bannière « Coup de main »">
              <Field label="Kicker"><input className="input" value={s.cta_kicker || ''} onChange={set('cta_kicker')} /></Field>
              <Field label="Titre"><textarea className="input" rows={2} value={s.cta_title || ''} onChange={setTextarea('cta_title')} /></Field>
              <Field label="Texte"><textarea className="input" rows={3} value={s.cta_text || ''} onChange={setTextarea('cta_text')} /></Field>
            </SettingsSection>
          </div>
        </div>
      )}

      {tab === 'pages' && (
        <div className="grid gap-5 lg:grid-cols-2">
          {[
            ['about_header', 'Page « À propos »'],
            ['work_header', 'Page « Notre travail »'],
            ['news_header', 'Page « Actualités »'],
            ['campaigns_header', 'Page « Collectes »'],
            ['donate_header', 'Page « Faire un don »'],
            ['contact_header', 'Page « Contact »']
          ].map(([key, label]) => (
            <SettingsSection key={key} title={label}>
              <PageHeaderEditor header={s[key] || {}} onChange={(v) => setS({ ...s, [key]: v })} />
            </SettingsSection>
          ))}
        </div>
      )}

      {tab === 'apropos' && (
        <div className="space-y-5">
          <SettingsSection title="Présentation">
            <Field label="Titre"><input className="input" value={s.about_title || ''} onChange={set('about_title')} /></Field>
            <Field label="Texte"><textarea className="input" rows={4} value={s.about_text || ''} onChange={setTextarea('about_text')} /></Field>
          </SettingsSection>
          <div className="grid gap-5 sm:grid-cols-2">
            <SettingsSection title="Section « Valeurs »">
              <Field label="Kicker"><input className="input" value={s.about_values_kicker || ''} onChange={set('about_values_kicker')} /></Field>
              <Field label="Titre"><input className="input" value={s.about_values_title || ''} onChange={set('about_values_title')} /></Field>
            </SettingsSection>
            <SettingsSection title="Section « Méthode de travail »">
              <Field label="Kicker"><input className="input" value={s.about_method_kicker || ''} onChange={set('about_method_kicker')} /></Field>
              <Field label="Titre"><input className="input" value={s.about_method_title || ''} onChange={set('about_method_title')} /></Field>
              <Field label="Texte d'intro"><textarea className="input" rows={2} value={s.about_method_text || ''} onChange={setTextarea('about_method_text')} /></Field>
            </SettingsSection>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <SettingsSection title="Carte « Notre présence »">
              <Field label="Titre"><input className="input" value={s.about_presence_title || ''} onChange={set('about_presence_title')} /></Field>
              <Field label="Texte"><textarea className="input" rows={4} value={s.about_presence_text || ''} onChange={setTextarea('about_presence_text')} /></Field>
            </SettingsSection>
            <SettingsSection title="Carte « Carrière & bénévolat »">
              <Field label="Titre"><input className="input" value={s.about_career_title || ''} onChange={set('about_career_title')} /></Field>
              <Field label="Texte" hint="Le mail de contact est inséré automatiquement à la fin">
                <textarea className="input" rows={4} value={s.about_career_text || ''} onChange={setTextarea('about_career_text')} />
              </Field>
            </SettingsSection>
          </div>
        </div>
      )}

      {tab === 'dons' && (
        <div className="space-y-5">
          <SettingsSection title="Page « Faire un don »">
            <Field label="Devise" hint="Utilisée pour les dons, collectes et montants affichés sur le site.">
              <select className="input" value={s.currency || 'USD'} onChange={set('currency')}>
                <option value="USD">Dollar américain (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="CDF">Franc congolais (CDF)</option>
              </select>
            </Field>
            <Field label={`Montants proposés (${s.currency || 'USD'})`} hint="Les boutons de montants rapides sur le formulaire">
              <FlatListEditor numeric items={s.donate_amounts || []} onChange={(v) => setS({ ...s, donate_amounts: v })} placeholder="Montant" />
            </Field>
            <Field label="Titre « Pourquoi donner »">
              <input className="input" value={s.donate_why_title || ''} onChange={set('donate_why_title')} />
            </Field>
            <Field label="Points « Pourquoi donner »">
              <FlatListEditor items={s.donate_why_points || []} onChange={(v) => setS({ ...s, donate_why_points: v })} placeholder="Point de vente" />
            </Field>
          </SettingsSection>
          <SettingsSection title="Pages des campagnes">
            <Field label="Points de réassurance (« À quoi sert cette collecte ? »)">
              <FlatListEditor items={s.campaign_points || []} onChange={(v) => setS({ ...s, campaign_points: v })} placeholder="Point de réassurance" />
            </Field>
          </SettingsSection>
        </div>
      )}

      {tab === 'compteurs' && (
        <div className="space-y-5">
          <SettingsSection title="Statistiques" desc="Le 1ᵉ compteur est aussi affiché dans la carte flottante du hero.">
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
          </SettingsSection>
          <SettingsSection title="Valeurs (page À propos)">
            <ItemListEditor items={s.values || []} onChange={(v) => setS({ ...s, values: v })} />
          </SettingsSection>
          <SettingsSection title="Méthode de travail (page À propos)">
            <ItemListEditor items={s.method || []} onChange={(v) => setS({ ...s, method: v })} />
          </SettingsSection>
        </div>
      )}

      {tab === 'modules' && isSuper && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-accent-200 bg-accent-50 p-5">
            <p className="text-sm font-semibold text-accent-900">
              Zone réservée au super administrateur. GRH et POS concernent l’espace admin ;
              le mode maintenance masque tout le site public (l’admin reste accessible).
            </p>
          </div>

          <div className={`card space-y-5 p-7 ${modules?.maintenance_enabled ? 'ring-2 ring-amber-400' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-display text-lg font-bold text-ink-900">Mode maintenance</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${modules?.maintenance_enabled ? 'bg-amber-100 text-amber-800' : 'bg-ink-100 text-ink-500'}`}>
                    {modules?.maintenance_enabled ? 'Activé' : 'Désactivé'}
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
                  Affiche une page de maintenance sur le site public et bloque les API publiques.
                  L’espace <strong>/admin</strong> et la connexion restent disponibles pour désactiver le mode.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!modules?.maintenance_enabled}
                disabled={!modules}
                onClick={() => toggleMaintenance(!modules?.maintenance_enabled)}
                className={`relative h-9 w-16 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                  modules?.maintenance_enabled ? 'bg-amber-500' : 'bg-ink-200'
                }`}
              >
                <span
                  className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all ${
                    modules?.maintenance_enabled ? 'left-8' : 'left-1'
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink-700">Message affiché aux visiteurs</label>
              <textarea
                className="input min-h-[88px]"
                rows={3}
                maxLength={500}
                disabled={!modules}
                value={modules?.maintenance_message ?? ''}
                onChange={(e) => setModules({ ...modules, maintenance_message: e.target.value })}
                placeholder="Le site est temporairement en maintenance…"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="btn-primary !px-5 !py-2.5 text-sm"
                  disabled={!modules}
                  onClick={saveMaintenanceMessage}
                >
                  Enregistrer le message
                </button>
              </div>
            </div>
          </div>

          <div className="card flex flex-wrap items-center justify-between gap-6 p-7">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display text-lg font-bold text-ink-900">Gestion RH (GRH)</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${modules?.grh_enabled ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>
                  {modules?.grh_enabled ? 'Activé' : 'Désactivé'}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
                Module complet de gestion des ressources humaines : équipe (fiches employés, salaires visibles
                uniquement par le super admin), départements et congés avec circuit de validation.
                Visible dans le menu par les rôles <strong>super admin</strong> et <strong>administrateur</strong>.
                La désactivation masque le menu et ferme l'API GRH (les données restent conservées).
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!modules?.grh_enabled}
              disabled={!modules}
              onClick={() => toggleGrh(!modules?.grh_enabled)}
              className={`relative h-9 w-16 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                modules?.grh_enabled ? 'bg-brand-600' : 'bg-ink-200'
              }`}
            >
              <span
                className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all ${
                  modules?.grh_enabled ? 'left-8' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="card flex flex-wrap items-center justify-between gap-6 p-7">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display text-lg font-bold text-ink-900">Point de vente (POS) + stock</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${modules?.pos_enabled ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>
                  {modules?.pos_enabled ? 'Activé' : 'Désactivé'}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
                Caisse (panier, paiement, ticket imprimable et PDF), ventes avec retours, catalogue produits,
                mouvements de stock et statistiques. Visible dans le menu par les rôles <strong>super admin</strong>
                et <strong>administrateur</strong>. La désactivation masque le menu et ferme l'API POS (les données restent conservées).
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!modules?.pos_enabled}
              disabled={!modules}
              onClick={() => togglePos(!modules?.pos_enabled)}
              className={`relative h-9 w-16 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                modules?.pos_enabled ? 'bg-brand-600' : 'bg-ink-200'
              }`}
            >
              <span
                className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all ${
                  modules?.pos_enabled ? 'left-8' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="card flex flex-wrap items-center justify-between gap-6 p-7">
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-lg font-bold text-ink-900">Congés — jours par an (valeur par défaut)</h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
                Solde de congé annuel attribué à chaque employé. Il peut être ajusté individuellement dans la
                fiche de chaque employé (champ « Jours de congé / an »). Les week-ends ne comptent pas dans la
                durée des congés.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                className="input !w-24 text-center"
                type="number"
                min="0"
                max="60"
                value={s.grh_annual_leave_days ?? ''}
                placeholder="22"
                onChange={set('grh_annual_leave_days')}
              />
              <button type="button" className="btn-primary shrink-0 !px-5 !py-2.5 text-sm" onClick={save} disabled={saving}>
                Enregistrer
              </button>
            </div>
          </div>

          {modMsg && (
            <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${modMsg.startsWith('✓') ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>
              {modMsg}
            </p>
          )}
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
    </div>
  );
}
