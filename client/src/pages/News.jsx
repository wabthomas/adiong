import React, { useEffect, useMemo, useState } from 'react';
import Reveal, { Stagger } from '../components/Reveal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import CTABanner from '../components/CTABanner.jsx';
import { ArticleCard, categoryLabel } from '../components/Cards.jsx';
import { useSite } from '../hooks/useSite.jsx';
import { usePageSeo } from '../hooks/useSeo.js';

const PER_PAGE = 6;

export default function News() {
  const { site, articles } = useSite();
  const catFilters = [
    ['tous', 'Toutes'],
    ...(site.article_categories || []).map((c) => [c.slug, c.name])
  ];
  const [cat, setCat] = useState('tous');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  usePageSeo({
    title: site.news_header?.title,
    description: site.news_header?.text,
    image: site.news_header?.image
  });

  useEffect(() => {
    setPage(1);
  }, [cat, query]);

  const filtered = useMemo(() => {
    let list = cat === 'tous' ? articles : articles.filter((a) => a.category === cat);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.title?.toLowerCase().includes(q) ||
          a.excerpt?.toLowerCase().includes(q) ||
          a.content?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [articles, cat, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <>
      <PageHeader
        kicker={site.news_header?.kicker || 'Actualités'}
        title={site.news_header?.title || 'Dernières informations'}
        text={site.news_header?.text}
        image={site.news_header?.image || '/uploads/seed/cause-education.jpg'}
      />
      <section className="container-x py-20">
        <Reveal className="mx-auto flex max-w-xl items-center gap-2 rounded-2xl bg-white p-2 shadow-soft ring-1 ring-ink-100">
          <span className="pl-3 text-lg text-ink-300">⌕</span>
          <input
            className="w-full bg-transparent py-2 pr-3 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none"
            placeholder="Rechercher un article… (ex. éducation, Goma, handicap)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Rechercher un article"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-ink-400 hover:bg-ink-50"
              aria-label="Effacer la recherche"
            >
              Effacer
            </button>
          )}
        </Reveal>

        <Reveal className="mt-8 flex flex-wrap justify-center gap-3">
          {catFilters.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setCat(value)}
              className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
                cat === value
                  ? 'bg-brand-600 text-white shadow-soft'
                  : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:ring-brand-300'
              }`}
            >
              {label}
            </button>
          ))}
        </Reveal>

        <p className="mt-8 text-center text-sm font-semibold text-ink-400">
          {filtered.length} article{filtered.length > 1 ? 's' : ''}
          {query && <> pour « {query} »</>}
          {cat !== 'tous' && <> · {categoryLabel(cat, site.article_categories)}</>}
        </p>

        <Stagger key={`${cat}-${query}-${safePage}`} className="mt-10 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
          {paged.map((a, i) => (
            <ArticleCard key={a.id} article={a} index={i} />
          ))}
        </Stagger>

        {filtered.length === 0 && (
          <Reveal className="mt-12 text-center text-ink-400">
            Aucun article ne correspond à votre recherche.
          </Reveal>
        )}

        {totalPages > 1 && (
          <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Pagination">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-ink-600 ring-1 ring-ink-200 transition-all hover:ring-brand-300 disabled:opacity-40"
            >
              ← Précédent
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`h-10 w-10 rounded-xl text-sm font-bold transition-all ${
                  n === safePage ? 'bg-brand-600 text-white shadow-soft' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:ring-brand-300'
                }`}
                aria-current={n === safePage ? 'page' : undefined}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-ink-600 ring-1 ring-ink-200 transition-all hover:ring-brand-300 disabled:opacity-40"
            >
              Suivant →
            </button>
          </nav>
        )}
      </section>
      <CTABanner />
    </>
  );
}
