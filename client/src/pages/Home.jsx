import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import Reveal, { Stagger, staggerItem, Counter } from '../components/Reveal.jsx';
import SectionHeading from '../components/SectionHeading.jsx';
import { usePageSeo } from '../hooks/useSeo.js';
import { CauseCard, ArticleCard, CampaignCard, ProgressBar } from '../components/Cards.jsx';
import CTABanner from '../components/CTABanner.jsx';
import { useSite } from '../hooks/useSite.jsx';
import { fmtMoney } from '../api.js';
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
      <section
        ref={heroRef}
        className="relative flex min-h-[100svh] w-full items-end overflow-hidden sm:min-h-0 sm:items-center"
      >
        <motion.div style={reduce ? undefined : { y: yImg }} className="absolute inset-0">
          <img
            src={heroImage}
            alt="Jeunes personnes en situation de handicap réunies à Goma"
            className="h-full w-full object-cover object-[center_28%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950/92 via-ink-950/70 to-ink-950/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/25 to-ink-950/45" />
        </motion.div>

        <motion.div
          className="container-x relative pt-24 pb-10 sm:pt-28 sm:pb-14 lg:pb-16"
          style={reduce ? undefined : { opacity }}
        >
          <div className="max-w-2xl">
            <p className="mb-3 font-display text-2xl font-extrabold tracking-tight text-white sm:mb-4 sm:text-3xl">
              {site.site_name || 'ADI ONG'}
            </p>

            <motion.p
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/25 backdrop-blur sm:mb-4 sm:px-4 sm:text-sm"
            >
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent-400" />
              <span className="truncate">{site.hero_kicker || "Bienvenue dans le monde de l'ONG ADI"}</span>
            </motion.p>

            <h1 className="font-display text-[1.75rem] leading-[1.28] font-extrabold text-white sm:text-[2.25rem] sm:leading-[1.32] lg:text-[2.75rem] lg:leading-[1.28]">
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
              className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/85 line-clamp-4 sm:mt-5 sm:max-w-2xl sm:text-base sm:leading-[1.8] sm:line-clamp-none lg:text-lg"
            >
              {site.hero_text}
            </motion.p>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.95 }}
              className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <Link to="/faire-un-don" className="btn-accent w-full justify-center sm:w-auto">
                <IconHeart className="h-5 w-5" /> Faire un don
              </Link>
              <Link
                to="/notre-travail"
                className="btn w-full justify-center border border-white/30 bg-white/10 px-6 py-3.5 text-white backdrop-blur transition-all hover:bg-white/20 sm:w-auto"
              >
                Notre travail <IconArrow className="h-4 w-4" />
              </Link>
              {site.video_url && (
                <a
                  href={site.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center justify-center gap-3 text-sm font-semibold text-white/90 hover:text-white sm:justify-start"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 ring-1 ring-white/30 transition-all group-hover:bg-accent-400 group-hover:text-ink-950">
                    <IconPlay className="ml-0.5 h-4 w-4" />
                  </span>
                  Voir la vidéo
                </a>
              )}
            </motion.div>

            {/* Stats chip — visible sur mobile */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.1 }}
              className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur-md lg:hidden"
            >
              <p className="font-display text-2xl font-extrabold leading-none text-accent-400">
                <Counter value={stats[0].value} suffix={stats[0].suffix} />
              </p>
              <p className="max-w-[10rem] text-xs font-semibold leading-snug text-white/85">{stats[0].label}</p>
            </motion.div>
          </div>
        </motion.div>

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

      <div className="relative overflow-hidden border-y border-brand-800 bg-brand-700 py-3 sm:py-4">
        <div className="flex w-max animate-marquee">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
              {marqueeItems.map((m) => (
                <span key={m + dup} className="flex items-center gap-5 pr-5 text-[11px] font-bold tracking-widest text-white/85 uppercase sm:gap-6 sm:pr-6 sm:text-sm">
                  {m} <span className="text-accent-400">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="container-x py-14 sm:py-20 lg:py-32">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal className="relative">
            <div className="relative">
              <img
                src={aboutImage}
                alt="L'équipe de l'ONG ADI en réunion"
                className="h-[280px] w-full rounded-[1.5rem] object-cover shadow-lift sm:h-[380px] sm:rounded-[2rem] lg:h-[520px]"
              />
              <div className="absolute -right-2 -bottom-4 w-[min(100%,14rem)] rounded-2xl bg-accent-400 p-4 shadow-lift sm:-right-4 sm:-bottom-6 sm:w-64 sm:rounded-3xl sm:p-6">
                <p className="font-display text-3xl font-extrabold text-ink-950 sm:text-4xl">
                  <Counter value={stats[1]?.value ?? stats[0].value} suffix={stats[1]?.suffix ?? stats[0].suffix} />
                </p>
                <p className="mt-1 text-xs font-bold text-ink-900/80 sm:text-sm">{stats[1]?.label || stats[0].label}</p>
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
            <Reveal delay={0.2} className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-6">
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-950/5 sm:p-5">
                  <p className="font-display text-2xl font-extrabold text-brand-600 sm:text-3xl">
                    <Counter value={s.value} suffix={s.suffix} />
                  </p>
                  <p className="mt-1 text-xs font-semibold text-ink-500 sm:text-sm">{s.label}</p>
                </div>
              ))}
            </Reveal>
            <Reveal delay={0.3}>
              <Link to="/a-propos" className="btn-primary mt-8 w-full justify-center sm:mt-10 sm:w-auto">
                Découvrir l'ONG <IconArrow className="h-4 w-4" />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="relative bg-white py-14 sm:py-20 lg:py-32">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4 sm:gap-6">
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
          <Stagger className="mt-10 grid gap-5 sm:mt-14 sm:gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {causes.map((c, i) => (
              <CauseCard key={c.id} cause={c} index={i} />
            ))}
          </Stagger>
          <Reveal delay={0.2} className="mt-8 text-center sm:mt-10 sm:hidden">
            <Link to="/notre-travail" className="btn-ghost">Tous nos domaines <IconArrow className="h-4 w-4" /></Link>
          </Reveal>
        </div>
      </section>

      {topCampaign && (
        <section className="container-x py-14 sm:py-20 lg:py-32">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="order-2 lg:order-1">
              <SectionHeading
                align="left"
                kicker="Campagne en cours"
                title={topCampaign.title}
                text={topCampaign.description}
              />
              <Reveal delay={0.15} className="mt-8 sm:mt-10">
                <div className="flex flex-col gap-1 text-sm font-semibold text-ink-600 sm:flex-row sm:justify-between sm:gap-0">
                  <span>Collecté : {fmtMoney(topCampaign.collected_amount)}</span>
                  <span>Objectif : {fmtMoney(topCampaign.goal_amount)}</span>
                </div>
                <ProgressBar
                  className="mt-3 h-3.5 sm:h-4"
                  value={Math.min(100, (topCampaign.collected_amount / (topCampaign.goal_amount || 1)) * 100)}
                />
                <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-4">
                  <Link to={`/collectes/${topCampaign.slug}`} className="btn-primary w-full justify-center sm:w-auto">
                    <IconHeart className="h-5 w-5" /> Soutenir cette cause
                  </Link>
                  <Link to="/collectes" className="btn-ghost w-full justify-center sm:w-auto">Toutes les collectes</Link>
                </div>
              </Reveal>
            </div>
            <Reveal x={40} y={0} delay={0.1} className="order-1 lg:order-2">
              <div className="relative">
                <img
                  src={topCampaign.image}
                  alt={topCampaign.title}
                  className="h-[260px] w-full rounded-[1.5rem] object-cover shadow-lift sm:h-[380px] sm:rounded-[2rem] lg:h-[500px]"
                />
                <div className="absolute -bottom-4 left-4 rounded-2xl bg-white px-4 py-3 shadow-lift ring-1 ring-ink-950/5 sm:-bottom-6 sm:left-8 sm:px-6 sm:py-4">
                  <p className="font-display text-xl font-extrabold text-brand-600 sm:text-2xl">
                    {Math.min(100, Math.round((topCampaign.collected_amount / (topCampaign.goal_amount || 1)) * 100))}%
                  </p>
                  <p className="text-[10px] font-bold tracking-wide text-ink-400 uppercase sm:text-xs">de l'objectif atteint</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      <section className="bg-white py-14 sm:py-20 lg:py-32">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4 sm:gap-6">
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
          <Stagger className="mt-10 grid gap-5 sm:mt-14 sm:gap-7 md:grid-cols-2 lg:grid-cols-3">
            {latest.map((a, i) => (
              <ArticleCard key={a.id} article={a} index={i} />
            ))}
          </Stagger>
          <Reveal delay={0.2} className="mt-8 text-center sm:mt-10 sm:hidden">
            <Link to="/actualites" className="btn-ghost">Plus d'actualités <IconArrow className="h-4 w-4" /></Link>
          </Reveal>
        </div>
      </section>

      <CTABanner />

      <section className="container-x pb-14 sm:pb-20 lg:pb-24">
        <Stagger className="grid gap-4 sm:gap-6 md:grid-cols-3">
          {[
            { Icon: IconPin, title: 'Notre adresse', lines: [site.address] },
            { Icon: IconPhone, title: 'Téléphone', lines: [site.phone1, site.phone2].filter(Boolean) },
            { Icon: IconMail, title: 'Email', lines: [site.email] }
          ].map((c) => (
            <Reveal key={c.title} {...staggerItem}>
              <div className="card flex items-start gap-3.5 p-5 sm:gap-4 sm:p-7">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700 sm:h-12 sm:w-12">
                  <c.Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-ink-900">{c.title}</h3>
                  {c.lines.map((l) => (
                    <p key={l} className="mt-1 break-words text-sm leading-relaxed text-ink-500 sm:text-[15px]">{l}</p>
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
