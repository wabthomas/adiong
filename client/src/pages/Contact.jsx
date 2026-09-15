import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Reveal, { Stagger, staggerItem } from '../components/Reveal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { api } from '../api.js';
import { useSite } from '../hooks/useSite.jsx';
import { usePageSeo } from '../hooks/useSeo.js';
import { IconCheck, IconMail, IconPhone, IconPin, IconWhatsapp } from '../components/Icons.jsx';

export default function Contact() {
  const { site } = useSite();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', website: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const openedAtRef = React.useRef(Date.now());

  usePageSeo({
    title: site.contact_header?.title,
    description: site.contact_header?.text,
    image: site.contact_header?.image
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      await api.contact({ ...form, opened_at: openedAtRef.current });
      setStatus('done');
      setForm({ name: '', email: '', subject: '', message: '', website: '' });
      openedAtRef.current = Date.now();
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader
        kicker={site.contact_header?.kicker || 'Contact'}
        title={site.contact_header?.title || "Parlons de l'inclusion"}
        text={site.contact_header?.text}
        image={site.contact_header?.image || '/uploads/seed/cause-plaidoyer.jpg'}
      />

      <section className="container-x py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <div className="card p-8 sm:p-10">
              <AnimatePresence mode="wait">
                {status === 'done' ? (
                  <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-10 text-center">
                    <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-100 text-brand-600">
                      <IconCheck className="h-10 w-10" />
                    </span>
                    <h2 className="mt-6 font-display text-2xl font-bold text-ink-900">Message envoyé !</h2>
                    <p className="mx-auto mt-3 max-w-md text-ink-500">
                      Merci pour votre message. L'équipe ADI ONG vous répondra dans les plus brefs délais.
                    </p>
                    <button className="btn-primary mt-8" onClick={() => setStatus('idle')}>Envoyer un autre message</button>
                  </motion.div>
                ) : (
                  <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={submit}>
                    <h2 className="font-display text-2xl font-bold text-ink-900">Envoyez-nous un message</h2>
                    <div className="mt-8 grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="label">Nom complet *</label>
                        <input className="input" required value={form.name} onChange={set('name')} placeholder="Votre nom" />
                      </div>
                      <div>
                        <label className="label">Email *</label>
                        <input className="input" type="email" required value={form.email} onChange={set('email')} placeholder="vous@exemple.com" />
                      </div>
                    </div>
                    <div className="mt-5">
                      <label className="label">Sujet</label>
                      <input className="input" value={form.subject} onChange={set('subject')} placeholder="Sujet de votre message" />
                    </div>
                    <div className="mt-5">
                      <label className="label">Message *</label>
                      <textarea className="input min-h-[140px]" required value={form.message} onChange={set('message')} placeholder="Votre message…" />
                    </div>
                    <div className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden" aria-hidden="true">
                      <label>Ne pas remplir ce champ
                        <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
                      </label>
                    </div>
                    {status === 'error' && (
                      <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
                    )}
                    <button type="submit" disabled={status === 'loading'} className="btn-primary mt-8 disabled:opacity-60">
                      {status === 'loading' ? 'Envoi en cours…' : 'Envoyer le message'}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </Reveal>

          <div className="space-y-6">
            <Stagger className="grid gap-5">
              {[
                { Icon: IconPin, title: 'Adresse', lines: [site.address] },
                { Icon: IconPhone, title: 'Téléphone', lines: [site.phone1, site.phone2].filter(Boolean) },
                { Icon: IconMail, title: 'Email', lines: [site.email] }
              ].map((c) => (
                <Reveal key={c.title} {...staggerItem}>
                  <div className="card flex items-start gap-4 p-6">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-100 text-accent-700">
                      <c.Icon className="h-6 w-6" />
                    </span>
                    <div>
                      <h3 className="font-display font-bold text-ink-900">{c.title}</h3>
                      {c.lines.map((l) => (
                        <p key={l} className="mt-1 text-[15px] leading-relaxed text-ink-500">{l}</p>
                      ))}
                    </div>
                  </div>
                </Reveal>
              ))}
            </Stagger>
            <Reveal delay={0.2}>
              <div className="overflow-hidden rounded-3xl shadow-soft ring-1 ring-ink-950/5">
                <iframe
                  title="Localisation ADI ONG — Goma"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=29.24%2C-1.68%2C29.31%2C-1.63&layer=mapnik&marker=-1.6506%2C29.2744"
                  className="h-72 w-full border-0"
                  loading="lazy"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
