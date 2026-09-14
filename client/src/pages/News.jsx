import React, { useMemo, useState } from 'react';
import Reveal, { Stagger } from '../components/Reveal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import CTABanner from '../components/CTABanner.jsx';
import { ArticleCard, categoryLabel } from '../components/Cards.jsx';
import { useSite } from '../hooks/useSite.jsx';
import { usePageSeo } from '../hooks/useSeo.js';

const CATS = [
  ['tous', 'Toutes'],
  ['plaidoyer', 'Plaidoyer'],
  ['education', 'Éducation'],
  ['ecologie', 'Écologie']
];

export default function News() {
  const { site, articles } = useSite();
  const [cat, setCat] = useState('tous');
  usePageSeo({
    title: site.news_header?.title,
    description: site.news_header?.text,
    image: site.news_header?.image
  });

  const filtered = useMemo(
    () => (cat === 'tous' ? articles : articles.filter((a) => a.category === cat)),
    [articles, cat]
  );

  return (
    <>
      <PageHeader
        kicker={site.news_header?.kicker || 'Actualités'}
        title={site.news_header?.title || 'Dernières informations'}
        text={site.news_header?.text}
        image={site.news_header?.image || '/uploads/seed/cause-education.jpg'}
      />
      <section className="container-x py-20">
        <Reveal className="flex flex-wrap justify-center gap-3">
          {CATS.map(([value, label]) => (
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
        <Stagger key={cat} className="mt-12 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a, i) => (
            <ArticleCard key={a.id} article={a} index={i} />
          ))}
        </Stagger>
        {filtered.length === 0 && (
          <Reveal className="mt-12 text-center text-ink-400">Aucun article dans cette catégorie pour le moment.</Reveal>
        )}
      </section>
      <CTABanner />
    </>
  );
}
