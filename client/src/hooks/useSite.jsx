import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setMoneyCurrency } from '../api.js';

const Ctx = createContext(null);

export function SiteProvider({ children }) {
  const [data, setData] = useState({ site: {}, causes: [], articles: [], campaigns: [], partners: [] });
  const [loading, setLoading] = useState(true);

  const load = () =>
    Promise.all([api.site(), api.causes(), api.articles(''), api.campaigns(), api.partners()])
      .then(([site, causes, articles, campaigns, partners]) => {
        setData({ site, causes, articles, campaigns, partners });
        setMoneyCurrency(site.currency);
        document.title = `${site.site_name || 'ADI ONG'} — ${site.site_tagline || 'Inclusion'}`;
      })
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!data.site.favicon) return;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = data.site.favicon;
    const apple = document.querySelector("link[rel='apple-touch-icon']");
    if (apple) apple.href = data.site.favicon;
  }, [data.site.favicon]);

  return (
    <Ctx.Provider value={{ ...data, reload: load, loading }}>
      {loading ? (
        <div className="grid min-h-screen place-items-center bg-cream">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
            <p className="text-sm font-semibold text-ink-400">Chargement…</p>
          </div>
        </div>
      ) : (
        children
      )}
    </Ctx.Provider>
  );
}

export const useSite = () => useContext(Ctx);
