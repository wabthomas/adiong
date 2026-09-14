import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Reveal from '../components/Reveal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import CTABanner from '../components/CTABanner.jsx';
import { api, fmtMoney, fmtDate } from '../api.js';
import { useSite } from '../hooks/useSite.jsx';
import { usePageSeo } from '../hooks/useSeo.js';
import { CampaignCard } from '../components/Cards.jsx';
import { IconCalendar, IconHeart, IconCheck, IconArrow } from '../components/Icons.jsx';
import NotFound from './NotFound.jsx';

export default function CampaignDetail() {
  const { slug } = useParams();
  const { site, campaigns } = useSite();
  const [campaign, setCampaign] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.campaign(slug).then(setCampaign).catch(() => setNotFound(true));
    window.scrollTo(0, 0);
  }, [slug]);

  usePageSeo({
    title: campaign?.title,
    description: campaign?.description,
    image: campaign?.image,
    path: campaign ? `/collectes/${campaign.slug}` : '/collectes'
  });

  if (notFound) return <NotFound />;
  if (!campaign) return null;

  const pct = Math.min(100, Math.round((campaign.collected_amount / (campaign.goal_amount || 1)) * 100));
  const others = campaigns.filter((c) => c.slug !== campaign.slug).slice(0, 2);
  const backers = Math.max(1, Math.round(campaign.collected_amount / 50));

  return (
    <>
      <PageHeader
        kicker="Campagne de collecte"
        title={campaign.title}
        text={campaign.description}
        image={campaign.image}
      />

      <section className="container-x py-20">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.5fr_1fr]">
          <Reveal>
            <img
              src={campaign.image}
              alt={campaign.title}
              className="h-80 w-full rounded-[2rem] object-cover shadow-lift"
            />
            <h2 className="mt-10 font-display text-2xl font-bold text-ink-900">À quoi sert cette collecte ?</h2>
            <p className="mt-4 text-[17px] leading-[1.85] text-ink-600">{campaign.description}</p>
            <ul className="mt-8 space-y-4">
              {(Array.isArray(site.campaign_points) && site.campaign_points.length ? site.campaign_points : [
                'Utilisation directe et transparente des fonds',
                'Rapport de suivi partagé avec les donateurs',
                'Impact mesurable dans nos zones d’intervention à Goma'
              ]).map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                    <IconCheck className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[15px] font-medium text-ink-700">{t}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal x={40} y={0} className="space-y-6">
            <div className="card sticky top-28 p-8">
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-display text-3xl font-extrabold text-ink-900">{fmtMoney(campaign.collected_amount)}</p>
                  <p className="mt-1 text-sm font-semibold text-ink-400">collectés par {backers} donateurs</p>
                </div>
                <p className="font-display text-xl font-extrabold text-brand-600">{pct}%</p>
              </div>
              <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-400 transition-all duration-1000"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-4 flex justify-between text-sm font-semibold text-ink-500">
                <span>Objectif : {fmtMoney(campaign.goal_amount)}</span>
                {campaign.deadline && (
                  <span className="inline-flex items-center gap-1.5">
                    <IconCalendar className="h-4 w-4" /> {fmtDate(campaign.deadline)}
                  </span>
                )}
              </div>
              <Link to={`/faire-un-don?campaignId=${campaign.id}`} className="btn-primary mt-7 w-full">
                <IconHeart className="h-5 w-5" /> Donner à cette campagne
              </Link>
              <p className="mt-4 text-center text-xs leading-relaxed text-ink-400">
                Vos dons sont sécurisés et redevables. Vous recevrez un reçu pour votre don.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {others.length > 0 && (
        <section className="bg-white py-20">
          <div className="container-x">
            <Reveal className="mb-10 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-ink-900">Autres collectes en cours</h2>
              <Link to="/collectes" className="inline-flex items-center gap-2 text-sm font-bold text-brand-600">
                Tout voir <IconArrow className="h-4 w-4" />
              </Link>
            </Reveal>
            <div className="grid gap-7 md:grid-cols-2">
              {others.map((c, i) => (
                <Reveal key={c.id} delay={i * 0.1}>
                  <CampaignCard campaign={c} index={i} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <CTABanner />
    </>
  );
}
