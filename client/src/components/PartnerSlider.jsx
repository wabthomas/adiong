import React, { useEffect, useState } from 'react';
import { useSite } from '../hooks/useSite.jsx';

export default function PartnerSlider() {
  const { partners } = useSite();
  if (!partners || partners.length === 0) return null;

  const single = partners.length === 1;
  const items = single ? partners : [...partners, ...partners];
  const duration = Math.max(20, partners.length * 6);

  return (
    <section aria-label="Nos partenaires" className="border-t border-ink-100 bg-white py-8 sm:py-10">
      <div className="container-x">
        <p className="text-center text-[11px] font-bold tracking-[0.25em] text-ink-400 uppercase">
          Ils nous font confiance
        </p>
        {single ? (
          <div className="mt-5 flex justify-center">
            <PartnerLogo p={partners[0]} />
          </div>
        ) : (
          <div
            className="partner-marquee relative mt-5 overflow-hidden"
            style={{ '--partner-duration': `${duration}s` }}
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white to-transparent sm:w-20" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent sm:w-20" />
            <div className="partner-track flex w-max items-center">
              {items.map((p, i) => (
                <div key={`${p.id}-${i}`} className="flex h-16 shrink-0 items-center pr-10 sm:h-[4.5rem] sm:pr-14">
                  <PartnerLogo p={p} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PartnerLogo({ p }) {
  const src = useTrimmedLogo(p.logo);
  const inner = (
    <img
      src={src}
      alt={p.name}
      loading="lazy"
      className="h-14 w-auto max-w-[180px] object-contain object-center transition duration-300 hover:scale-[1.04] sm:h-16 sm:max-w-[220px]"
    />
  );
  return p.link ? (
    <a href={p.link} target="_blank" rel="noopener noreferrer" title={p.name} className="inline-flex items-center">
      {inner}
    </a>
  ) : (
    <span title={p.name} className="inline-flex items-center">{inner}</span>
  );
}

/** Recadre les marges transparentes (logos exportés sur un grand canvas vide). */
function useTrimmedLogo(src) {
  const [out, setOut] = useState(src);
  useEffect(() => {
    let cancelled = false;
    setOut(src);
    if (!src) return undefined;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const trimmed = trimTransparentImage(img);
      if (!cancelled) setOut(trimmed || src);
    };
    img.onerror = () => { if (!cancelled) setOut(src); };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return out;
}

function trimTransparentImage(img) {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  let data;
  try {
    data = ctx.getImageData(0, 0, width, height).data;
  } catch {
    return null;
  }
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return null;
  const pad = Math.max(4, Math.round(Math.min(width, height) * 0.01));
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(width - sx, maxX - minX + 1 + pad * 2);
  const sh = Math.min(height - sy, maxY - minY + 1 + pad * 2);
  if (sw / width > 0.9 && sh / height > 0.9) return null;
  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  out.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return out.toDataURL('image/png');
}
