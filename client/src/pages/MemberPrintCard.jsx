import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useSite } from '../hooks/useSite.jsx';
import { usePageSeo } from '../hooks/useSeo.js';
import { IconMail, IconPhone, IconPin } from '../components/Icons.jsx';

const PRINT_CSS = `
@page { size: A4; margin: 0; }
@media print {
  body * { visibility: hidden; }
  .print-card, .print-card * { visibility: visible; }
  .print-wrap { display: flex !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important; background: white !important; align-items: center; justify-content: center; }
  .print-card { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); box-shadow: none !important; margin: 0 !important; }
  .no-print { display: none !important; }
}
.print-card { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
`;

export default function MemberPrintCard() {
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
    title: member ? `Carte de membre — ${member.full_name}` : 'Carte de membre',
    path: `/membre/${code}/carte`,
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

  const qrSrc = `/api/public/member/${encodeURIComponent(member.unique_code)}/qr`;

  return (
    <section className="print-wrap min-h-screen bg-ink-100/70 px-4 pt-32 pb-16 sm:px-6">
      <style>{PRINT_CSS}</style>

      <div className="no-print mx-auto mb-6 flex max-w-[85mm] flex-wrap items-center justify-between gap-3 sm:justify-start sm:px-1">
        <div>
          <h1 className="font-display text-lg font-bold text-ink-900">Carte de membre</h1>
          <p className="text-xs text-ink-500">Format carte de visite (85 × 55 mm) — prête à imprimer.</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/membre/${encodeURIComponent(code)}`} className="btn-ghost !px-4 !py-2 text-xs">
            ← Fiche membre
          </Link>
          <button type="button" className="btn-primary !px-5 !py-2 text-xs" onClick={() => window.print()}>
            Imprimer la carte
          </button>
        </div>
      </div>

      <div className="mx-auto w-fit">
        <div className="print-card relative w-[85mm] overflow-hidden rounded-[2mm] bg-white shadow-lift ring-1 ring-ink-950/10" style={{ height: '55mm' }}>
          <div className="absolute -top-[14mm] -right-[14mm] h-[40mm] w-[40mm] rounded-full bg-brand-50" />
          <div className="absolute -bottom-[10mm] -left-[8mm] h-[26mm] w-[26mm] rounded-full bg-accent-100/70" />

          <div className="relative flex h-full flex-col px-[5mm] pt-[4mm]">
            <div className="flex items-start justify-between gap-[3mm]">
              <div className="flex min-w-0 items-center gap-[2.5mm]">
                {site.logo ? (
                  <span className="grid h-[9mm] w-[11mm] shrink-0 place-items-center overflow-hidden rounded-[1mm] bg-white ring-1 ring-ink-100">
                    <img src={site.logo} alt={site.site_name || 'ADI ONG'} className="max-h-[7mm] max-w-[10mm] object-contain" />
                  </span>
                ) : (
                  <span className="grid h-[9mm] w-[9mm] shrink-0 place-items-center rounded-[1mm] bg-brand-700 font-display text-[10pt] font-bold text-white">
                    {(site.site_name || 'A').slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-display text-[9pt] leading-tight font-extrabold tracking-wide text-brand-800">
                    {site.site_name || 'ADI ONG'}
                  </p>
                  {site.site_tagline && (
                    <p className="truncate text-[5.5pt] font-medium tracking-wide text-ink-400">
                      {site.site_tagline}
                    </p>
                  )}
                </div>
              </div>
              {member.photo ? (
                <img
                  src={member.photo}
                  alt={member.full_name}
                  className="h-[17mm] w-[17mm] shrink-0 rounded-full object-cover ring-[0.8mm] ring-brand-100"
                />
              ) : (
                <div className="grid h-[17mm] w-[17mm] shrink-0 place-items-center rounded-full bg-brand-100 font-display text-[13pt] font-bold text-brand-700">
                  {(member.full_name || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <div className="mt-[2.5mm] flex min-h-0 flex-1 items-center gap-[3.5mm]">
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-[15pt] leading-tight font-extrabold text-ink-900">
                  {member.full_name}
                </h2>
                {member.job_title && (
                  <p className="mt-[0.5mm] truncate text-[8.5pt] font-bold tracking-wide text-accent-500">
                    {member.job_title}
                  </p>
                )}
                <div className="mt-[2mm] h-[0.3mm] w-[16mm] rounded-full bg-brand-500" />
                <div className="mt-[2.5mm] space-y-[1.2mm] text-[7pt] font-semibold text-ink-600">
                  {member.phone && (
                    <p className="flex items-center gap-[1.5mm] truncate">
                      <IconPhone className="h-[2.4mm] w-[2.4mm] shrink-0 text-brand-600" />
                      {member.phone}
                    </p>
                  )}
                  {member.email && (
                    <p className="flex items-center gap-[1.5mm] truncate">
                      <IconMail className="h-[2.4mm] w-[2.4mm] shrink-0 text-brand-600" />
                      {member.email}
                    </p>
                  )}
                  {site.address && (
                    <p className="flex items-center gap-[1.5mm] truncate">
                      <IconPin className="h-[2.4mm] w-[2.4mm] shrink-0 text-brand-600" />
                      {site.address}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-center">
                <img src={qrSrc} alt={`QR ${member.unique_code}`} className="h-[16mm] w-[16mm]" />
                <p className="mt-[1mm] text-[4.5pt] font-bold tracking-wider text-ink-400">SCANNER</p>
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex h-[7mm] items-center justify-between bg-brand-700 px-[5mm]">
            <p className="truncate text-[5.5pt] font-semibold tracking-wide text-white/85">
              {site.site_tagline || 'Inclusion et accompagnement des personnes en situation de handicap'}
            </p>
            <p className="shrink-0 font-display text-[6.5pt] font-bold tracking-widest text-white">
              {member.unique_code}
            </p>
          </div>
        </div>
        <p className="no-print mt-4 text-center text-xs text-ink-400">
          Astuce : dans la boîte d'impression, activez « Imprimer les fonds » pour les couleurs.
        </p>
      </div>
    </section>
  );
}
