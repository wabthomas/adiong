import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const Ctx = createContext(null);

export function SiteProvider({ children }) {
  const [data, setData] = useState({ site: {}, causes: [], articles: [], campaigns: [] });
  const [loading, setLoading] = useState(true);

  const load = () =>
    Promise.all([api.site(), api.causes(), api.articles(''), api.campaigns()])
      .then(([site, causes, articles, campaigns]) => {
        setData({ site, causes, articles, campaigns });
        document.title = `${site.site_name || 'ADI ONG'} — ${site.site_tagline || 'Inclusion'}`;
      })
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  // Favicon dynamique (éditable dans l'admin)
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
      {children}
    </Ctx.Provider>
  );
}

export const useSite = () => useContext(Ctx);
