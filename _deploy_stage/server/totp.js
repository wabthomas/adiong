// TOTP (RFC 6238) autocontenu — HMAC-SHA1, 6 chiffres, pas de dépendance externe.
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const base32Encode = (buf) => {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
};

export const base32Decode = (str) => {
  const clean = String(str).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
};

export const newTotpSecret = () => base32Encode(randomBytes(20));

const hotp = (key, counter) => {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, '0');
};

export const totpCode = (secret, { period = 30, digits = 6, time = Date.now() / 1000 } = {}) =>
  hotp(base32Decode(secret), Math.floor(time / period));

// Vérifie le code courant et le voisin (tolérance ±30 s).
export const verifyTotp = (secret, code, { period = 30, window = 1, time = Date.now() / 1000 } = {}) => {
  const c = String(code || '').trim().replace(/\D/g, '');
  if (c.length !== 6) return false;
  const counter = Math.floor(time / period);
  for (let i = -window; i <= window; i++) {
    const expected = Buffer.from(hotp(base32Decode(secret), counter + i));
    if (timingSafeEqual(expected, Buffer.from(c))) return true;
  }
  return false;
};

export const otpauthUrl = ({ secret, account, issuer = 'ADI ONG' }) => {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
};

// 10 codes de secours au format ADI-XXXXXX-XXXXXX (hexades), présentés en clair une seule fois.
export const newBackupCodes = (count = 10) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const h = randomBytes(6).toString('hex').toUpperCase();
    codes.push(`ADI-${h.slice(0, 6)}-${h.slice(6, 12)}`);
  }
  return codes;
};
