import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setMoneyCurrency } from '../api.js';

const Ctx = createContext(null);

const EMPTY = {
  site: {},
  causes: [],
  articles: [],
  campaigns: [],
  partners: [],
  maintenance: false,
  maintenanceMessage: ''
};

export function SiteProvider({ children }) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [site, modules] = await Promise.all([api.site(), api.modules.public()]);
      setMoneyCurrency(site?.currency);
      if (site?.site_name) {
        document.title = modules?.maintenance_enabled
          ? `${site.site_name} — Maintenance`
          : `${site.site_name} — ${site.site_tagline || 'Inclusion'}`;
      }

      if (modules?.maintenance_enabled) {
        setData({
          site: site || {},
          causes: [],
          articles: [],
          campaigns: [],
          partners: [],
          maintenance: true,
          maintenanceMessage: modules.maintenance_message || ''
        });
        return;
      }

      const [causes, articles, campaigns, partners] = await Promise.all([
        api.causes(),
        api.articles(''),
        api.campaigns(),
        api.partners()
      ]);
      setData({
        site: site || {},
        causes: Array.isArray(causes) ? causes : [],
        articles: Array.isArray(articles) ? articles : [],
        campaigns: Array.isArray(campaigns) ? campaigns : [],
        partners: Array.isArray(partners) ? partners : [],
        maintenance: false,
        maintenanceMessage: ''
      });
    } catch {
      /* keep last known data */
    } finally {
      setLoading(false);
    }
  };

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

export const useSite = () => {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return { ...EMPTY, reload: () => {}, loading: false };
  }
  return ctx;
};
