import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useSite } from '../hooks/useSite.jsx';
import { usePageSeo } from '../hooks/useSeo.js';
import { IconMail, IconPhone, IconPrinter } from '../components/Icons.jsx';

export default function MemberCard() {
  const { code } = useParams();
  const { site } = useSite();
  const [member, setMember] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    api.member(code)
      .then(setMember)
      .catch((e) => setError(e.message || 'Membre introuvable'))
      .finally(() => setLoading(false));
  }, [code]);

  usePageSeo({
    title: member ? `${member.full_name} — fiche membre` : 'Fiche membre',
    description: member?.bio || member?.job_title || 'Fiche membre ADI ONG',
    image: member?.photo,
    path: `/membre/${code}`,
    noindex: true
  });

  if (loading) {
    return (
      <section className="grid min-h-[70vh] place-items-center px-6 pt-28">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </section>
    );
  }

  if (error || !member) {
    return (
      <section className="mx-auto max-w-lg px-6 pt-36 pb-20 text-center">
        <p className="font-display text-6xl font-extrabold text-brand-200">?</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink-900">Fiche introuvable</h1>
        <p className="mt-3 text-ink-500">Ce code membre n'est pas reconnu.</p>
        <Link to="/" className="btn-primary mt-8 inline-flex">Retour à l'accueil</Link>
      </section>
    );
  }

  return (
    <section className="bg-cream px-4 pt-36 pb-20 sm:px-6">
      <div className="mx-auto max-w-md overflow-hidden rounded-[2rem] bg-white shadow-lift ring-1 ring-ink-950/5">
        <div className="bg-brand-700 px-6 py-5 text-white">
          <div className="flex items-center justify-between gap-3">
            {site.logo ? (
              <span className="rounded-lg bg-white px-2 py-1">
                <img src={site.logo} alt={site.site_name || 'ADI ONG'} className="h-8 object-contain" />
              </span>
            ) : (
              <p className="font-display text-lg font-bold">ADI ONG</p>
            )}
            <span className="rounded-full bg-accent-400 px-3 py-1 text-[11px] font-bold tracking-wide text-ink-950">
              {member.unique_code}
            </span>
          </div>
          <p className="mt-3 text-xs font-semibold tracking-widest text-white/70 uppercase">Fiche membre</p>
        </div>

        <div className="px-6 pt-8 pb-8 text-center">
          {member.photo ? (
            <img src={member.photo} alt={member.full_name} className="mx-auto h-28 w-28 rounded-full object-cover ring-4 ring-brand-100" />
          ) : (
            <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-brand-100 font-display text-3xl font-bold text-brand-700">
              {(member.full_name || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="mt-4 font-display text-2xl font-bold text-ink-900">{member.full_name}</h1>
          {member.job_title && <p className="mt-1 font-semibold text-brand-700">{member.job_title}</p>}
          {member.role_label && (
            <p className="mt-2 text-xs font-bold tracking-wider text-ink-400 uppercase">{member.role_label}</p>
          )}
          {member.bio && <p className="mt-4 text-sm leading-relaxed text-ink-600">{member.bio}</p>}

          <div className="mt-6 space-y-2 text-sm">
            {member.email && (
              <a href={`mailto:${member.email}`} className="flex items-center justify-center gap-2 font-semibold text-ink-700 hover:text-brand-700">
                <IconMail className="h-4 w-4" /> {member.email}
              </a>
            )}
            {member.phone && (
              <a href={`tel:${member.phone}`} className="flex items-center justify-center gap-2 font-semibold text-ink-700 hover:text-brand-700">
                <IconPhone className="h-4 w-4" /> {member.phone}
              </a>
            )}
          </div>

          <div className="mt-8 rounded-2xl bg-cream p-4">
            <img
              src={`/api/public/member/${encodeURIComponent(member.unique_code)}/qr`}
              alt={`QR ${member.unique_code}`}
              className="mx-auto h-40 w-40"
            />
            <p className="mt-2 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Scanner pour vérifier</p>
          </div>

          <Link to={`/membre/${encodeURIComponent(member.unique_code)}/carte`} className="btn-primary mt-6 flex items-center justify-center gap-2">
            <IconPrinter className="h-4 w-4" /> Carte imprimable
          </Link>
        </div>
      </div>
    </section>
  );
}
