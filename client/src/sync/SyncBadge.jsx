// Badge d'état de synchronisation (en-tête admin)
import React, { useEffect, useState } from 'react';
import { subscribe } from './engine.js';

export function useSyncStatus() {
  const [st, setSt] = useState({ online: true, syncing: false, pending: 0, failed: 0, lastSyncAt: 0 });
  useEffect(() => subscribe(setSt), []);
  return st;
}

export default function SyncBadge() {
  const st = useSyncStatus();
  const pending = st.pending + st.failed;
  const time = st.lastSyncAt ? new Date(st.lastSyncAt * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

  if (!st.online) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800"
        title={pending ? `${pending} modification(s) en attente de synchronisation` : 'Hors ligne — les nouvelles modifications seront synchronisées au retour de la connexion'}
      >
        <span className={`h-1.5 w-1.5 rounded-full bg-amber-500 ${st.syncing ? 'animate-pulse' : ''}`} />
        {st.syncing ? 'Synchronisation…' : `Hors ligne${pending ? ` · ${pending} en attente` : ''}`}
      </span>
    );
  }
  if (pending > 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800"
        title={st.failed ? `${st.failed} élément(s) en échec (voir Réglages → Synchronisation)` : 'Envoi des modifications en attente'}
      >
        <span className={`h-1.5 w-1.5 rounded-full bg-amber-500 ${st.syncing ? 'animate-pulse' : ''}`} />
        {st.syncing ? 'Synchronisation…' : `${pending} en attente${st.failed ? ` (${st.failed} en échec)` : ''}`}
      </span>
    );
  }
  return (
    <span
      className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 md:inline-flex"
      title={time ? `Dernière synchronisation à ${time}` : 'Aucune synchronisation pour le moment'}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${st.syncing ? 'animate-pulse bg-amber-500' : 'bg-emerald-500'}`} />
      {st.syncing ? 'Synchronisation…' : time ? `Synchronisé ${time}` : 'En ligne'}
    </span>
  );
}
