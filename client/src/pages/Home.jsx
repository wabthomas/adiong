import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import Reveal, { Stagger, staggerItem, Counter } from '../components/Reveal.jsx';
import SectionHeading from '../components/SectionHeading.jsx';
import { usePageSeo } from '../hooks/useSeo.js';
import { CauseCard, ArticleCard, CampaignCard, ProgressBar } from '../components/Cards.jsx';
import CTABanner from '../components/CTABanner.jsx';
import { useSite } from '../hooks/useSite.jsx';
import { IconArrow, IconCheck, IconPlay, IconHeart, IconPhone, IconMail, IconPin, causeIcons } from '../components/Icons.jsx';

const DEFAULT_MARQUEE = [
  'Inclusion', 'Plaidoyer', 'Entrepreneuriat', 'Éducation inclusive', 'Justice climatique',
  'Dignité', 'Participation', 'Solidarité', 'Droits des PvH', 'Goma — RDC'
];

export default function Home() {
  const { site, causes, articles, campaigns } = useSite();
  const reduce = useReducedMotion();
  const heroRef = React.useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const yImg = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 60]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.25]);

  usePageSeo({});

  const stats = Array.isArray(site.stats) && site.stats.length ? site.stats : [
    { value: 6, suffix: ' ans', label: "d'expérience professionnelle" }
  ];
  const marqueeItems = Array.isArray(site.marquee_items) && site.marquee_items.length
    ? site.marquee_items
    : DEFAULT_MARQUEE;
  const heroImage = site.hero_image || '/uploads/seed/hero.jpg';
  const aboutImage = site.about_image || '/uploads/seed/about.jpg';
  const topCampaign = campaigns[0];
  const latest = articles.slice(0, 3);

  return (
    <>
      {}
      <section
        ref={heroRef}
        className="relative flex w-full items-center overflow-hidden"
      >
        <motion.div style={reduce ? undefined : { y: yImg }} className="absolute inset-0">
          <img
            src={heroImage}
            alt="Jeunes personnes en situation de handicap réunies à Goma"
            className="h-full w-full object-cover object-[center_28%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950/90 via-ink-950/65 to-ink-950/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-ink-950/40" />
        </motion.div>

        <div className="container-x relative pt-24 pb-10 sm:pt-28 sm:pb-12" style={reduce ? undefined : { opacity }}>
          <div className="max-w-2xl">
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur sm:text-[15px]"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent-400" />
              {site.hero_kicker || "Bienvenue dans le monde de l'ONG ADI"}
            </motion.p>

            <h1 className="font-display text-[1.9rem] leading-[1.35] font-extrabold text-white sm:text-[2.25rem] sm:leading-[1.32] lg:text-[2.75rem] lg:leading-[1.28]">
              {heroLines(site.hero_title || site.site_tagline || '').map((line, i) => (
                <span key={i} className="block overflow-hidden">
                  <motion.span
                    className="block"
                    initial={reduce ? false : { y: '110%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.9, delay: 0.25 + i * 0.12, ease: [0.21, 0.47, 0.32, 0.98] }}
                  >
                    {i === 0 ? (
                      <>
                        {line.split(' ').slice(0, 2).join(' ')}{' '}
                        <span className="text-accent-400">{line.split(' ').slice(2).join(' ')}</span>
                      </>
                    ) : (
                      line
                    )}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.p
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.75 }}
              className="mt-5 max-w-2xl text-base leading-[1.8] text-white/85 sm:text-lg sm:leading-[1.85]"
            >
              {site.hero_text}
            </motion.p>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.95 }}
              className="mt-6 flex flex-wrap items-center gap-3"
            >
              <Link to="/faire-un-don" className="btn-accent">
                <IconHeart className="h-5 w-5" /> Faire un don
              </Link>
              <Link to="/notre-travail" className="btn border border-white/30 bg-white/10 px-6 py-3 text-white backdrop-blur transition-all hover:bg-white/20">
                Notre travail <IconArrow className="h-4 w-4" />
              </Link>
              {site.video_url && (
                <a
                  href={site.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-3 text-sm font-semibold text-white/90 hover:text-white"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 ring-1 ring-white/30 transition-all group-hover:bg-accent-400 group-hover:text-ink-950">
                    <IconPlay className="ml-0.5 h-4 w-4" />
                  </span>
                  Voir la vidéo — What ADI can do
                </a>
              )}
            </motion.div>
          </div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.15 }}
          className="absolute top-[46%] right-10 hidden -translate-y-1/2 lg:block"
        >
          <div className="animate-floaty w-[7.25rem] rounded-2xl bg-white/10 px-3 py-3 shadow-lift ring-1 ring-white/25 backdrop-blur-xl">
            <p className="font-display text-2xl leading-none font-extrabold text-accent-400">
              <Counter value={stats[0].value} suffix={stats[0].suffix} />
            </p>
            <p className="mt-1.5 text-[11px] leading-snug font-semibold text-white/85">
              {stats[0].label}
            </p>
          </div>
        </motion.div>
      </section>

      {}
      <div className="relative overflow-hidden border-y border-brand-800 bg-brand-700 py-4">
        <div className="flex w-max animate-marquee">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
              {marqueeItems.map((m) => (
                <span key={m + dup} className="flex items-center gap-6 pr-6 text-sm font-bold tracking-widest text-white/85 uppercase">
                  {m} <span className="text-accent-400">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {}
      <section className="container-x py-24 lg:py-32">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal className="relative">
            <div className="relative">
              <img
                src={aboutImage}
                alt="L'équipe de l'ONG ADI en réunion"
                className="h-[420px] w-full rounded-[2rem] object-cover shadow-lift lg:h-[520px]"
              />
              <div className="absolute -right-4 -bottom-6 hidden w-64 rounded-3xl bg-accent-400 p-6 shadow-lift sm:block">
                <p className="font-display text-4xl font-extrabold text-ink-950">
                  <Counter value={stats[1]?.value ?? 120} suffix={stats[1]?.suffix || '+'} />
                </p>
                <p className="mt-1 text-sm font-bold text-ink-900/80">{stats[1]?.label || 'personnes accompagnées'}</p>
              </div>
              <div className="absolute -top-5 -left-5 hidden rounded-2xl bg-white p-4 shadow-lift ring-1 ring-ink-950/5 md:block">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-700">
                    <IconCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink-900">{site.hero_badge_title || 'ONG congolaise'}</p>
                    <p className="text-xs font-medium text-ink-400">{site.hero_badge_sub || 'Basée à Goma, Nord-Kivu'}</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <div>
            <SectionHeading
              align="left"
              kicker={site.mission_title || 'Notre mission'}
              title={site.home_mission_heading || "Une société plus juste, où chaque personne est pleinement intégrée"}
              text={site.mission_text}
            />
            <Reveal delay={0.2} className="mt-10 grid grid-cols-2 gap-6">
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink-950/5">
                  <p className="font-display text-3xl font-extrabold text-brand-600">
                    <Counter value={s.value} suffix={s.suffix} />
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink-500">{s.label}</p>
                </div>
              ))}
            </Reveal>
            <Reveal delay={0.3}>
              <Link to="/a-propos" className="btn-primary mt-10">
                Découvrir l'ONG <IconArrow className="h-4 w-4" />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {}
      <section className="relative bg-white py-24 lg:py-32">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              align="left"
              kicker={site.home_work_kicker || 'Notre travail'}
              title={site.home_work_title || "Les causes qui nous tiennent à cœur"}
              text={site.home_work_text}
            />
            <Reveal delay={0.15}>
              <Link to="/notre-travail" className="btn-ghost hidden sm:inline-flex">
                Tous nos domaines <IconArrow className="h-4 w-4" />
              </Link>
            </Reveal>
          </div>
          <Stagger className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {causes.map((c, i) => (
              <CauseCard key={c.id} cause={c} index={i} />
            ))}
          </Stagger>
          <Reveal delay={0.2} className="mt-10 text-center sm:hidden">
            <Link to="/notre-travail" className="btn-ghost">Tous nos domaines <IconArrow className="h-4 w-4" /></Link>
          </Reveal>
        </div>
      </section>

      {}
      {topCampaign && (
        <section className="container-x py-24 lg:py-32">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <SectionHeading
                align="left"
                kicker="Campagne en cours"
                title={topCampaign.title}
                text={topCampaign.description}
              />
              <Reveal delay={0.15} className="mt-10">
                <div className="space-y-2 text-sm font-semibold text-ink-600">
                  <div className="flex justify-between">
                    <span>Collecté : {Math.round(topCampaign.collected_amount)} USD</span>
                    <span>Objectif : {Math.round(topCampaign.goal_amount)} USD</span>
                  </div>
                </div>
                <ProgressBar
                  className="mt-3 h-4"
                  value={Math.min(100, (topCampaign.collected_amount / (topCampaign.goal_amount || 1)) * 100)}
                />
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link to={`/collectes/${topCampaign.slug}`} className="btn-primary">
                    <IconHeart className="h-5 w-5" /> Soutenir cette cause
                  </Link>
                  <Link to="/collectes" className="btn-ghost">Toutes les collectes</Link>
                </div>
              </Reveal>
            </div>
            <Reveal x={40} y={0} delay={0.1}>
              <div className="relative">
                <img
                  src={topCampaign.image}
                  alt={topCampaign.title}
                  className="h-[420px] w-full rounded-[2rem] object-cover shadow-lift lg:h-[500px]"
                />
                <div className="absolute -bottom-6 left-8 rounded-2xl bg-white px-6 py-4 shadow-lift ring-1 ring-ink-950/5">
                  <p className="font-display text-2xl font-extrabold text-brand-600">
                    {Math.min(100, Math.round((topCampaign.collected_amount / (topCampaign.goal_amount || 1)) * 100))}%
                  </p>
                  <p className="text-xs font-bold tracking-wide text-ink-400 uppercase">de l'objectif atteint</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {}
      <section className="bg-white py-24 lg:py-32">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              align="left"
              kicker={site.home_news_kicker || 'Dernières informations'}
              title={site.home_news_title || "Regardez nos dernières actualités"}
              text={site.home_news_text}
            />
            <Reveal delay={0.15}>
              <Link to="/actualites" className="btn-ghost hidden sm:inline-flex">
                Plus d'actualités <IconArrow className="h-4 w-4" />
              </Link>
            </Reveal>
          </div>
          <Stagger className="mt-14 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            {latest.map((a, i) => (
              <ArticleCard key={a.id} article={a} index={i} />
            ))}
          </Stagger>
          <Reveal delay={0.2} className="mt-10 text-center sm:hidden">
            <Link to="/actualites" className="btn-ghost">Plus d'actualités <IconArrow className="h-4 w-4" /></Link>
          </Reveal>
        </div>
      </section>

      <CTABanner />

      {}
      <section className="container-x pb-24">
        <Stagger className="grid gap-6 md:grid-cols-3">
          {[
            { Icon: IconPin, title: 'Notre adresse', lines: [site.address] },
            { Icon: IconPhone, title: 'Téléphone', lines: [site.phone1, site.phone2].filter(Boolean) },
            { Icon: IconMail, title: 'Email', lines: [site.email] }
          ].map((c) => (
            <Reveal key={c.title} {...staggerItem}>
              <div className="card flex items-start gap-4 p-7">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                  <c.Icon className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-ink-900">{c.title}</h3>
                  {c.lines.map((l) => (
                    <p key={l} className="mt-1 text-[15px] leading-relaxed text-ink-500">{l}</p>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </Stagger>
      </section>
    </>
  );
}

function heroLines(title) {
  const text = String(title || '').trim();
  if (!text) return [''];
  const words = text.split(' ');
  if (words.length < 6) return [text];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}
