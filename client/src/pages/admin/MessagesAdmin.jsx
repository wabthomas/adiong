import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../api.js';
import { PageTitle, DeleteButton } from './AdminUI.jsx';
import { IconMail } from '../../components/Icons.jsx';

export default function MessagesAdmin() {
  const [items, setItems] = useState([]);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => api.adminMessages.list().then(setItems).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (m) => {
    const next = openId === m.id ? null : m.id;
    setOpenId(next);
    if (next && !m.read) {
      await api.adminMessages.markRead(m.id);
      load();
    }
  };

  const remove = async (m) => {
    if (!confirm('Supprimer ce message ?')) return;
    await api.adminMessages.remove(m.id);
    load();
  };

  return (
    <div>
      <PageTitle
        title="Messages"
        subtitle={`${items.filter((m) => !m.read).length} message(s) non lu(s)`}
      />

      <div className="space-y-4">
        {items.map((m) => (
          <motion.div
            key={m.id}
            layout
            className={`card cursor-pointer transition-shadow hover:shadow-lift ${m.read ? '' : 'ring-2 ring-accent-300'}`}
            onClick={() => toggle(m)}
          >
            <div className="flex items-start justify-between gap-4 p-6">
              <div className="flex items-start gap-4">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${m.read ? 'bg-ink-50 text-ink-400' : 'bg-accent-100 text-accent-700'}`}>
                  <IconMail className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="font-display font-bold text-ink-900">{m.name}</p>
                    <a
                      href={`mailto:${m.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      {m.email}
                    </a>
                    {!m.read && <span className="rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-bold text-ink-950">NOUVEAU</span>}
                  </div>
                  {m.subject && <p className="mt-0.5 text-sm font-semibold text-ink-600">{m.subject}</p>}
                  <p className={`mt-1.5 text-sm leading-relaxed text-ink-500 ${openId === m.id ? '' : 'line-clamp-1'}`}>
                    {m.message}
                  </p>
                  <p className="mt-2 text-xs text-ink-300">
                    {new Date(m.created_at + 'Z').toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2" onClick={(e) => e.stopPropagation()}>
                <a
                  href={`mailto:${m.email}?subject=Re: ${m.subject || ''}`}
                  className="btn-ghost !px-4 !py-2 text-xs"
                >
                  Répondre
                </a>
                <DeleteButton onConfirm={() => remove(m)} />
              </div>
            </div>
          </motion.div>
        ))}
        {items.length === 0 && (
          <div className="card p-14 text-center text-ink-400">Aucun message reçu pour le moment.</div>
        )}
      </div>
    </div>
  );
}
