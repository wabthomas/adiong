import React from 'react';
import { Link } from 'react-router-dom';

export default function Maintenance({ message, site }) {
  const name = site?.site_name || 'ADI ONG';
  const logo = site?.logo;
  const text =
    message?.trim() ||
    'Le site est temporairement en maintenance. Nous revenons très bientôt.';

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink-950 px-6 py-16 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34, 197, 94, 0.35), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(14, 165, 233, 0.2), transparent)'
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
        }}
      />

      <div className="relative z-10 max-w-lg">
        {logo ? (
          <img src={logo} alt={name} className="mx-auto h-14 w-auto object-contain sm:h-16" />
        ) : (
          <p className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{name}</p>
        )}

        <div className="mt-10 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-accent-300 ring-1 ring-white/15">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-400" />
          </span>
          Maintenance
        </div>

        <h1 className="mt-6 font-display text-3xl font-bold text-white sm:text-4xl">
          Nous reviendrons bientôt
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">{text}</p>

        <Link
          to="/admin/login"
          className="mt-10 inline-flex text-sm font-semibold text-white/50 underline-offset-4 transition hover:text-white hover:underline"
        >
          Accès administration
        </Link>
      </div>
    </div>
  );
}
