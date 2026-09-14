import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Reveal from '../components/Reveal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import CTABanner from '../components/CTABanner.jsx';
import { api, fmtMoney } from '../api.js';
import { useSite } from '../hooks/useSite.jsx';
import { usePageSeo } from '../hooks/useSeo.js';
import { causeIcons, IconArrow, IconHeart } from '../components/Icons.jsx';
import { CampaignCard } from '../components/Cards.jsx';
import NotFound from './NotFound.jsx';

export default function WorkDetail() {
  const { slug } = useParams();
  const { causes, campaigns } = useSite();
  const [cause, setCause] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.cause(slug).then(setCause).catch(() => setNotFound(true));
    window.scrollTo(0, 0);
  }, [slug]);

  usePageSeo({
    title: cause?.title,
    description: cause?.description,
    image: cause?.image
  });

  if (notFound) return <NotFound />;
  if (!cause) return null;

  const Icon = causeIcons[cause.icon] || causeIcons.megaphone;
  const related = campaigns.filter((c) => c.cause_slug === cause.slug);
  const others = causes.filter((c) => c.slug !== cause.slug);

  return (
    <>
      <PageHeader
        kicker="Notre travail"
        title={cause.title}
        text={cause.tagline}
        image={cause.image}
      />

      <section className="container-x py-20">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <Reveal>
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-400 text-ink-950">
                <Icon className="h-7 w-7" />
              </span>
              <h2 className="font-display text-2xl font-bold text-ink-900">Notre engagement</h2>
            </div>
            <div className="prose-adi mt-8 text-[17px]">
              {cause.long_content.split('\n\n').map((p, i) => (
                <p key={i} className="mb-5 leading-relaxed text-ink-600">{p}</p>
              ))}
            </div>
          </Reveal>
          <Reveal x={40} y={0} className="space-y-6">
            <div className="card p-7">
              <h3 className="font-display text-lg font-bold text-ink-900">Cette cause en chiffres</h3>
              <ul className="mt-4 space-y-3 text-[15px] text-ink-600">
                <li className="flex justify-between"><span>Domaines d'action de l'ONG</span><span className="font-bold text-brand-600">{causes.length}</span></li>
                <li className="flex justify-between"><span>Expérience</span><span className="font-bold text-brand-600">6 ans</span></li>
                <li className="flex justify-between"><span>Collectes liées</span><span className="font-bold text-brand-600">{related.length}</span></li>
              </ul>
            </div>
            <div className="rounded-3xl bg-brand-700 p-7 text-white">
              <h3 className="font-display text-lg font-bold">Soutenir {cause.title.toLowerCase()}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                Votre don finance directement nos programmes et forme les jeunes que nous accompagnons.
              </p>
              <Link to="/faire-un-don" className="btn-accent mt-5 w-full">
                <IconHeart className="h-5 w-5" /> Faire un don
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {related.length > 0 && (
        <section className="bg-white py-20">
          <div className="container-x">
            <Reveal>
              <h2 className="font-display text-3xl font-bold text-ink-900">Collectes liées à cette cause</h2>
            </Reveal>
            <div className="mt-10 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
              {related.map((c, i) => (
                <Reveal key={c.id} delay={i * 0.1}>
                  <CampaignCard campaign={c} index={i} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-x py-20">
        <Reveal>
          <h2 className="font-display text-2xl font-bold text-ink-900">Découvrir nos autres domaines</h2>
        </Reveal>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.08}>
              <Link to={c.link || `/notre-travail/${c.slug}`} className="card group flex items-center gap-4 p-5 transition-transform hover:-translate-y-1">
                <img src={c.image} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                <div className="flex-1">
                  <h3 className="font-display font-bold text-ink-900 group-hover:text-brand-700">{c.title}</h3>
                  <p className="mt-0.5 text-sm text-ink-400 line-clamp-1">{c.tagline}</p>
                </div>
                <IconArrow className="h-5 w-5 text-brand-500 transition-transform group-hover:translate-x-1" />
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <CTABanner />
    </>
  );
}
