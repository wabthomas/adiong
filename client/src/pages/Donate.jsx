import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Reveal from '../components/Reveal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { api, fmtMoney } from '../api.js';
import { useSite } from '../hooks/useSite.jsx';
import { usePageSeo } from '../hooks/useSeo.js';
import { IconCheck, IconHeart, IconGift, IconChart, IconUsers } from '../components/Icons.jsx';

const DEFAULT_AMOUNTS = [10, 25, 50, 100, 250, 500];

export default function Donate() {
  const { campaigns, site } = useSite();
  const [params, setParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState(50);
  const [custom, setCustom] = useState('');
  const [campaignId, setCampaignId] = useState(params.get('campaignId') || '');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const openedAtRef = React.useRef(Date.now());

  usePageSeo({
    title: site.donate_header?.title,
    description: site.donate_header?.text,
    image: site.donate_header?.image
  });

  const effective = custom ? Number(custom) || 0 : amount;
  const campaign = useMemo(() => campaigns.find((c) => c.id === campaignId), [campaigns, campaignId]);
  const amounts = Array.isArray(site.donate_amounts) && site.donate_amounts.length
    ? site.donate_amounts.map(Number).filter((n) => n > 0)
    : DEFAULT_AMOUNTS;
  const whyPoints = Array.isArray(site.donate_why_points) && site.donate_why_points.length
    ? site.donate_why_points
    : [
        '100% du don est affecté aux programmes d’inclusion.',
        'Transparence : rapports d’activité partagés.',
        'Impact local et direct à Goma et ses environs.'
      ];

  const submit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      await api.donate({
        name,
        email,
        amount: effective,
        message,
        campaignId: campaignId || null,
        website,
        opened_at: openedAtRef.current
      });
      setStatus('done');
      setWebsite('');
      openedAtRef.current = Date.now();
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader
        kicker={site.donate_header?.kicker || 'Faire un don'}
        title={site.donate_header?.title || 'Chaque soutien compte'}
        text={site.donate_header?.text}
        image={site.donate_header?.image || '/uploads/seed/campaign-scolarite.jpg'}
      />

      <section className="container-x py-20">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <AnimatePresence mode="wait">
              {status === 'done' ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="card p-10 text-center"
                >
                  <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-100 text-brand-600">
                    <IconCheck className="h-10 w-10" />
                  </span>
                  <h2 className="mt-6 font-display text-2xl font-bold text-ink-900">
                    Merci {name.split(' ')[0]} ! Votre don de {fmtMoney(effective)} a bien été enregistré.
                  </h2>
                  <p className="mx-auto mt-3 max-w-md leading-relaxed text-ink-500">
                    L'équipe ADI ONG vous recontactera très prochainement pour confirmer votre don et vous remercier
                    officiellement.
                  </p>
                  <button
                    className="btn-primary mt-8"
                    onClick={() => {
                      setStatus('idle');
                      setName('');
                      setEmail('');
                      setMessage('');
                      setCustom('');
                      setAmount(50);
                      setCampaignId('');
                      setParams({});
                    }}
                  >
                    Faire un autre don
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={submit}
                  className="card p-8 sm:p-10"
                >
                  <h2 className="font-display text-2xl font-bold text-ink-900">Je fais un don</h2>
                  <p className="mt-2 text-[15px] text-ink-500">
                    {campaign ? `Vous donnez à la campagne « ${campaign.title} ».` : 'Don en soutien à la cause générale.'}
                  </p>

                  <div className="mt-8">
                    <label className="label">Montant du don (USD)</label>
                    <div className="grid grid-cols-3 gap-3">
                      {amounts.map((a) => (
                        <button
                          type="button"
                          key={a}
                          onClick={() => {
                            setAmount(a);
                            setCustom('');
                          }}
                          className={`rounded-xl px-4 py-3.5 font-bold transition-all ${
                            !custom && amount === a
                              ? 'bg-brand-600 text-white shadow-soft'
                              : 'bg-ink-50 text-ink-700 hover:bg-brand-50 hover:text-brand-700'
                          }`}
                        >
                          {a} $
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min="1"
                      className="input mt-3"
                      placeholder="Ou saisissez un montant personnalisé"
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                    />
                  </div>

                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="label">Campagne (optionnel)</label>
                      <select
                        className="input"
                        value={campaignId}
                        onChange={(e) => setCampaignId(e.target.value)}
                      >
                        <option value="">Cause générale ADI ONG</option>
                        {campaigns.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Votre nom *</label>
                      <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom et nom" />
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="label">Email (pour votre reçu)</label>
                    <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
                  </div>

                  <div className="mt-5">
                    <label className="label">Message (optionnel)</label>
                    <textarea className="input min-h-[90px]" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Un mot pour l'équipe ADI…" />
                  </div>

                  <div className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden" aria-hidden="true">
                    <label>Ne pas remplir ce champ
                      <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                    </label>
                  </div>

                  {status === 'error' && (
                    <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
                  )}

                  <button type="submit" disabled={status === 'loading' || effective <= 0} className="btn-accent mt-8 w-full disabled:opacity-60">
                    <IconHeart className="h-5 w-5" />
                    {status === 'loading' ? 'Enregistrement…' : `Donner ${fmtMoney(effective)} — je fais la différence`}
                  </button>
                  <p className="mt-4 text-center text-xs leading-relaxed text-ink-400">
                    Paiement à finaliser par l'équipe ADI (Mobile Money / virement). Nous vous contactons pour
                    confirmer.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </Reveal>

          <Reveal x={40} y={0} className="space-y-6">
            <div className="rounded-3xl bg-brand-700 p-8 text-white">
              <IconGift className="h-9 w-9 text-accent-300" />
              <h3 className="mt-4 font-display text-xl font-bold">{site.donate_why_title || 'Pourquoi donner à ADI ONG ?'}</h3>
              <ul className="mt-4 space-y-3 text-[15px] text-white/80">
                {whyPoints.map((p) => (
                  <li key={p} className="flex gap-3"><IconCheck className="mt-1 h-4 w-4 shrink-0 text-accent-300" /> {p}</li>
                ))}
              </ul>
            </div>
            <div className="card p-8">
              <h3 className="font-display font-bold text-ink-900">Autres moyens de soutenir</h3>
              <ul className="mt-4 space-y-4 text-[15px] text-ink-600">
                <li className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700"><IconUsers className="h-5 w-5" /></span>
                  Devenir volontaire
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700"><IconChart className="h-5 w-5" /></span>
                  Devenir partenaire (entreprise / institution)
                </li>
              </ul>
              <a href={`mailto:${site.email}`} className="btn-ghost mt-6 w-full">
                Parler à l'équipe
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
