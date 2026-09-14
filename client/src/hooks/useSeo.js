import { useEffect, useState } from 'react';
import { useSite as useSiteCtx } from './useSite.jsx';


export default function useSeo({ title, description, image, path = '', noindex = false, type = 'website' }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const url = `${window.location.origin}${path}`;
    const fullTitle = title;
    const desc = description || '';
    const img = image || '';

    const setMeta = (attr, key, content) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    const setCanonical = (href) => {
      let el = document.head.querySelector('link[rel="canonical"]');
      if (!el) {
        el = document.createElement('link');
        el.rel = 'canonical';
        document.head.appendChild(el);
      }
      el.href = href;
    };

    if (fullTitle) document.title = fullTitle;
    setMeta('name', 'description', desc);
    setCanonical(url);

    let rss = document.head.querySelector('link[rel="alternate"][type="application/rss+xml"]');
    if (!rss) {
      rss = document.createElement('link');
      rss.rel = 'alternate';
      rss.type = 'application/rss+xml';
      rss.title = 'ADI ONG — Actualités (RSS)';
      document.head.appendChild(rss);
    }
    rss.href = `${window.location.origin}/rss.xml`;

    setMeta('property', 'og:site_name', 'ADI ONG');
    setMeta('property', 'og:locale', 'fr_FR');
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:title', fullTitle);
    if (desc) setMeta('property', 'og:description', desc);
    if (img) setMeta('property', 'og:image', new URL(img, window.location.origin).href);
    setMeta('property', 'og:url', url);

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    if (desc) setMeta('name', 'twitter:description', desc);
    if (img) setMeta('name', 'twitter:image', new URL(img, window.location.origin).href);

    let el = document.head.querySelector('meta[name="robots"]');
    if (!el) {
      el = document.createElement('meta');
      el.name = 'robots';
      document.head.appendChild(el);
    }
    el.content = noindex ? 'noindex, nofollow' : 'index, follow';
  }, [ready, title, description, image, path, noindex, type]);
}


export function usePageSeo({ title, description, image, path, noindex, type }) {
  const { site } = useSiteCtx();
  const finalTitle = title
    ? (title.toLowerCase().includes('adi') ? title : `${title} — ${site.site_name || 'ADI ONG'}`)
    : (site.seo_title || 'ADI ONG');
  const finalDesc = description || site.seo_description || '';
  const finalImage = image || site.og_image || '';
  useSeo({ title: finalTitle, description: finalDesc, image: finalImage, path, noindex, type });
}
