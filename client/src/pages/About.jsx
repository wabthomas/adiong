import React from 'react';
import { Link } from 'react-router-dom';
import Reveal, { Stagger, staggerItem, Counter } from '../components/Reveal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import CTABanner from '../components/CTABanner.jsx';
import { useSite } from '../hooks/useSite.jsx';
import { usePageSeo } from '../hooks/useSeo.js';
import { IconCheck, IconSpark, IconClipboard, IconUsers, IconGlobe, IconTarget, IconArrow } from '../components/Icons.jsx';

const valueIcons = [
  <IconCheck key="a" className="h-6 w-6" />,
  <IconUsers key="b" className="h-6 w-6" />,
  <IconGlobe key="c" className="h-6 w-6" />,
  <IconSpark key="d" className="h-6 w-6" />,
  <IconTarget key="e" className="h-6 w-6" />
];

export default function About() {
  const { site, causes } = useSite();
  usePageSeo({
    title: site.about_header?.title,
    description: site.about_header?.text,
    image: site.about_header?.image || site.about_image
  });

  return (
    <>
      <PageHeader
        kicker={site.about_header?.kicker || 'À propos'}
        title={site.about_header?.title || 'Qui sommes-nous ?'}
        text={site.about_header?.text}
        image={site.about_header?.image || site.about_image || '/uploads/seed/about.jpg'}
      />

      {/* Présentation */}
      <section className="container-x py-24">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">{site.about_title}</h2>
            <p className="mt-6 text-lg leading-relaxed text-ink-600">{site.about_text}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/notre-travail" className="btn-primary">Notre travail <IconArrow className="h-4 w-4" /></Link>
              <Link to="/contact" className="btn-ghost">Nous contacter</Link>
            </div>
          </Reveal>
          <Reveal x={40} y={0}>
            <img
              src={site.about_image || '/uploads/seed/about.jpg'}
              alt="Équipe ADI ONG"
              className="h-[440px] w-full rounded-[2rem] object-cover shadow-lift"
            />
          </Reveal>
        </div>
      </section>

      {/* Valeurs */}
      <section className="bg-white py-24">
        <div className="container-x">
          <Reveal className="mx-auto max-w-3xl text-center">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-1.5 text-sm font-bold text-brand-700 uppercase tracking-wide">
              <IconSpark className="h-4 w-4" /> {site.about_values_kicker || 'Nos valeurs'}
            </p>
            <h2 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">
              {site.about_values_title || 'Ce qui guide chacune de nos actions'}
            </h2>
          </Reveal>
          <Stagger className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(site.values || []).map((v, i) => (
              <Reveal key={v.title} {...staggerItem}>
                <div className="card h-full p-7 transition-transform duration-300 hover:-translate-y-1.5">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-100 text-accent-700">
                    {valueIcons[i % valueIcons.length]}
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold text-ink-900">{v.title}</h3>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-ink-500">{v.text}</p>
                </div>
              </Reveal>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Méthode de travail */}
      <section className="container-x py-24">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-1.5 text-sm font-bold text-brand-700 uppercase tracking-wide">
              <IconClipboard className="h-4 w-4" /> {site.about_method_kicker || 'Méthode de travail'}
            </p>
            <h2 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">
              {site.about_method_title || 'Comment nous intervenons sur le terrain'}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-500">
              {site.about_method_text || 'Une approche participative, transparente et centrée sur les personnes concernées.'}
            </p>
            <div className="mt-8 rounded-3xl bg-brand-700 p-8 text-white">
              <p className="font-display text-3xl font-extrabold text-accent-300">
                <Counter value={site.stats?.[2]?.value ?? 15} suffix={site.stats?.[2]?.suffix || '+'} />
              </p>
              <p className="mt-1 font-semibold text-white/80">{site.stats?.[2]?.label || 'projets et activités réalisés'}</p>
            </div>
          </Reveal>
          <Stagger className="space-y-6">
            {(site.method || []).map((m, i) => (
              <Reveal key={m.title} {...staggerItem}>
                <div className="card flex gap-5 p-7">
                  <span className="font-display text-4xl font-extrabold text-brand-200 select-none">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-ink-900">{m.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{m.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Présence + carrières */}
      <section className="bg-white py-24">
        <div className="container-x">
          <Stagger className="grid gap-6 md:grid-cols-2">
            <Reveal {...staggerItem}>
              <div className="card h-full p-8">
                <h3 className="font-display text-xl font-bold text-ink-900">{site.about_presence_title || 'Notre présence'}</h3>
                <p className="mt-3 leading-relaxed text-ink-500">
                  {site.about_presence_text || "Notre siège est basé à Goma, dans le Nord-Kivu (RDC), au 38 Av. Baraka, Rue Dr. Maganga, quartier Himbi. Nous intervenons dans la ville de Goma et les communautés environnantes, en partenariat avec les écoles, les institutions et la société civile locale."}
                </p>
              </div>
            </Reveal>
            <Reveal {...staggerItem}>
              <div className="card h-full p-8">
                <h3 className="font-display text-xl font-bold text-ink-900">{site.about_career_title || 'Carrière, bénévolat & préoccupations'}</h3>
                <p className="mt-3 leading-relaxed text-ink-500">
                  {site.about_career_text || 'Vous souhaitez rejoindre nos équipes, devenir volontaire ou partager une préoccupation ? Écrivez-nous'}
                  <a href={`mailto:${site.email}`} className="font-semibold text-brand-600 hover:underline"> {site.email}</a> —
                  nous répondons à toutes les candidatures.
                </p>
                <Link to="/contact" className="btn-primary mt-6">
                  Nous écrire <IconArrow className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
          </Stagger>
        </div>
      </section>

      {/* Domaines d'action récap */}
      <section className="container-x pb-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">Nos domaines d'action</h2>
        </Reveal>
        <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {causes.map((c) => (
            <Reveal key={c.id} {...staggerItem}>
              <Link to={c.link || '/notre-travail'} className="group block">
                <div className="card h-full p-7 transition-transform duration-300 group-hover:-translate-y-1.5">
                  <h3 className="font-display font-bold text-ink-900 group-hover:text-brand-700">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500 line-clamp-3">{c.tagline}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-600">
                    En savoir plus <IconArrow className="h-4 w-4 transition-all group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </Stagger>
      </section>

      <CTABanner />
    </>
  );
}
