import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Reveal from '../components/Reveal.jsx';
import CTABanner from '../components/CTABanner.jsx';
import { api, fmtDate } from '../api.js';
import { useSite } from '../hooks/useSite.jsx';
import { usePageSeo } from '../hooks/useSeo.js';
import { categoryLabel } from '../components/Cards.jsx';
import { IconArrow, IconCalendar, IconClock, IconHeart } from '../components/Icons.jsx';
import NotFound from './NotFound.jsx';

const SHARE_ICONS = {
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z" /></svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" /></svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.119 20.452H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0Z" /></svg>
  )
};

function ShareBar({ article }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const text = `${article.title} — ADI ONG`;

  const links = [
    { label: 'Facebook', Icon: SHARE_ICONS.facebook, color: 'hover:bg-[#1877f2] hover:text-white', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { label: 'X (Twitter)', Icon: SHARE_ICONS.x, color: 'hover:bg-ink-900 hover:text-white', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
    { label: 'WhatsApp', Icon: SHARE_ICONS.whatsapp, color: 'hover:bg-[#25d366] hover:text-white', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
    { label: 'LinkedIn', Icon: SHARE_ICONS.linkedin, color: 'hover:bg-[#0a66c2] hover:text-white', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` }
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {  }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-bold tracking-wide text-ink-400 uppercase">Partager</span>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          aria-label={`Partager sur ${l.label}`}
          title={l.label}
          className={`grid h-10 w-10 place-items-center rounded-xl bg-white text-ink-500 shadow-soft ring-1 ring-ink-950/5 transition-all hover:-translate-y-0.5 ${l.color}`}
        >
          <l.Icon />
        </a>
      ))}
      <button
        onClick={copy}
        title="Copier le lien"
        className={`grid h-10 w-10 place-items-center rounded-xl shadow-soft ring-1 transition-all hover:-translate-y-0.5 ${
          copied ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-500 ring-ink-950/5 hover:bg-brand-50 hover:text-brand-700'
        }`}
      >
        {copied ? '✓' : '🔗'}
      </button>
      <a
        href={`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`}
        title="Partager par email"
        className="grid h-10 w-10 place-items-center rounded-xl bg-white text-ink-500 shadow-soft ring-1 ring-ink-950/5 transition-all hover:-translate-y-0.5 hover:bg-ink-900 hover:text-white"
      >
        ✉️
      </a>
    </div>
  );
}

function RecentTimeline({ articles, currentSlug }) {
  return (
    <ol className="relative space-y-7 border-l-2 border-brand-100 pl-6">
      {articles.map((a, i) => (
        <motion.li
          key={a.id}
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="relative"
        >
          <span className={`absolute top-1.5 -left-[31px] h-3 w-3 rounded-full ring-4 ${
            a.slug === currentSlug ? 'bg-accent-400 ring-accent-100' : 'bg-brand-500 ring-brand-50'
          }`} />
          <Link to={`/actualites/${a.slug}`} className="group block">
            <p className="text-[11px] font-bold tracking-wide text-ink-400 uppercase">{fmtDate(a.date)}</p>
            <p className={`mt-1 text-sm leading-snug font-semibold line-clamp-2 group-hover:text-brand-700 ${
              a.slug === currentSlug ? 'text-accent-600' : 'text-ink-800'
            }`}>
              {a.title}
            </p>
          </Link>
        </motion.li>
      ))}
    </ol>
  );
}

export default function ArticlePage() {
  const { slug } = useParams();
  const { site, articles } = useSite();
  const [article, setArticle] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.article(slug).then(setArticle).catch(() => setNotFound(true));
    window.scrollTo(0, 0);
  }, [slug]);

  const seoTitle = article ? (article.seo_title || (article.title ? `${article.title} — ${site.site_name || 'ADI ONG'}` : '')) : '';
  const seoDesc = article ? (article.seo_description || article.excerpt) : '';
  const seoImage = article ? (article.seo_image || article.image) : '';
  usePageSeo({
    title: seoTitle,
    description: seoDesc,
    image: seoImage,
    path: article ? `/actualites/${article.slug}` : '/actualites',
    noindex: !!article?.seo_noindex,
    type: 'article'
  });

  if (notFound) return <NotFound />;
  if (!article) return null;

  const related = articles.filter((a) => a.slug !== article.slug && a.category === article.category).slice(0, 2);
  const fallbackRelated = related.length ? related : articles.filter((a) => a.slug !== article.slug).slice(0, 2);
  const recent = articles.slice(0, 5);

  return (
    <>
      {}
      <section className="relative overflow-hidden bg-ink-950 pt-36 pb-16">
        <div className="absolute inset-0">
          <img src={article.image} alt="" className="h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-950/70 via-ink-950/80 to-ink-950" />
        </div>
        <div className="container-x relative">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="mx-auto max-w-4xl text-center"
          >
            <nav className="mb-6 flex items-center justify-center gap-2 text-xs font-bold text-white/50" aria-label="Fil d'Ariane">
              <Link to="/" className="hover:text-accent-300">Accueil</Link>
              <span>/</span>
              <Link to="/actualites" className="hover:text-accent-300">Actualités</Link>
              <span>/</span>
              <span className="text-white/80">{categoryLabel(article.category)}</span>
            </nav>
            <span className="inline-flex rounded-full bg-accent-400 px-4 py-1.5 text-xs font-bold text-ink-950 uppercase tracking-wide">
              {categoryLabel(article.category)}
            </span>
            <h1 className="mt-6 font-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[2.8rem]">
              {article.title}
            </h1>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-white/60">
              <span className="inline-flex items-center gap-2"><IconClock className="h-4 w-4" /> {article.author}</span>
              <span className="inline-flex items-center gap-2"><IconCalendar className="h-4 w-4" /> {fmtDate(article.date)}</span>
            </div>
            <div className="mt-8 flex justify-center">
              <div className="-mx-2"><ShareBar article={article} /></div>
            </div>
          </motion.div>
        </div>
      </section>

      {}
      <section className="container-x py-16">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.6fr_1fr]">
          <Reveal>
            <article>
              <div className="prose-adi" dangerouslySetInnerHTML={{ __html: article.content }} />
              <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-brand-50 p-7 ring-1 ring-brand-100">
                <div>
                  <p className="font-display font-bold text-ink-900">Chaque soutien compte.</p>
                  <p className="mt-1.5 text-[15px] text-ink-600">Soutenez ce type de programme en faisant un don à l'ONG ADI.</p>
                </div>
                <Link to="/faire-un-don" className="btn-primary">
                  <IconHeart className="h-5 w-5" /> Faire un don
                </Link>
              </div>
              <div className="mt-8">
                <ShareBar article={article} />
              </div>
            </article>
          </Reveal>

          {}
          <Reveal x={36} y={0} className="space-y-7 lg:sticky lg:top-24 lg:self-start">
            <div className="card p-6">
              <h3 className="flex items-center gap-2 font-display font-bold text-ink-900">
                <IconCalendar className="h-5 w-5 text-brand-600" /> Timeline — articles récents
              </h3>
              <div className="mt-6">
                <RecentTimeline articles={recent} currentSlug={article.slug} />
              </div>
              <Link to="/actualites" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:text-brand-700">
                Toutes les actualités <IconArrow className="h-4 w-4" />
              </Link>
            </div>

            {fallbackRelated.length > 0 && (
              <div className="card p-6">
                <h3 className="font-display font-bold text-ink-900">Lire aussi</h3>
                <ul className="mt-4 space-y-4">
                  {fallbackRelated.map((a) => (
                    <li key={a.id}>
                      <Link to={`/actualites/${a.slug}`} className="group flex gap-3">
                        <img src={a.image} alt="" className="h-16 w-20 shrink-0 rounded-xl object-cover ring-1 ring-ink-950/5" loading="lazy" />
                        <div>
                          <span className="text-[10px] font-bold tracking-wide text-brand-600 uppercase">{categoryLabel(a.category)}</span>
                          <p className="text-sm leading-snug font-semibold text-ink-800 line-clamp-2 group-hover:text-brand-700">
                            {a.title}
                          </p>
                          <p className="mt-1 text-xs text-ink-400">{fmtDate(a.date)}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      <CTABanner />
    </>
  );
}
