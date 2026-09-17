import React, { useEffect, useMemo, useState } from 'react';
import Reveal from '../components/Reveal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { api, fmtMoney } from '../api.js';
import { useSite } from '../hooks/useSite.jsx';
import { usePageSeo } from '../hooks/useSeo.js';
import { IconCheck, IconHeart, IconPhone, IconGift } from '../components/Icons.jsx';

export default function Shop() {
  const { site } = useSite();
  const [data, setData] = useState(null);
  const [closed, setClosed] = useState(false);
  const [cat, setCat] = useState('');
  const [cart, setCart] = useState({});
  const [checkout, setCheckout] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', payment: 'mobile', note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  usePageSeo({
    title: 'Boutique en ligne',
    description: 'Soutenez ADI ONG en achetant nos articles : les revenus financent nos programmes d’inclusion sociale.',
    path: '/boutique'
  });

  useEffect(() => {
    api.shop()
      .then(setData)
      .catch((e) => {
        if (/fermée|désactivée/i.test(e.message)) setClosed(true);
        else setError(e.message);
      });
    window.scrollTo(0, 0);
  }, []);

  const products = data?.products || [];
  const categories = data?.categories || [];
  const visible = useMemo(
    () => products.filter((p) => !cat || String(p.category_id) === String(cat)),
    [products, cat]
  );

  const qtyOf = (id) => cart[id]?.qty || 0;
  const addToCart = (p) => {
    if (p.stock <= 0) return;
    setCart((cur) => {
      const q = cur[p.id]?.qty || 0;
      if (q >= p.stock) return cur;
      return { ...cur, [p.id]: { product: p, qty: q + 1 } };
    });
  };
  const setQty = (id, qty) => {
    setCart((cur) => {
      const entry = cur[id];
      if (!entry) return cur;
      const max = entry.product.stock;
      const next = Math.min(max, Math.max(0, qty));
      if (next === 0) {
        const { [id]: _drop, ...rest } = cur;
        return rest;
      }
      return { ...cur, [id]: { ...entry, qty: next } };
    });
  };
  const clearCart = () => {
    setCart({});
    setCheckout(false);
    setError('');
  };

  const lines = Object.values(cart);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const total = lines.reduce((a, l) => a + l.product.price * l.qty, 0);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const order = await api.shopOrder({
        customer_name: form.name,
        phone: form.phone,
        payment_method: form.payment,
        note: form.note,
        items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty }))
      });
      setDone(order);
      setCart({});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (closed) {
    return (
      <div className="bg-cream/40">
        <div className="mx-auto max-w-2xl px-4 py-24 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-100 text-3xl">🛍️</span>
          <h1 className="mt-6 font-display text-3xl font-extrabold text-ink-900">Boutique temporairement fermée</h1>
          <p className="mt-3 text-ink-500">
            La boutique en ligne est actuellement indisponible. Revenez bientôt, ou contactez-nous pour connaître
            nos articles et leurs tarifs.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-cream/40">
        <div className="mx-auto max-w-2xl px-4 py-24">
          <div className="card p-10 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl">✅</span>
            <h1 className="mt-6 font-display text-3xl font-extrabold text-ink-900">Commande enregistrée !</h1>
            <p className="mt-3 text-ink-500">
              Merci <strong>{done.customer_name}</strong>. Votre commande <strong className="font-mono">{done.reference}</strong> a bien
              été prise en compte. Notre équipe vous contactera au <strong>{done.phone}</strong> pour confirmer la
              préparation et le paiement.
            </p>
            <div className="mt-6 rounded-2xl bg-cream p-5 text-left text-sm">
              {done.items.map((i, idx) => (
                <div key={idx} className="flex justify-between py-1 text-ink-600">
                  <span>{i.qty} × {i.product_name}</span>
                  <span>{fmtMoney(i.total)}</span>
                </div>
              ))}
              <div className="mt-3 flex justify-between border-t border-ink-100 pt-3 font-display text-base font-extrabold text-ink-900">
                <span>Total</span>
                <span>{fmtMoney(done.total)}</span>
              </div>
              <p className="mt-3 text-xs text-ink-400">
                {done.payment_method === 'mobile' ? 'Paiement attendu par Mobile Money.' : 'Paiement en espèces à la remise des articles.'}
              </p>
            </div>
            <button onClick={() => setDone(null)} className="btn-primary mt-8 !px-8 !py-3 text-sm">
              Retour à la boutique
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream/40">
      <PageHeader
        kicker="Boutique en ligne"
        title="Chaque achat soutient nos programmes"
        text="T-shirts, articles de papeterie et accessoires solidaires : en commandant en ligne, vous financez directement l’inclusion sociale des enfants et des personnes handicapées que nous accompagnons."
      />

      <div className="mx-auto max-w-7xl px-4 py-12">
        <Reveal>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCat('')}
              className={`rounded-full px-5 py-2.5 text-sm font-bold ring-1 transition-all ${
                !cat ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-600 ring-ink-200 hover:ring-brand-300'
              }`}
            >
              Tous les articles
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(String(c.id) === cat ? '' : String(c.id))}
                className={`rounded-full px-5 py-2.5 text-sm font-bold ring-1 transition-all ${
                  String(c.id) === cat ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-600 ring-ink-200 hover:ring-brand-300'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </Reveal>

        {error && (
          <p className="mt-6 rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">{error}</p>
        )}

        {visible.length === 0 && !data && (
          <p className="py-20 text-center text-ink-400">Chargement de la boutique…</p>
        )}
        {visible.length === 0 && data && (
          <p className="rounded-3xl border border-dashed border-ink-200 py-20 text-center text-ink-400">
            Aucun article disponible pour le moment — revenez bientôt.
          </p>
        )}

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p, i) => {
            const q = qtyOf(p.id);
            return (
              <Reveal key={p.id} delay={Math.min(i, 5) * 60}>
                <div className="card group h-full overflow-hidden transition-all hover:-translate-y-1 hover:shadow-soft">
                  <div className="relative h-48 overflow-hidden bg-cream">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="grid h-full place-items-center text-5xl">📦</div>
                    )}
                    <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-brand-700">
                      {fmtMoney(p.price)}
                    </span>
                    {p.stock > 0 && p.stock <= 3 && (
                      <span className="absolute top-3 right-3 rounded-full bg-accent-100 px-3 py-1 text-[11px] font-bold text-accent-800">
                        Plus que {p.stock}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    {p.category && <p className="text-[11px] font-bold tracking-wide text-brand-600 uppercase">{p.category}</p>}
                    <h3 className="mt-1 font-display text-base font-bold text-ink-900">{p.name}</h3>
                    {p.description && <p className="mt-1 line-clamp-2 text-sm text-ink-500">{p.description}</p>}
                    <div className="mt-4">
                      {p.stock <= 0 ? (
                        <button disabled className="btn-ghost w-full !py-2.5 text-sm opacity-50">
                          Rupture de stock
                        </button>
                      ) : q === 0 ? (
                        <button onClick={() => addToCart(p)} className="btn-primary w-full !py-2.5 text-sm">
                          Ajouter au panier
                        </button>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => setQty(p.id, q - 1)}
                            className="grid h-10 w-10 place-items-center rounded-xl bg-cream text-lg font-bold text-ink-700 ring-1 ring-ink-100 hover:bg-ink-100"
                          >
                            −
                          </button>
                          <span className="flex items-center gap-2 text-sm font-bold text-ink-900">
                            <IconCheck className="h-4 w-4 text-emerald-600" /> {q} au panier
                          </span>
                          <button
                            onClick={() => setQty(p.id, q + 1)}
                            disabled={q >= p.stock}
                            className="grid h-10 w-10 place-items-center rounded-xl bg-cream text-lg font-bold text-ink-700 ring-1 ring-ink-100 hover:bg-ink-100 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {count > 0 && (
          <div className="sticky bottom-[5.5rem] mt-10 lg:bottom-4">
            <div className="card mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-600 text-sm font-extrabold text-white">{count}</span>
                <div>
                  <p className="text-sm font-bold text-ink-900">Votre panier</p>
                  <p className="font-display text-lg font-extrabold text-brand-700">{fmtMoney(total)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={clearCart} className="btn-ghost !px-4 !py-2.5 text-sm">
                  Vider
                </button>
                <button onClick={() => setCheckout((v) => !v)} className="btn-primary !px-6 !py-2.5 text-sm">
                  {checkout ? 'Fermer' : 'Commander →'}
                </button>
              </div>
            </div>
            {checkout && (
              <div className="card mx-auto mt-3 max-w-3xl p-6">
                <h3 className="font-display text-lg font-bold text-ink-900">Finaliser ma commande</h3>
                <p className="mt-1 text-sm text-ink-500">
                  Nos articles sont préparés à Goma. Le paiement se fait par Mobile Money ou en espèces à la remise.
                </p>
                <form onSubmit={submit} className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold tracking-wide text-ink-500 uppercase">Nom complet *</label>
                      <input
                        className="input"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Ex. Maman Aïcha"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold tracking-wide text-ink-500 uppercase">Téléphone *</label>
                      <input
                        className="input"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+243 …"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold tracking-wide text-ink-500 uppercase">Paiement</label>
                      <select
                        className="input"
                        value={form.payment}
                        onChange={(e) => setForm({ ...form, payment: e.target.value })}
                      >
                        <option value="mobile">Mobile Money (M-Pesa / Airtel)</option>
                        <option value="especes">Espèces, à la remise des articles</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold tracking-wide text-ink-500 uppercase">Note (optionnel)</label>
                      <input
                        className="input"
                        value={form.note}
                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                        placeholder="Lieu de remise, remarque…"
                      />
                    </div>
                  </div>
                  {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
                    <p className="text-sm text-ink-500">
                      Total : <span className="font-display text-lg font-extrabold text-ink-900">{fmtMoney(total)}</span>
                    </p>
                    <button type="submit" disabled={busy} className="btn-primary !px-8 !py-3 text-sm">
                      {busy ? 'Envoi…' : '✓ Confirmer ma commande'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        <div className="mt-16 grid gap-5 sm:grid-cols-3">
          {[
            { icon: <IconGift className="h-6 w-6" />, title: 'Un achat solidaire', text: 'L’intégralité des ventes alimente nos programmes d’éducation et de réinsertion.' },
            { icon: <IconPhone className="h-6 w-6" />, title: 'Préparation à Goma', text: 'Notre équipe vous appelle pour confirmer la commande et organiser la remise.' },
            { icon: <IconHeart className="h-6 w-6" />, title: 'Merci de soutenir ADI', text: 'Chaque article acheté, c’est une écolière ou un jeune qui reste dans le circuit.' }
          ].map((f) => (
            <div key={f.title} className="card p-6 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">{f.icon}</span>
              <p className="mt-4 font-display font-bold text-ink-900">{f.title}</p>
              <p className="mt-1.5 text-sm text-ink-500">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
