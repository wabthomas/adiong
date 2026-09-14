import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { fmtDate, fmtMoney } from '../api.js';
import { IconArrow, causeIcons, IconCalendar } from './Icons.jsx';

const card = {
  hidden: { opacity: 0, y: 30 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.21, 0.47, 0.32, 0.98] }
  })
};

export function CauseCard({ cause, index = 0, compact = false }) {
  const Icon = causeIcons[cause.icon] || causeIcons.megaphone;
  return (
    <motion.article
      variants={card}
      custom={index}
      whileHover={{ y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="card group relative flex h-full flex-col"
    >
      <div className="relative h-52 overflow-hidden">
        <img
          src={cause.image}
          alt={cause.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent" />
        <span className="absolute -bottom-6 left-6 grid h-12 w-12 place-items-center rounded-2xl bg-accent-400 text-ink-950 shadow-lift">
          <Icon className="h-6 w-6" />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6 pt-9">
        <h3 className="font-display text-lg font-bold text-ink-900">{cause.title}</h3>
        {!compact && <p className="mt-2.5 flex-1 text-[15px] leading-relaxed text-ink-500">{cause.description}</p>}
        <Link
          to={cause.link || '/notre-travail'}
          className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-600 transition-all group-hover:gap-3 hover:text-brand-700"
        >
          En savoir plus <IconArrow className="h-4 w-4" />
        </Link>
      </div>
    </motion.article>
  );
}

export function ArticleCard({ article, index = 0, big = false }) {
  return (
    <motion.article
      variants={card}
      custom={index}
      whileHover={{ y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="card group"
    >
      <Link to={`/actualites/${article.slug}`} className="block">
        <div className="relative overflow-hidden">
          <div className={big ? 'h-64' : 'h-48'}>
            <img
              src={article.image}
              alt={article.title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              loading="lazy"
            />
          </div>
          <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3.5 py-1 text-xs font-bold text-brand-700 backdrop-blur">
            {categoryLabel(article.category)}
          </span>
        </div>
        <div className="p-6">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">
            <IconCalendar className="h-4 w-4" /> {fmtDate(article.date)}
          </p>
          <h3 className={`mt-2 font-display font-bold text-ink-900 group-hover:text-brand-700 ${big ? 'text-xl leading-snug' : 'text-[17px] leading-snug'}`}>
            {article.title}
          </h3>
          <p className="mt-2.5 line-clamp-2 text-[15px] leading-relaxed text-ink-500">{article.excerpt}</p>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-600 transition-all group-hover:gap-3">
            Lire l'article <IconArrow className="h-4 w-4" />
          </span>
        </div>
      </Link>
    </motion.article>
  );
}

export function CampaignCard({ campaign, index = 0, detailed = false }) {
  const pct = Math.min(100, Math.round(((campaign.collected_amount || 0) / (campaign.goal_amount || 1)) * 100));
  return (
    <motion.article
      variants={card}
      custom={index}
      whileHover={{ y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="card group flex h-full flex-col"
    >
      <div className="relative h-52 overflow-hidden">
        <img
          src={campaign.image}
          alt={campaign.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 to-transparent" />
        <div className="absolute bottom-4 left-5 right-5">
          <p className="font-display text-lg font-bold text-white drop-shadow">{campaign.title}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        {detailed && <p className="flex-1 text-[15px] leading-relaxed text-ink-500">{campaign.description}</p>}
        <div className="mt-auto pt-4">
          <div className="mb-2 flex items-end justify-between text-sm">
            <span className="font-bold text-ink-900">
              {fmtMoney(campaign.collected_amount)} <span className="font-medium text-ink-400">collectés</span>
            </span>
            <span className="font-semibold text-ink-400">Objectif : {fmtMoney(campaign.goal_amount)}</span>
          </div>
          <ProgressBar value={pct} />
          <div className="mt-5 flex items-center justify-between gap-3">
            {campaign.deadline && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-500">
                <IconCalendar className="h-3.5 w-3.5" /> Jusqu'au {fmtDate(campaign.deadline)}
              </span>
            )}
            <Link
              to={`/collectes/${campaign.slug}`}
              className="btn-primary !px-5 !py-2.5 text-sm"
            >
              Soutenir
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export function ProgressBar({ value, className = '' }) {
  const reduce = useReducedMotion();
  return (
    <div className={`h-3 w-full overflow-hidden rounded-full bg-ink-100 ${className}`}>
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-400"
        initial={reduce ? false : { width: 0 }}
        whileInView={{ width: `${Math.min(100, value)}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.21, 0.47, 0.32, 0.98], delay: 0.2 }}
      />
    </div>
  );
}

export function categoryLabel(cat) {
  return (
    {
      plaidoyer: 'Plaidoyer',
      education: 'Éducation',
      ecologie: 'Écologie',
      socio_economique: 'Socio-économique',
      entrepreneuriat: 'Entrepreneuriat',
      actualites: 'Actualité'
    }[cat] || 'Actualité'
  );
}
