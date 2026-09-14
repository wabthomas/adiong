import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export default function PageHeader({ kicker, title, text, image = '/uploads/seed/hero.jpg' }) {
  const reduce = useReducedMotion();
  return (
    <section className="relative flex min-h-[52vh] items-end overflow-hidden pb-14 pt-40">
      <div className="absolute inset-0">
        <img src={image} alt="" className="h-full w-full scale-105 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/80 via-ink-950/55 to-ink-950/85" />
      </div>
      <div className="container-x relative">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="max-w-3xl"
        >
          {kicker && (
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold tracking-wide text-accent-300 uppercase ring-1 ring-white/20 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-300" />
              {kicker}
            </p>
          )}
          <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-[3.4rem]">
            {title}
          </h1>
          {text && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/75">{text}</p>}
        </motion.div>
      </div>
    </section>
  );
}
