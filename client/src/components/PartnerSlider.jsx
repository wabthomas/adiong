import React from 'react';
import { useSite } from '../hooks/useSite.jsx';

export default function PartnerSlider() {
  const { partners } = useSite();
  if (!partners || partners.length === 0) return null;

  const single = partners.length === 1;
  const items = single ? partners : [...partners, ...partners];
  const duration = Math.max(20, partners.length * 6);

  return (
    <section aria-label="Nos partenaires" className="border-t border-ink-100 bg-white py-10">
      <div className="container-x">
        <p className="text-center text-[11px] font-bold tracking-[0.25em] text-ink-400 uppercase">
          Ils nous font confiance
        </p>
        {single ? (
          <div className="mt-7 flex justify-center">
            <PartnerLogo p={partners[0]} />
          </div>
        ) : (
          <div
            className="partner-marquee relative mt-7 overflow-hidden"
            style={{ '--partner-duration': `${duration}s` }}
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent sm:w-28" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent sm:w-28" />
            <div className="partner-track flex w-max items-center">
              {items.map((p, i) => (
                <div key={`${p.id}-${i}`} className="shrink-0 pr-14 sm:pr-20">
                  <PartnerLogo p={p} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PartnerLogo({ p }) {
  const inner = (
    <img
      src={p.logo}
      alt={p.name}
      loading="lazy"
      className="h-12 w-auto max-w-[170px] object-contain opacity-60 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0 sm:h-14"
    />
  );
  return p.link ? (
    <a href={p.link} target="_blank" rel="noopener noreferrer" title={p.name}>
      {inner}
    </a>
  ) : (
    <span title={p.name}>{inner}</span>
  );
}
