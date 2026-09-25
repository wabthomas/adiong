/** Heure de l'organisation : Goma (Afrique centrale, UTC+2, sans heure d'été). */
export const ORG_TZ = 'Africa/Lubumbashi';

export function orgParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ORG_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hm: `${hour}:${p.minute}`
  };
}

export function orgDate(date = new Date()) {
  return orgParts(date).date;
}

/** Horodatage SQLite UTC « YYYY-MM-DD HH:MM:SS » → HH:MM à Goma. */
export function attHm(v) {
  if (!v) return '';
  const raw = String(v).trim();
  const d = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return raw.slice(11, 16);
  return orgParts(d).hm;
}
