import { useEffect, useState } from 'react';
import { api, getSavedUser } from './api.js';

/** Droit fin du rôle courant. `fallbackRoles` évite un flash avant la réponse API. */
export function usePerm(key, fallbackRoles = ['super_admin']) {
  const role = getSavedUser()?.role;
  const [on, setOn] = useState(role === 'super_admin' || fallbackRoles.includes(role));

  useEffect(() => {
    if (role === 'super_admin') {
      setOn(true);
      return;
    }
    let cancel = false;
    api.permissions.get()
      .then((d) => {
        if (cancel) return;
        const mine = d.matrix.find((r) => r.role === role);
        const hit = mine?.permissions.find((p) => p.area === key);
        if (hit) setOn(!!hit.enabled);
      })
      .catch(() => {});
    return () => { cancel = true; };
  }, [key, role]);

  return on;
}
