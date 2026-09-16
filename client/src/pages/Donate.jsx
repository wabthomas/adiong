import React, { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Reveal from '../components/Reveal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { api, fmtMoney } from '../api.js';
import { useSite } from '../hooks/useSite.jsx';
import { usePageSeo } from '../hooks/useSeo.js';
import { IconCheck, IconHeart, IconGift, IconChart, IconUsers, IconPhone, IconSpark, IconClipboard } from '../components/Icons.jsx';

const DEFAULT_AMOUNTS = [10, 25, 50, 100, 250, 500];

const METHODS = [
  { id: 'airtel', label: 'Airtel Money', hint: 'Paiement mobile Airtel' },
  { id: 'mpesa', label: 'M-Pesa', hint: 'Paiement mobile M-Pesa' },
  { id: 'orange', label: 'Orange Money', hint: 'Paiement mobile Orange' },
  { id: 'carte', label: 'Carte / virement', hint: 'Carte bancaire ou virement' }
];

export default function Donate() {
  const { campaigns, site } = useSite();
  const [params, setParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState(50);
  const [custom, setCustom] = useState('');
  const [campaignId, setCampaignId] = useState(params.get('campaignId') || '');
  const [message, setMessage] = useState('');
  const [method, setMethod] = useState('airtel');
  const [anonymous, setAnonymous] = useState(false);
  const [website, setWebsite] = useState('');
  const [step, setStep] = useState('form');
  const [reference, setReference] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [txRef, setTxRef] = useState('');
  const openedAtRef = useRef(Date.now());

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
  const methodLabel = METHODS.find((m) => m.id === method)?.label || '';
  const payNumber =
    method === 'airtel' ? site.pay_airtel : method === 'mpesa' ? site.pay_mpesa : method === 'orange' ? site.pay_orange : '';
  const payCard = method === 'carte' ? site.pay_card : '';

  const reset = () => {
    setStep('form');
    setName('');
    setEmail('');
    setMessage('');
    setCustom('');
    setAmount(50);
    setCampaignId('');
    setMethod('airtel');
    setAnonymous(false);
    setReference('');
    setProofFile(null);
    setTxRef('');
    setWebsite('');
    setStatus('idle');
    setError('');
    setParams({});
    openedAtRef.current = Date.now();
  };

  const submit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const res = await api.donate({
        name: anonymous ? '' : name,
        email,
        amount: effective,
        message,
        campaignId: campaignId || null,
        method,
        anonymous,
        website,
        opened_at: openedAtRef.current
      });
      if (!res?.reference) throw new Error('Réponse inattendue du serveur');
      setReference(res.reference);
      setWebsite('');
      openedAtRef.current = Date.now();
      setStatus('idle');
      setStep('pay');
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  };

  const submitProof = async () => {
    if (!proofFile) {
      setError('Ajoutez une capture de votre preuve de paiement.');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const fd = new FormData();
      fd.append('reference', reference);
      fd.append('tx_ref', txRef);
      fd.append('file', proofFile);
      await api.donationsProof(fd);
      setStep('done');
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  };

  const StepDot = ({ n, label, active, done }) => (
    <li className="flex items-center gap-2.5">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
        done ? 'bg-brand-600 text-white' : active ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-600' : 'bg-ink-50 text-ink-400'
      }`}>
        {done ? <IconCheck className="h-4 w-4" /> : n}
      </span>
      <span className={`text-sm font-semibold ${active || done ? 'text-ink-900' : 'text-ink-400'}`}>{label}</span>
    </li>
  );

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
            <ul className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <StepDot n={1} label="Votre don" active={step === 'form'} done={step !== 'form'} />
              <StepDot n={2} label="Paiement" active={step === 'pay'} done={step === 'proof' || step === 'done'} />
              <StepDot n={3} label="Preuve" active={step === 'proof'} done={step === 'done'} />
            </ul>

            <AnimatePresence mode="wait">
              {step === 'done' ? (
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
                    Merci ! Votre don de {fmtMoney(effective)} {site.currency || ''} a bien été enregistré.
                  </h2>
                  <p className="mx-auto mt-3 max-w-lg leading-relaxed text-ink-500">
                    Votre preuve de paiement a bien été transmise. Notre équipe vérifiera le don sous 24 à 48h et
                    vous recontactera pour confirmer et vous remercier officiellement.
                  </p>
                  <p className="mt-5 rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
                    Référence du don : <strong className="font-mono">{reference}</strong> — conservez-la pour toute question.
                  </p>
                  <button className="btn-primary mt-8" onClick={reset}>Faire un autre don</button>
                </motion.div>
              ) : step === 'pay' ? (
                <motion.div
                  key="pay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="card p-8 sm:p-10"
                >
                  <div className="flex items-start gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-100 text-accent-600">
                      <IconSpark className="h-6 w-6" />
                    </span>
                    <div>
                      <h2 className="font-display text-2xl font-bold text-ink-900">Effectuez votre paiement</h2>
                      <p className="mt-1 text-[15px] text-ink-500">
                        {methodLabel} — {fmtMoney(effective)} {site.currency || ''}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl bg-brand-700 p-6 text-center text-white">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Référence du don</p>
                    <p className="mt-1 font-mono text-3xl font-bold tracking-wide">{reference}</p>
                    <p className="mt-2 text-sm text-white/80">Précisez cette référence lors du paiement (libellé / note de transaction).</p>
                  </div>

                  <div className="mt-6 grid gap-6 sm:grid-cols-2">
                    <div className="space-y-4">
                      {(payNumber || payCard) && (
                        <div className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-ink-50/60 p-4">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
                            <IconPhone className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{method === 'carte' ? 'Coordonnées de paiement' : 'Numéro à payer'}</p>
                            <p className="whitespace-pre-line text-lg font-bold text-ink-900">{method === 'carte' ? payCard : payNumber}</p>
                          </div>
                        </div>
                      )}
                      {site.pay_note && (
                        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
                          {site.pay_note}
                        </p>
                      )}
                      <p className="text-sm leading-relaxed text-ink-500">
                        Après le paiement, conservez votre reçu : vous pourrez l’envoyer en capture d’écran à l’étape suivante.
                      </p>
                    </div>
                    <div className="grid place-items-center rounded-2xl border border-ink-100 bg-white p-5">
                      <img
                        src={`/api/public/donations/qr?ref=${encodeURIComponent(reference)}`}
                        alt={`QR code de paiement pour le don ${reference}`}
                        className="h-52 w-52 rounded-xl"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <p className="mt-3 text-center text-xs text-ink-400">QR code récapitulatif (référence, moyen, montant)</p>
                    </div>
                  </div>

                  {status === 'error' && (
                    <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
                  )}

                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    <button className="btn-accent" onClick={() => setStep('proof')}>
                      <IconCheck className="h-5 w-5" /> J'ai payé — envoyer ma preuve
                    </button>
                    <button className="btn-ghost" onClick={() => setStep('done')}>
                      Payer plus tard
                    </button>
                  </div>
                  <p className="mt-4 text-center text-xs leading-relaxed text-ink-400">
                    « Payer plus tard » clôture l'enregistrement : votre don reste tracé avec sa référence, le paiement pourra
                    être effectué et signalé ultérieurement.
                  </p>
                </motion.div>
              ) : step === 'proof' ? (
                <motion.div
                  key="proof"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="card p-8 sm:p-10"
                >
                  <div className="flex items-start gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                      <IconClipboard className="h-6 w-6" />
                    </span>
                    <div>
                      <h2 className="font-display text-2xl font-bold text-ink-900">Envoyez votre preuve de paiement</h2>
                      <p className="mt-1 text-[15px] text-ink-500">
                        Référence <strong className="font-mono">{reference}</strong> — {methodLabel} — {fmtMoney(effective)} {site.currency || ''}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 space-y-5">
                    <div>
                      <label className="label">Capture du reçu / SMS de confirmation *</label>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="input cursor-pointer file:mr-4 file:rounded-xl file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
                        value={proofFile ? proofFile.name : ''}
                        onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                      />
                      {proofFile && (
                        <p className="mt-2 text-xs text-ink-400">Fichier sélectionné : {proofFile.name}</p>
                      )}
                    </div>
                    <div>
                      <label className="label">N° de transaction (optionnel)</label>
                      <input
                        className="input"
                        value={txRef}
                        onChange={(e) => setTxRef(e.target.value)}
                        placeholder="Ex. 2409170012345 — visible sur votre SMS de confirmation"
                      />
                    </div>
                  </div>

                  {status === 'error' && (
                    <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
                  )}

                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    <button
                      className="btn-accent disabled:opacity-60"
                      disabled={status === 'loading' || !proofFile}
                      onClick={submitProof}
                    >
                      <IconCheck className="h-5 w-5" />
                      {status === 'loading' ? 'Envoi en cours…' : 'Envoyer ma preuve'}
                    </button>
                    <button className="btn-ghost" onClick={() => setStep('pay')}>Retour au paiement</button>
                  </div>
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
                    <label className="label">Montant du don ({site.currency || 'USD'})</label>
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

                  <div className="mt-6">
                    <label className="label">Mode de paiement</label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {METHODS.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => setMethod(m.id)}
                          className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                            method === m.id
                              ? 'border-brand-600 bg-brand-50'
                              : 'border-ink-100 bg-white hover:border-brand-200'
                          }`}
                        >
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                            method === m.id ? 'border-brand-600 bg-brand-600' : 'border-ink-200'
                          }`}>
                            {method === m.id && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          <span>
                            <span className="block text-sm font-bold text-ink-900">{m.label}</span>
                            <span className="block text-xs text-ink-400">{m.hint}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    {(method === 'carte' ? payCard : payNumber) && (
                      <p className="mt-2 text-xs text-ink-400">
                        {method === 'carte' ? 'Carte / virement' : methodLabel} : <strong className="text-ink-600">{method === 'carte' ? payCard.split('\n')[0] : payNumber}</strong> — détails complets à l'étape suivante.
                      </p>
                    )}
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
                      <label className="label">Votre nom {anonymous ? '(don anonyme)' : '*'}</label>
                      <input
                        className="input"
                        required={!anonymous}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={anonymous ? 'Donateur anonyme' : 'Prénom et nom'}
                        disabled={anonymous}
                        readOnly={anonymous}
                      />
                    </div>
                  </div>

                  <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl bg-ink-50/60 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={anonymous}
                      onChange={(e) => setAnonymous(e.target.checked)}
                    />
                    <span className="text-sm font-medium text-ink-600">
                      Faire un don anonyme (mon nom n'apparaîtra nulle part)
                    </span>
                  </label>

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
                    Votre don est enregistré immédiatement avec une référence unique, puis vous réglez par {methodLabel || 'Mobile Money'}
                    {' '}et envoyez votre preuve.
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
