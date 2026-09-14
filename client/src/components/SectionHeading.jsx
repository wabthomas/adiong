import React from 'react';
import Reveal from './Reveal.jsx';

export default function SectionHeading({ kicker, title, text, align = 'center', light = false }) {
  return (
    <Reveal className={`max-w-3xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      {kicker && (
        <p
          className={`mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold tracking-wide uppercase ${
            light ? 'bg-white/10 text-accent-300 ring-1 ring-white/20' : 'bg-brand-100 text-brand-700'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${light ? 'bg-accent-300' : 'bg-brand-500'}`} />
          {kicker}
        </p>
      )}
      <h2 className={`font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold leading-tight tracking-tight ${light ? 'text-white' : 'text-ink-900'}`}>
        {title}
      </h2>
      {text && <p className={`mt-5 text-lg leading-relaxed ${light ? 'text-white/70' : 'text-ink-500'}`}>{text}</p>}
    </Reveal>
  );
}
