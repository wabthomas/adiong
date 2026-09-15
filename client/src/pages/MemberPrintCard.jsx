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
  .print-card { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); box-shadow: none !important; margin: 0 !important; }
  .print-card--recto { top: 25%; }
  .print-card--verso { top: 75%; }
  .print-hidden { display: none !important; }
  .no-print { display: none !important; }
}
.print-card { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
`;

const MODES = [
  { id: 'both', label: 'Recto + verso' },
  { id: 'recto', label: 'Recto seul' },
  { id: 'verso', label: 'Verso seul' }
];

export default function MemberPrintCard() {
  const { code } = useParams();
  const { site } = useSite();
  const [member, setMember] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('both');

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
  const rectoCls = mode === 'both' ? 'print-card print-card--recto' : mode === 'recto' ? 'print-card' : 'print-card print-hidden';
  const versoCls = mode === 'both' ? 'print-card print-card--verso' : mode === 'verso' ? 'print-card' : 'print-card print-hidden';

  return (
    <section className="print-wrap min-h-screen bg-ink-100/70 px-4 pt-32 pb-16 sm:px-6">
      <style>{PRINT_CSS}</style>

      <div className="no-print mx-auto mb-6 flex max-w-3xl flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-ink-900">Carte de membre</h1>
          <p className="text-xs text-ink-500">Format carte de visite (85 × 55 mm) — recto et verso, prêts à imprimer.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-white p-1 ring-1 ring-ink-200">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mode === m.id ? 'bg-brand-700 text-white' : 'text-ink-500 hover:text-brand-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <Link to={`/membre/${encodeURIComponent(code)}`} className="btn-ghost !px-4 !py-2 text-xs">
            ← Fiche membre
          </Link>
          <button type="button" className="btn-primary !px-5 !py-2 text-xs" onClick={() => window.print()}>
            Imprimer la carte
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-3xl flex-wrap items-start justify-center gap-x-10 gap-y-8">
        <div className="flex flex-col items-center">
          <p className="no-print mb-2 text-[11px] font-bold tracking-wider text-ink-400 uppercase">Recto</p>
          <div className={`relative flex overflow-hidden rounded-[2mm] bg-white shadow-lift ring-1 ring-ink-950/10 ${rectoCls}`} style={{ width: '85mm', height: '55mm' }}>
            <div className="pointer-events-none absolute -top-[16mm] -right-[16mm] h-[36mm] w-[36mm] rounded-full bg-brand-50" />
            <div className="pointer-events-none absolute -bottom-[8mm] -left-[12mm] h-[16mm] w-[16mm] rounded-full bg-accent-100/40" />

            <div className="relative flex h-full w-full flex-col">
              <div className="relative flex min-h-0 flex-1 flex-col px-[5mm] pt-[3.5mm] pb-[1.5mm]">
                <div className="flex items-start justify-between gap-[3mm]">
                  <div className="flex min-w-0 items-center gap-[2.5mm] pt-[1.5mm]">
                    {site.logo ? (
                      <span className="grid h-[9mm] w-[11mm] shrink-0 place-items-center overflow-hidden rounded-[1mm] bg-white ring-1 ring-ink-100">
                        <img src={site.logo} alt={site.site_name || 'ADI ONG'} className="max-h-[7mm] max-w-[10mm] object-contain" />
                      </span>
                    ) : (
                      <span className="grid h-[9mm] w-[9mm] shrink-0 place-items-center rounded-[1mm] bg-brand-700 font-display text-[10pt] font-bold text-white">
                        {(site.site_name || 'A').slice(0, 1)}
                      </span>
                    )}
                    <p className="min-w-0 truncate font-display text-[9pt] leading-tight font-extrabold tracking-wide text-brand-800">
                      {site.site_name || 'ADI ONG'}
                    </p>
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

                <div className="-mt-[6mm] flex min-h-0 flex-1 items-end justify-between gap-[3mm]">
                  <div className="min-w-0 flex-1 pr-[2mm]">
                    <h2 className="max-w-[48mm] font-display text-[14pt] leading-tight font-extrabold text-ink-900">
                      {member.full_name}
                    </h2>
                    {member.job_title && (
                      <p className="mt-[0.4mm] text-[8pt] font-bold tracking-wide text-accent-500">
                        {member.job_title}
                      </p>
                    )}
                    <div className="mt-[1.6mm] h-[0.3mm] w-[16mm] rounded-full bg-brand-500" />
                    <div className="mt-[1.8mm] space-y-[1mm] text-[6.8pt] leading-snug font-semibold text-ink-700">
                      {member.phone && (
                        <p className="flex items-center gap-[1.5mm]">
                          <IconPhone className="h-[2.4mm] w-[2.4mm] shrink-0 text-brand-600" />
                          <span className="min-w-0 truncate">{member.phone}</span>
                        </p>
                      )}
                      {member.email && (
                        <p className="flex items-center gap-[1.5mm]">
                          <IconMail className="h-[2.4mm] w-[2.4mm] shrink-0 text-brand-600" />
                          <span className="min-w-0 truncate">{member.email}</span>
                        </p>
                      )}
                      {site.address && (
                        <p className="flex items-start gap-[1.5mm]">
                          <IconPin className="mt-[0.3mm] h-[2.4mm] w-[2.4mm] shrink-0 text-brand-600" />
                          <span className="min-w-0 line-clamp-2">{site.address}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mb-[0.4mm] shrink-0">
                    <img src={qrSrc} alt={`QR ${member.unique_code}`} className="h-[15mm] w-[15mm]" />
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex h-[6mm] shrink-0 items-center justify-between gap-[3mm] bg-brand-700 px-[4.5mm]">
                <p className="text-[5.5pt] font-semibold tracking-wide text-white/80">Carte de membre</p>
                <p className="font-display text-[7pt] font-bold tracking-widest text-white">
                  {member.unique_code}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <p className="no-print mb-2 text-[11px] font-bold tracking-wider text-ink-400 uppercase">Verso</p>
          <div className={`relative flex overflow-hidden rounded-[2mm] bg-brand-700 shadow-lift ring-1 ring-ink-950/10 ${versoCls}`} style={{ width: '85mm', height: '55mm' }}>
            <div className="pointer-events-none absolute -top-[16mm] -right-[12mm] h-[44mm] w-[44mm] rounded-full bg-accent-400/25" />
            <div className="pointer-events-none absolute -bottom-[8mm] -left-[10mm] h-[24mm] w-[24mm] rounded-full bg-white/10" />
            <div className="pointer-events-none absolute top-[10mm] left-[6mm] h-[3mm] w-[3mm] rounded-full bg-accent-400/60" />

            <div className="relative flex h-full w-full flex-col">
              <div className="relative flex min-h-0 flex-1 flex-col items-center px-[5mm] pt-[3mm] pb-[1.5mm] text-center">
                {site.logo ? (
                  <span className="grid h-[8mm] w-[10mm] place-items-center overflow-hidden rounded-[1mm] bg-white">
                    <img src={site.logo} alt="" className="max-h-[6mm] max-w-[8.5mm] object-contain" />
                  </span>
                ) : (
                  <span className="grid h-[8mm] w-[8mm] place-items-center rounded-[1mm] bg-white font-display text-[9pt] font-bold text-brand-700">
                    {(site.site_name || 'A').slice(0, 1)}
                  </span>
                )}
                <p className="mt-[1.4mm] text-[5pt] font-bold tracking-[0.3em] text-white/60">CARTE DE MEMBRE</p>
                <h2 className="mt-[0.6mm] max-w-full truncate font-display text-[11pt] leading-tight font-extrabold text-white">
                  {site.site_name || 'ADI ONG'}
                </h2>

                <div className="my-[1.6mm] h-[0.3mm] w-[14mm] rounded-full bg-accent-400" />

                <p className="max-w-full truncate font-display text-[10pt] font-bold text-white">{member.full_name}</p>
                {member.job_title && (
                  <p className="mt-[0.3mm] max-w-full truncate text-[6.5pt] font-semibold tracking-wide text-accent-300">
                    {member.job_title}
                  </p>
                )}

                <div className="mt-auto flex w-full items-center gap-[3mm] pt-[2mm]">
                  <span className="grid h-[15mm] w-[15mm] shrink-0 place-items-center rounded-[1.5mm] bg-white p-[1.2mm]">
                    <img src={qrSrc} alt={`QR ${member.unique_code}`} className="h-full w-full" />
                  </span>
                  <div className="min-w-0 space-y-[1mm] text-left text-[6pt] font-semibold text-white/90">
                    {member.phone && (
                      <p className="flex items-center gap-[1.5mm]">
                        <IconPhone className="h-[2.2mm] w-[2.2mm] shrink-0 text-accent-300" />
                        <span className="min-w-0 truncate">{member.phone}</span>
                      </p>
                    )}
                    {member.email && (
                      <p className="flex items-center gap-[1.5mm]">
                        <IconMail className="h-[2.2mm] w-[2.2mm] shrink-0 text-accent-300" />
                        <span className="min-w-0 truncate">{member.email}</span>
                      </p>
                    )}
                    {site.address && (
                      <p className="flex items-start gap-[1.5mm]">
                        <IconPin className="mt-[0.2mm] h-[2.2mm] w-[2.2mm] shrink-0 text-accent-300" />
                        <span className="min-w-0 line-clamp-2">{site.address}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex h-[6mm] shrink-0 items-center justify-between gap-[3mm] bg-brand-900 px-[4.5mm]">
                <p className="text-[5.5pt] font-semibold tracking-wide text-white/80">Carte de membre</p>
                <p className="font-display text-[6.5pt] font-bold tracking-widest text-accent-300">
                  {member.unique_code}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="no-print mx-auto mt-6 max-w-3xl text-center text-xs text-ink-400">
        Astuce : pour imprimer les deux faces, choisissez « Recto + verso » puis, dans la boîte d'impression,
        activez l'impression recto/verso avec retournement sur le bord long — et les fonds de couleurs.
      </p>
    </section>
  );
}
