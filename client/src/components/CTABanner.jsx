import React from 'react';
import { Link } from 'react-router-dom';
import Reveal from './Reveal.jsx';
import { IconHeart, IconPhone } from './Icons.jsx';
import { useSite } from '../hooks/useSite.jsx';

export default function CTABanner() {
  const { site } = useSite();
  return (
    <section className="container-x py-12 sm:py-16 lg:py-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-5 py-10 text-center shadow-lift sm:rounded-[2.5rem] sm:px-14 sm:py-14">
          <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-accent-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <p className="mb-3 text-xs font-bold tracking-[0.2em] text-accent-300 uppercase sm:text-sm">
              {site.cta_kicker || 'Donnez-leur un coup de main'}
            </p>
            <h2 className="mx-auto max-w-3xl font-display text-[1.65rem] font-bold leading-tight text-white sm:text-4xl">
              {site.cta_title || 'Chaque personne compte. Chaque contribution, chaque don compte.'}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-white/75 sm:mt-4 sm:text-lg">
              {site.cta_text || "Rejoignez-nous dans cette cause et aidons les personnes vivant avec handicap à prendre leur place dans tous les secteurs de la vie."}
            </p>
            <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:mt-9 sm:flex-row sm:items-center sm:gap-4">
              <Link to="/faire-un-don" className="btn-accent w-full sm:w-auto">
                <IconHeart className="h-5 w-5" /> Faire un don
              </Link>
              {String(site.phone1 || '').replace(/\s/g, '') && (
                <a href={`tel:${String(site.phone1).replace(/\s/g, '')}`} className="btn w-full border border-white/30 bg-white/10 px-7 py-3.5 text-white backdrop-blur transition-all hover:bg-white/20 sm:w-auto">
                  <IconPhone className="h-5 w-5" /> {site.phone1}
                </a>
              )}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
