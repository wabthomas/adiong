import React from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../hooks/useSite.jsx';
import {
  IconFacebook, IconInstagram, IconMail, IconPhone, IconPin,
  IconPinterest, IconTwitter, IconWhatsapp, IconHeart
} from './Icons.jsx';
import { isExternalHref, resolveDonateCta, resolveFooterMenu } from '../lib/menus.js';

function FooterCredit({ text }) {
  const raw = text || "Fait avec {heart} pour l'inclusion";
  const parts = raw.split('{heart}');
  return (
    <span className="inline-flex items-center gap-1.5 text-white/40">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <IconHeart className="h-4 w-4 text-accent-400" />}
          {part}
        </React.Fragment>
      ))}
    </span>
  );
}

function FooterLink({ to, children, className }) {
  if (isExternalHref(to)) {
    return (
      <a href={to} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

export default function Footer() {
  const { site, causes } = useSite();
  const footerLinks = resolveFooterMenu(site);
  const donate = resolveDonateCta(site);
  const socials = [
    { href: site.facebook, Icon: IconFacebook, label: 'Facebook' },
    { href: site.twitter, Icon: IconTwitter, label: 'X (Twitter)' },
    { href: site.instagram, Icon: IconInstagram, label: 'Instagram' },
    { href: site.pinterest, Icon: IconPinterest, label: 'Pinterest' },
    { href: site.whatsapp ? `https://wa.me/${String(site.whatsapp).replace(/\D/g, '')}` : null, Icon: IconWhatsapp, label: 'WhatsApp' }
  ].filter((s) => s.href);

  return (
    <footer className="relative overflow-hidden bg-ink-950 text-white">
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
      <div className="container-x relative py-12 sm:py-16 lg:py-20">
        <div className="grid gap-10 sm:gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div>
            <Link to="/" className="flex items-center gap-3">
              {site.logo ? (
                <span className="rounded-xl bg-white px-2.5 py-1.5">
                  <img src={site.logo} alt={site.site_name || 'ADI ONG'} className="h-9 max-w-[180px] object-contain sm:h-11 sm:max-w-[260px]" />
                </span>
              ) : (
                <>
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="white" strokeWidth="1.8">
                      <circle cx="12" cy="8" r="3" fill="#fc7a03" stroke="none" />
                      <path d="M5 18.5c1.4-4 4-5.5 7-5.5s5.6 1.5 7 5.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="font-display text-xl font-bold">{site.site_name || 'ADI ONG'}</span>
                </>
              )}
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60 sm:mt-5 sm:text-[15px]">{site.site_tagline}.</p>
            <div className="mt-5 flex flex-wrap gap-2.5 sm:mt-6">
              {socials.map(({ href, Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-white/8 text-white/70 transition-all duration-300 hover:-translate-y-1 hover:bg-accent-400 hover:text-ink-950"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:contents">
            <div>
              <h4 className="font-display text-xs font-bold tracking-widest text-white/50 uppercase sm:text-sm">
                {site.menu_footer_work_title || 'Notre travail'}
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm sm:mt-5 sm:space-y-3 sm:text-[15px]">
                {(causes.length ? causes : []).slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <Link to={c.link || '/notre-travail'} className="text-white/70 transition-colors hover:text-accent-300">
                      {c.title}
                    </Link>
                  </li>
                ))}
                <li>
                  <FooterLink to={donate.to} className="font-semibold text-accent-300 hover:text-accent-200">
                    {donate.label}
                  </FooterLink>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-display text-xs font-bold tracking-widest text-white/50 uppercase sm:text-sm">
                {site.menu_footer_title || 'Navigation'}
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm sm:mt-5 sm:space-y-3 sm:text-[15px]">
                {footerLinks.map((l) => (
                  <li key={`${l.to}-${l.label}`}>
                    <FooterLink to={l.to} className="text-white/70 transition-colors hover:text-accent-300">
                      {l.label}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h4 className="font-display text-xs font-bold tracking-widest text-white/50 uppercase sm:text-sm">Contact</h4>
            <ul className="mt-4 space-y-3.5 text-sm text-white/70 sm:mt-5 sm:space-y-4 sm:text-[15px]">
              <li className="flex gap-3">
                <IconPin className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" />
                <span className="break-words">{site.address}</span>
              </li>
              <li className="flex gap-3">
                <IconPhone className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" />
                <span>
                  {site.phone1}
                  {site.phone2 && <span className="block">{site.phone2}</span>}
                </span>
              </li>
              <li className="flex gap-3">
                <IconMail className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" />
                <a href={`mailto:${site.email}`} className="break-all hover:text-accent-300">{site.email}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-center sm:mt-14 sm:flex-row sm:gap-4 sm:pt-7 sm:text-left">
          <p className="text-xs text-white/50 sm:text-sm">{site.copyright || '© 2026 ADI ONG — Tous droits réservés.'}</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:gap-5 sm:text-sm">
            <Link to="/admin" className="text-white/40 transition-colors hover:text-accent-300">Espace admin</Link>
            <FooterCredit text={site.footer_credit} />
          </div>
        </div>
      </div>
    </footer>
  );
}
