import React from 'react';
import Reveal, { Stagger, Counter } from '../components/Reveal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import CTABanner from '../components/CTABanner.jsx';
import { CampaignCard } from '../components/Cards.jsx';
import { useSite } from '../hooks/useSite.jsx';
import { fmtMoney } from '../api.js';
import { usePageSeo } from '../hooks/useSeo.js';

export default function Campaigns() {
  const { site, campaigns } = useSite();
  usePageSeo({
    title: site.campaigns_header?.title,
    description: site.campaigns_header?.text,
    image: site.campaigns_header?.image
  });
  const totalGoal = campaigns.reduce((s, c) => s + (c.goal_amount || 0), 0);
  const totalCollected = campaigns.reduce((s, c) => s + (c.collected_amount || 0), 0);
  const globalPct = Math.min(100, Math.round((totalCollected / (totalGoal || 1)) * 100));

  return (
    <>
      <PageHeader
        kicker={site.campaigns_header?.kicker || 'Collectes de fonds'}
        title={site.campaigns_header?.title || 'Nos campagnes de collecte'}
        text={site.campaigns_header?.text}
        image={site.campaigns_header?.image || '/uploads/seed/campaign-kits.jpg'}
      />

      {}
      <section className="container-x -mt-10 relative z-10">
        <Reveal>
          <div className="card grid gap-8 p-8 sm:grid-cols-3">
            <div>
              <p className="text-sm font-bold tracking-wide text-ink-400 uppercase">Objectif global</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-ink-900">{fmtMoney(totalGoal)}</p>
            </div>
            <div>
              <p className="text-sm font-bold tracking-wide text-ink-400 uppercase">Déjà collecté</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-brand-600">
                <Counter value={Math.round(totalCollected)} /> USD
              </p>
            </div>
            <div className="sm:pl-6 sm:border-l border-ink-100">
              <p className="text-sm font-bold tracking-wide text-ink-400 uppercase">Progression globale</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-accent-600">
                <Counter value={globalPct} suffix="%" />
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="container-x py-20">
        <Stagger className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c, i) => (
            <CampaignCard key={c.id} campaign={c} index={i} />
          ))}
        </Stagger>
        {campaigns.length === 0 && (
          <Reveal className="text-center text-ink-400">Aucune collecte en cours pour le moment.</Reveal>
        )}
      </section>

      <CTABanner />
    </>
  );
}
