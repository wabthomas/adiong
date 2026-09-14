import React from 'react';
import Reveal, { Stagger, staggerItem } from '../components/Reveal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import CTABanner from '../components/CTABanner.jsx';
import { useSite } from '../hooks/useSite.jsx';
import { causeIcons, IconArrow } from '../components/Icons.jsx';
import { Link } from 'react-router-dom';
import { usePageSeo } from '../hooks/useSeo.js';

export default function Work() {
  const { site, causes } = useSite();
  usePageSeo({
    title: site.work_header?.title,
    description: site.work_header?.text,
    image: site.work_header?.image || site.hero_image
  });
  return (
    <>
      <PageHeader
        kicker={site.work_header?.kicker || 'Notre travail'}
        title={site.work_header?.title || "Quatre domaines, un seul objectif : l'inclusion"}
        text={site.work_header?.text}
        image={site.work_header?.image || site.hero_image || '/uploads/seed/hero.jpg'}
      />
      <section className="container-x py-24">
        <Stagger className="space-y-16">
          {causes.map((c, i) => {
            const Icon = causeIcons[c.icon] || causeIcons.megaphone;
            const flip = i % 2 === 1;
            return (
              <Reveal key={c.id} {...staggerItem}>
                <div className={`grid items-center gap-10 lg:grid-cols-2 ${flip ? '' : ''}`}>
                  <div className={flip ? 'lg:order-2' : ''}>
                    <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-accent-400 text-ink-950 shadow-soft">
                      <Icon className="h-7 w-7" />
                    </span>
                    <h2 className="mt-6 font-display text-2xl font-bold text-ink-900 sm:text-3xl">{c.title}</h2>
                    <p className="mt-4 text-lg leading-relaxed text-ink-600">{c.description}</p>
                    <Link to={c.link || `/notre-travail/${c.slug}`} className="btn-primary mt-7">
                      Découvrir cette cause <IconArrow className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className={flip ? 'lg:order-1' : ''}>
                    <img
                      src={c.image}
                      alt={c.title}
                      className="h-[320px] w-full rounded-[2rem] object-cover shadow-lift lg:h-[400px]"
                      loading="lazy"
                    />
                  </div>
                </div>
              </Reveal>
            );
          })}
        </Stagger>
      </section>
      <CTABanner />
    </>
  );
}
