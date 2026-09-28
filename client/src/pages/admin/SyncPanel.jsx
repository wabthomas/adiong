// Panneau Synchronisation (Réglages) : état, file d'attente, copie locale
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useSyncStatus } from '../../sync/SyncBadge.jsx';
import { outboxList, retryOutbox, discardOutbox, syncNow } from '../../sync/engine.js';
import { Field } from './AdminUI.jsx';

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

const LABELS = {
  'POST /api/donate': 'Don',
  'POST /api/admin/articles': 'Article',
  'POST /api/admin/causes': 'Cause',
  'POST /api/admin/campaigns': 'Campagne',
  'POST /api/admin/partners': 'Partenaire',
  'POST /api/admin/pos/sales': 'Vente POS',
  'POST /api/admin/pos/products': 'Produit',
  'POST /api/admin/compta/entries': 'Écriture comptable',
  'POST /api/admin/grh/employees': 'Employé',
  'POST /api/admin/grh/leaves': 'Congé',
  'POST /api/admin/upload': 'Fichier',
  'POST /api/admin/media': 'Média',
  'POST /api/contact': 'Message de contact'
};

function itemLabel(item) {
  if (LABELS[item.method + ' ' + item.path]) return LABELS[item.method + ' ' + item.path];
  const base = item.path.split('?')[0];
  const m = base.match(/\/api\/admin\/(articles|causes|campaigns|partners|donations|pos\/sales|pos\/products|compta\/entries|grh\/employees|grh\/leaves)\/(\d+)$/);
  if (m) return `${LABELS['POST /api/admin/' + m[1]] || m[1]} n°${m[2]}`;
  return `${item.method} ${base}`;
}

function fmtTime(ts) {
  return ts ? new Date(ts * 1000).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
}

export function SyncStatusCard() {
  const st = useSyncStatus();
  const [items, setItems] = useState([]);
  const [working, setWorking] = useState(false);
  const reload = useCallback(() => { void outboxList().then(setItems); }, []);
  useEffect(() => { reload(); const t = setInterval(reload, 5000); return () => clearInterval(t); }, [reload]);

  const run = async () => {
    setWorking(true);
    try { await syncNow(); } finally { setWorking(false); reload(); }
  };

  return (
    <SettingsSection
      title="Travail hors ligne"
      desc="Les modifications faites sans connexion sont conservées sur cet appareil et transmises dès que le réseau revient."
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${st.online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
          <span className={`h-2 w-2 rounded-full ${st.online ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {st.online ? 'En ligne' : 'Hors ligne'}
        </span>
        <span className="text-sm text-ink-500">
          {st.pending} en attente{st.failed ? ` · ${st.failed} en échec` : ''}
          {st.lastSyncAt ? ` · dernière synchro ${fmtTime(st.lastSyncAt)}` : ''}
        </span>
        <button type="button" onClick={run} disabled={working || !st.online}
          className="btn-primary ml-auto text-sm disabled:cursor-not-allowed disabled:opacity-50">
          {working ? 'Synchronisation…' : 'Synchroniser maintenant'}
        </button>
      </div>

      {items.length > 0 && (
        <div className="overflow-hidden rounded-xl ring-1 ring-ink-100">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Élément</th>
                <th className="px-4 py-2.5 font-semibold">Créé</th>
                <th className="px-4 py-2.5 font-semibold">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 30).map((it) => (
                <tr key={it.id} className="border-t border-ink-100">
                  <td className="px-4 py-2.5 font-medium text-ink-800">{itemLabel(it)}</td>
                  <td className="px-4 py-2.5 text-ink-500">{fmtTime(it.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    {it.status === 'pending'
                      ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">En attente</span>
                      : <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700" title={it.lastError}>{it.lastError || 'Échec'}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      {it.status === 'failed' && (
                        <button type="button" onClick={() => { void retryOutbox(it.id).then(reload); }}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                          Réessayer
                        </button>
                      )}
                      <button type="button" onClick={() => { void discardOutbox(it.id).then(reload); }}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-ink-400 hover:bg-ink-50">
                        Abandonner
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SettingsSection>
  );
}

export function LocalCopyCard() {
  const [cfg, setCfg] = useState(null);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [interval, setIntervalMs] = useState(300000);
  const [msg, setMsg] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    api.adminSync.get().then((d) => {
      setCfg(d);
      setUrl(d.url || '');
      setIntervalMs(d.intervalMs || 300000);
    }).catch(() => setCfg(null));
  }, []);

  const save = async () => {
    setWorking(true);
    setMsg('');
    try {
      const d = await api.adminSync.update({ url: url.trim(), token: token || undefined, intervalMs: Number(interval) });
      setCfg(d);
      setToken('');
      setMsg('Configuration enregistrée.');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setWorking(false);
    }
  };

  const run = async () => {
    setWorking(true);
    setMsg('');
    try {
      await api.adminSync.run();
      setMsg('Synchronisation lancée — suivez le badge de l’en-tête.');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setWorking(false);
    }
  };

  if (!cfg) return null;

  return (
    <SettingsSection
      title="Synchronisation avec le site principal"
      desc="Cette copie locale reste à jour avec adiong.org et y transmet ses modifications. Le site principal doit être joignable et le compte utilisé doit y disposer des droits."
    >
      <Field label="Adresse du site principal" hint="Par exemple https://adiong.org">
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          className="input" placeholder="https://adiong.org" />
      </Field>
      <Field label="Jeton de session" hint="Générez-le sur le site principal : se connecter, puis Console (F12) → Application → Local Storage → adiong_admin_token">
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
          className="input" placeholder={cfg.configured ? 'Jeton configuré — laisser vide pour conserver' : 'Coller le jeton ici'} />
      </Field>
      <Field label="Fréquence automatique" hint="Intervalle entre deux synchronisations pendant que le serveur local tourne.">
        <select value={interval} onChange={(e) => setIntervalMs(Number(e.target.value))} className="input">
          <option value={60000}>Toutes les minutes</option>
          <option value={300000}>Toutes les 5 minutes</option>
          <option value={900000}>Toutes les 15 minutes</option>
          <option value={1800000}>Toutes les 30 minutes</option>
        </select>
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={working} className="btn-primary text-sm disabled:opacity-50">Enregistrer</button>
        <button type="button" onClick={run} disabled={working || !cfg.configured} className="btn-ghost text-sm disabled:opacity-50">Synchroniser maintenant</button>
        {cfg.lastError && <span className="text-sm font-semibold text-rose-600">Dernier échec : {cfg.lastError}</span>}
        {msg && <span className="text-sm font-semibold text-ink-600">{msg}</span>}
      </div>
    </SettingsSection>
  );
}
