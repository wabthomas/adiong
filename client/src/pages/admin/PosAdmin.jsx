import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getSavedUser } from '../../api.js';
import { useSite } from '../../hooks/useSite.jsx';
import { PageTitle, Field, Modal, ImageInput } from './AdminUI.jsx';

const TABS = [
  ['caisse', 'Caisse'],
  ['ventes', 'Ventes'],
  ['stock', 'Stock'],
  ['mouvements', 'Mouvements'],
  ['stats', 'Statistiques']
];

const PAY_METHODS = {
  especes: 'Espèces',
  mobile: 'Mobile Money',
  carte: 'Carte bancaire',
  virement: 'Virement',
  autre: 'Autre'
};
const SALE_STATUS = {
  vendue: 'Vendue',
  partielle: 'Retour partiel',
  retournee: 'Retournée'
};
const SALE_STATUS_STYLES = {
  vendue: 'bg-brand-100 text-brand-700',
  partielle: 'bg-accent-100 text-accent-800',
  retournee: 'bg-red-100 text-red-700'
};
const MOVE_TYPES = {
  entree: 'Entrée',
  sortie: 'Sortie',
  ajustement: 'Ajustement'
};
const MOVE_STYLES = {
  entree: 'bg-emerald-100 text-emerald-700',
  sortie: 'bg-red-100 text-red-700',
  ajustement: 'bg-accent-100 text-accent-800'
};

const fmtMoney = (n, cur = 'USD') =>
  `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0)} ${cur}`;
const fmtDateTime = (d) => {
  if (!d) return '—';
  const s = String(d).includes('T') ? String(d) : String(d).replace(' ', 'T') + 'Z';
  const dt = new Date(s);
  if (isNaN(dt)) return String(d);
  return (
    dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' +
    dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  );
};

const stockBadge = (p) => {
  if (p.stock <= 0) return <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">Rupture</span>;
  if (p.min_stock > 0 && p.stock <= p.min_stock)
    return <span className="rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-bold text-accent-800">Stock bas</span>;
  return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">{p.stock} en stock</span>;
};

const PRINT_RECEIPT_CSS = `
@page { size: A4; margin: 10mm; }
@media print {
  body * { visibility: hidden; }
  .print-receipt, .print-receipt *, .print-report, .print-report * { visibility: visible; }
  .print-receipt, .print-report { position: fixed; top: 0; left: 50%; transform: translateX(-50%); box-shadow: none !important; margin: 0 !important; }
  .no-print { display: none !important; }
}
.print-receipt, .print-report { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
`;

const fmtDateLong = (d) => {
  if (!d) return '';
  const dt = new Date(String(d).slice(0, 10) + 'T00:00:00Z');
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

function ReportSheet({ rep, site }) {
  const kpis = [
    { label: 'Ventes', value: rep.n },
    { label: 'Encaissé', value: fmtMoney(rep.gross) },
    { label: 'Net du jour', value: fmtMoney(rep.net) }
  ];
  return (
    <div className="print-report mx-auto w-full max-w-[660px] rounded-xl bg-white p-8 text-[13px] text-ink-900 ring-1 ring-ink-950/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-2xl font-extrabold text-brand-700">RAPPORT DE CAISSE</p>
          <p className="mt-1 capitalize text-ink-500">{fmtDateLong(rep.date)}</p>
        </div>
        <div className="text-right text-xs text-ink-500">
          <p className="font-display text-sm font-extrabold text-ink-900">{site.site_name || 'ADI ONG'}</p>
          {site.address && <p className="mt-0.5">{site.address}</p>}
          {site.phone1 && <p>{site.phone1}</p>}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl bg-cream p-4 text-center">
            <p className="font-display text-xl font-extrabold text-brand-700">{k.value}</p>
            <p className="text-[11px] font-bold tracking-wide text-ink-400 uppercase">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <p className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Paiements du jour</p>
        <div className="divide-y divide-ink-50 rounded-xl ring-1 ring-ink-100">
          {Object.entries(PAY_METHODS).filter(([m]) => rep.byPayment[m]).map(([m, v]) => (
            <div key={m} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-ink-700">{m === 'especes' ? '💵 ' : m === 'mobile' ? '📱 ' : m === 'carte' ? '💳 ' : m === 'virement' ? '🏦 ' : '🧾 '}{PAY_METHODS[m]}</span>
              <span className="text-ink-500">{v.n} vente(s) — <strong className="text-ink-800">{fmtMoney(v.total)}</strong></span>
            </div>
          ))}
          {rep.n === 0 && <p className="px-4 py-3 text-ink-400">Aucune vente enregistrée ce jour-là.</p>}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <p className="flex justify-between"><span className="text-ink-500">Total avant réduction</span><strong>{fmtMoney(rep.subGross)}</strong></p>
        <p className="flex justify-between"><span className="text-ink-500">Réductions accordées</span><strong>- {fmtMoney(rep.discounts)}</strong></p>
        <p className="flex justify-between"><span className="text-ink-500">Retours enregistrés</span><strong className="text-red-600">- {fmtMoney(rep.returnsTotal)}</strong></p>
        <p className="flex justify-between"><span className="text-ink-500">Ventes annulées</span><strong>{rep.voidCount}</strong></p>
        <p className="flex justify-between"><span className="text-ink-500">Panier moyen</span><strong>{fmtMoney(rep.avg)}</strong></p>
      </div>

      {rep.topProducts.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Meilleures ventes du jour</p>
          <ul className="divide-y divide-ink-50 rounded-xl ring-1 ring-ink-100">
            {rep.topProducts.map((p, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-ink-700">{i + 1}. {p.name}</span>
                <span className="text-ink-500">{p.qty} unité(s) — <strong className="text-ink-800">{fmtMoney(p.total)}</strong></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-6 text-center text-[11px] text-ink-400">
        Rapport généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — ADI ONG
      </p>
    </div>
  );
}

function ReceiptSheet({ sale, site }) {
  return (
    <div className="print-receipt mx-auto w-full max-w-[340px] rounded-xl bg-white p-6 font-mono text-[12px] leading-relaxed text-ink-900 ring-1 ring-ink-950/10">
      <div className="text-center">
        <p className="font-display text-base font-extrabold tracking-wide">{(site.site_name || 'ADI ONG').toUpperCase()}</p>
        {site.site_tagline && <p className="mt-0.5 text-[10px] text-ink-400">{site.site_tagline}</p>}
        {site.address && <p className="mt-1 text-[10px] text-ink-400">{site.address}</p>}
        {site.phone1 && <p className="text-[10px] text-ink-400">{site.phone1}</p>}
      </div>
      <div className="my-3 border-t border-dashed border-ink-300" />
      <div className="flex justify-between"><span>Ticket</span><span className="font-bold">{sale.number}</span></div>
      <div className="flex justify-between"><span>Date</span><span>{fmtDateTime(sale.created_at)}</span></div>
      {sale.cashier_name && <div className="flex justify-between"><span>Caissier</span><span>{sale.cashier_name}</span></div>}
      {sale.customer_name && <div className="flex justify-between"><span>Client</span><span>{sale.customer_name}</span></div>}
      <div className="my-3 border-t border-dashed border-ink-300" />
      <div className="space-y-1.5">
        {sale.items.map((it) => (
          <div key={it.id}>
            <div className="flex justify-between gap-2">
              <span className="min-w-0 truncate">{it.qty} × {it.product_name}</span>
              <span className="shrink-0">{fmtMoney(it.total)}</span>
            </div>
            {it.returned_qty > 0 && <p className="text-[10px] text-ink-400">dont {it.returned_qty} retourné(s)</p>}
          </div>
        ))}
      </div>
      <div className="my-3 border-t border-dashed border-ink-300" />
      <div className="flex justify-between"><span>Sous-total</span><span>{fmtMoney(sale.subtotal)}</span></div>
      {sale.discount > 0 && <div className="flex justify-between"><span>Réduction</span><span>- {fmtMoney(sale.discount)}</span></div>}
      <div className="mt-1 flex justify-between text-sm font-extrabold"><span>TOTAL</span><span>{fmtMoney(sale.total)}</span></div>
      <div className="my-3 border-t border-dashed border-ink-300" />
      <div className="flex justify-between"><span>Paiement</span><span>{PAY_METHODS[sale.payment_method] || sale.payment_method}</span></div>
      {sale.payment_method === 'especes' && sale.paid_amount > sale.total && (
        <div className="flex justify-between"><span>Monnaie rendue</span><span>{fmtMoney(sale.paid_amount - sale.total)}</span></div>
      )}
      {sale.status !== 'vendue' && (
        <div className="mt-1 font-bold text-red-600">
          {sale.status === 'retournee' ? 'VENTE INTÉGRALEMENT RETOURNÉE' : 'RETOUR PARTIEL EFFECTUÉ'}
        </div>
      )}
      <p className="mt-4 text-center text-[11px] font-bold">Merci de votre confiance !</p>
    </div>
  );
}

function CaisseTab() {
  const { site } = useSite();
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState('');
  const [discount, setDiscount] = useState('');
  const [payment, setPayment] = useState('especes');
  const [paid, setPaid] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneSale, setDoneSale] = useState(null);

  const load = useCallback(() => {
    Promise.all([api.pos.products.list({ active: 1 }), api.pos.categories.list()])
      .then(([p, c]) => { setProducts(p); setCats(c); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const s = search.toLowerCase();
    return products.filter(
      (p) => (!s || p.name.toLowerCase().includes(s) || p.reference?.toLowerCase().includes(s)) && (!cat || String(p.category_id) === String(cat))
    );
  }, [products, search, cat]);

  const add = (p) => {
    if (p.stock <= 0) return;
    setCart((cur) => {
      const found = cur.find((c) => c.product.id === p.id);
      if (found) {
        if (found.qty >= p.stock) return cur;
        return cur.map((c) => (c.product.id === p.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...cur, { product: p, qty: 1 }];
    });
  };
  const setQty = (id, qty) => {
    setCart((cur) =>
      cur
        .map((c) => (c.product.id === id ? { ...c, qty: Math.min(c.product.stock, Math.max(0, qty)) } : c))
        .filter((c) => c.qty > 0)
    );
  };
  const clearCart = () => {
    setCart([]);
    setCustomer('');
    setDiscount('');
    setPaid('');
  };

  const subtotal = cart.reduce((a, c) => a + c.product.price * c.qty, 0);
  const discountNum = Math.min(Math.max(0, Number(discount) || 0), subtotal);
  const total = Math.max(0, subtotal - discountNum);
  const paidNum = Number(paid) || 0;
  const change = payment === 'especes' ? Math.max(0, paidNum - total) : 0;

  const checkout = async () => {
    if (!cart.length) return;
    setBusy(true);
    setError('');
    try {
      const sale = await api.pos.sales.create({
        items: cart.map((c) => ({ product_id: c.product.id, qty: c.qty })),
        customer_name: customer,
        discount: discountNum,
        payment_method: payment,
        paid_amount: payment === 'especes' ? Math.max(paidNum, total) : total
      });
      setDoneSale(sale);
      clearCart();
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const downloadTicket = async (sale) => {
    try {
      await api.pos.sales.downloadPdf(sale.id, `${sale.number || `ticket-${sale.id}`}.pdf`);
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <style>{PRINT_RECEIPT_CSS}</style>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              className="input !w-64 !py-2.5 text-sm"
              placeholder="Rechercher un produit…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCat('')}
                className={`rounded-full px-3.5 py-2 text-xs font-bold ring-1 transition-all ${
                  !cat ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-600 ring-ink-200 hover:ring-brand-300'
                }`}
              >
                Tous
              </button>
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCat(String(c.id) === cat ? '' : String(c.id))}
                  className={`rounded-full px-3.5 py-2 text-xs font-bold ring-1 transition-all ${
                    String(c.id) === cat ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-600 ring-ink-200 hover:ring-brand-300'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => (
              <button
                key={p.id}
                onClick={() => add(p)}
                disabled={p.stock <= 0}
                className={`card group p-4 text-left transition-all ${
                  p.stock <= 0 ? 'cursor-not-allowed opacity-50' : 'hover:-translate-y-0.5 hover:shadow-soft'
                }`}
              >
                <div className="flex items-start gap-3">
                  {p.image ? (
                    <img src={p.image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-ink-100" />
                  ) : (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cream text-xl">📦</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink-900">{p.name}</p>
                    {p.reference && <p className="truncate text-[11px] text-ink-400">{p.reference}</p>}
                    <p className="mt-1 font-display text-sm font-extrabold text-brand-700">{fmtMoney(p.price)}</p>
                  </div>
                </div>
                <div className="mt-3">{stockBadge(p)}</div>
              </button>
            ))}
          </div>
          {visible.length === 0 && (
            <p className="rounded-2xl border border-dashed border-ink-200 py-12 text-center text-ink-400">
              Aucun produit — créez le catalogue dans l'onglet Stock.
            </p>
          )}
        </div>

        <div className="card sticky top-20 overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 bg-cream/70 px-5 py-4">
            <h3 className="font-display text-lg font-bold text-ink-900">🛒 Panier ({cart.length})</h3>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs font-bold text-red-600 hover:text-red-700">Vider</button>
            )}
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto px-5 py-4">
            {cart.map((c) => (
              <div key={c.product.id} className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-800">{c.product.name}</p>
                  <p className="text-[11px] text-ink-400">{fmtMoney(c.product.price)} / unité</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQty(c.product.id, c.qty - 1)}
                    className="grid h-7 w-7 place-items-center rounded-lg bg-white font-bold text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50"
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-sm font-bold text-ink-900">{c.qty}</span>
                  <button
                    onClick={() => setQty(c.product.id, c.qty + 1)}
                    className="grid h-7 w-7 place-items-center rounded-lg bg-white font-bold text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50"
                    disabled={c.qty >= c.product.stock}
                  >
                    +
                  </button>
                </div>
                <p className="w-20 text-right text-sm font-bold text-ink-900">{fmtMoney(c.product.price * c.qty)}</p>
              </div>
            ))}
            {cart.length === 0 && (
              <p className="py-8 text-center text-sm text-ink-400">Cliquez sur un produit pour l'ajouter au panier.</p>
            )}
          </div>
          <div className="space-y-3 border-t border-ink-100 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client (optionnel)">
                <input className="input !py-2 text-sm" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nom" />
              </Field>
              <Field label="Réduction">
                <input className="input !py-2 text-sm" type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Paiement">
                <select className="input !py-2 text-sm" value={payment} onChange={(e) => setPayment(e.target.value)}>
                  {Object.entries(PAY_METHODS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>
              {payment === 'especes' && (
                <Field label="Montant reçu">
                  <input className="input !py-2 text-sm" type="number" min="0" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={total.toFixed(2)} />
                </Field>
              )}
            </div>
            <div className="space-y-1 rounded-xl bg-cream px-4 py-3 text-sm">
              <div className="flex justify-between text-ink-600"><span>Sous-total</span><span>{fmtMoney(subtotal)}</span></div>
              {discountNum > 0 && <div className="flex justify-between text-ink-600"><span>Réduction</span><span>- {fmtMoney(discountNum)}</span></div>}
              <div className="flex justify-between font-display text-base font-extrabold text-ink-900"><span>Total</span><span>{fmtMoney(total)}</span></div>
              {change > 0 && <div className="flex justify-between font-bold text-emerald-700"><span>Monnaie</span><span>{fmtMoney(change)}</span></div>}
            </div>
            <button
              onClick={checkout}
              disabled={!cart.length || busy}
              className="btn-primary w-full !py-3 text-sm"
            >
              {busy ? 'Enregistrement…' : `✓ Encaisser ${cart.length ? fmtMoney(total) : ''}`}
            </button>
          </div>
        </div>
      </div>

      <Modal open={!!doneSale} onClose={() => setDoneSale(null)} title={doneSale ? `Vente ${doneSale.number} encaissée` : ''}>
        {doneSale && (
          <div className="space-y-4">
            <ReceiptSheet sale={doneSale} site={site} />
            <div className="no-print flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-4">
              <button className="btn-ghost !px-4 !py-2.5 text-sm" onClick={() => downloadTicket(doneSale)}>
                ⬇ Ticket PDF
              </button>
              <button className="btn-ghost !px-4 !py-2.5 text-sm" onClick={() => window.print()}>
                🖨 Imprimer
              </button>
              <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => setDoneSale(null)}>
                Nouvelle vente
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ReturnModal({ sale, onDone, onClose }) {
  const [qtys, setQtys] = useState({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const returnable = (sale.items || []).filter((i) => i.qty - i.returned_qty > 0);
  const total = returnable.reduce((a, i) => a + i.price * (Number(qtys[i.id]) || 0), 0);

  const submit = async () => {
    const items = returnable
      .filter((i) => (Number(qtys[i.id]) || 0) > 0)
      .map((i) => ({ item_id: i.id, qty: Number(qtys[i.id]) }));
    if (!items.length) return;
    setBusy(true);
    setError('');
    try {
      await api.pos.sales.returnSale(sale.id, { items, reason });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-accent-50 px-4 py-3 text-sm font-semibold text-accent-900">
        ↩️ Retour sur <strong>{sale.number}</strong> — un remboursement de <strong>{fmtMoney(total)}</strong> sera à effectuer
        (le stock retourné est réapprovisionné automatiquement).
      </p>
      <div className="space-y-2">
        {returnable.map((i) => (
          <div key={i.id} className="flex items-center gap-3 rounded-xl bg-cream px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-800">{i.product_name}</p>
              <p className="text-[11px] text-ink-400">
                {fmtMoney(i.price)} / unité · {i.qty - i.returned_qty} retournable(s)
              </p>
            </div>
            <input
              className="input !w-20 !py-2 text-sm"
              type="number"
              min="0"
              max={i.qty - i.returned_qty}
              value={qtys[i.id] ?? 0}
              onChange={(e) =>
                setQtys((cur) => ({ ...cur, [i.id]: Math.min(i.qty - i.returned_qty, Math.max(0, Math.trunc(Number(e.target.value) || 0))) }))
              }
            />
          </div>
        ))}
        {returnable.length === 0 && <p className="py-6 text-center text-sm text-ink-400">Rien à retourner sur cette vente.</p>}
      </div>
      <Field label="Motif">
        <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. article défectueux, erreur de vente…" />
      </Field>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-ink-100 pt-4">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={submit} disabled={busy || total <= 0}>
          {busy ? 'Enregistrement…' : `Enregistrer le retour (${fmtMoney(total)})`}
        </button>
      </div>
    </div>
  );
}

function SalesTab() {
  const { site } = useSite();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', payment: '', q: '' });
  const [detail, setDetail] = useState(null);
  const [retSale, setRetSale] = useState(null);
  const [report, setReport] = useState(null);
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const p = {};
    for (const k of ['from', 'to', 'payment', 'q']) if (filters[k]) p[k] = filters[k];
    api.pos.sales.list(p).then(setRows).catch((e) => setError(e.message));
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    try {
      setDetail(await api.pos.sales.get(id));
    } catch (e) {
      alert(e.message);
    }
  };
  const downloadPdf = async (s) => {
    try {
      await api.pos.sales.downloadPdf(s.id, `${s.number || `ticket-${s.id}`}.pdf`);
    } catch (e) {
      alert(e.message);
    }
  };
  const voidSale = async (s) => {
    if (!confirm(`Annuler la vente ${s.number} ?\nElle sera supprimée et le stock non retourné sera réapprovisionné.`)) return;
    try {
      await api.pos.sales.remove(s.id);
      setDetail(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const downloadInvoice = async (s) => {
    try {
      await api.pos.sales.downloadInvoice(s.id, `facture-${s.number || s.id}.pdf`);
    } catch (e) {
      alert(e.message);
    }
  };
  const openReport = async () => {
    try {
      setReport(await api.pos.report.daily(reportDate));
    } catch (e) {
      alert(e.message);
    }
  };
  const totalShown = rows.reduce((a, r) => a + (Number(r.total) || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Du">
          <input className="input !w-40 !py-2.5 text-sm" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </Field>
        <Field label="Au">
          <input className="input !w-40 !py-2.5 text-sm" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </Field>
        <Field label="Paiement">
          <select className="input !w-44 !py-2.5 text-sm" value={filters.payment} onChange={(e) => setFilters({ ...filters, payment: e.target.value })}>
            <option value="">Tous</option>
            {Object.entries(PAY_METHODS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Recherche (n° / client)">
          <input className="input !w-52 !py-2.5 text-sm" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="POS-00012" />
        </Field>
        <button
          className="btn-ghost !px-4 !py-2.5 text-sm"
          onClick={() => setFilters({ from: '', to: '', payment: '', q: '' })}
        >
          Réinitialiser
        </button>
        <div className="ml-auto flex items-end gap-2">
          <Field label="Rapport de caisse">
            <input className="input !w-40 !py-2.5 text-sm" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          </Field>
          <button className="btn-ghost !px-4 !py-2.5 text-sm" onClick={openReport}>
            🖨 Générer
          </button>
        </div>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-cream/70 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-4">N°</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Caissier</th>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Articles</th>
                <th className="px-6 py-4">Paiement</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                  <td className="px-6 py-4 font-bold text-ink-900">{r.number}</td>
                  <td className="px-6 py-4 text-ink-600">{fmtDateTime(r.created_at)}</td>
                  <td className="px-6 py-4 text-ink-600">{r.cashier_name || '—'}</td>
                  <td className="px-6 py-4 text-ink-600">{r.customer_name || '—'}</td>
                  <td className="px-6 py-4 text-ink-600">{r.items_count}</td>
                  <td className="px-6 py-4 text-ink-600">{PAY_METHODS[r.payment_method] || r.payment_method}</td>
                  <td className="px-6 py-4 font-bold text-brand-700">{fmtMoney(r.total)}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${SALE_STATUS_STYLES[r.status] || ''}`}>
                      {SALE_STATUS[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openDetail(r.id)} className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100">
                        Détail
                      </button>
                      <button onClick={() => downloadPdf(r)} className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100">
                        ⬇ Ticket
                      </button>
                      <button onClick={() => downloadInvoice(r)} className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100">
                        🧾 Facture
                      </button>
                      {r.status !== 'retournee' && (
                        <button onClick={() => setRetSale(r)} className="rounded-lg bg-accent-50 px-2.5 py-1.5 text-xs font-bold text-accent-800 hover:bg-accent-100">
                          ↩ Retour
                        </button>
                      )}
                      <button onClick={() => voidSale(r)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" title="Annuler la vente">
                        Annuler
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="py-12 text-center text-ink-400">Aucune vente pour ces filtres.</p>}
        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-ink-100 bg-cream/70 px-6 py-4 text-sm">
            <span className="font-bold text-ink-500">{rows.length} vente(s)</span>
            <span className="font-display font-bold text-brand-700">Total : {fmtMoney(totalShown)}</span>
          </div>
        )}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Vente ${detail.number}` : ''} wide>
        {detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <p className="text-ink-500">📅 {fmtDateTime(detail.created_at)}</p>
              <p className="text-ink-500">👤 {detail.cashier_name || '—'}</p>
              <p className="text-ink-500">🧾 {PAY_METHODS[detail.payment_method] || detail.payment_method}</p>
              <p>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${SALE_STATUS_STYLES[detail.status] || ''}`}>
                  {SALE_STATUS[detail.status] || detail.status}
                </span>
              </p>
            </div>
            {detail.customer_name && <p className="text-sm text-ink-500">Client : <strong>{detail.customer_name}</strong></p>}
            <div className="overflow-x-auto rounded-xl ring-1 ring-ink-100">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ink-100 bg-cream/70 text-xs font-bold tracking-wide text-ink-400 uppercase">
                  <tr>
                    <th className="px-4 py-3">Article</th>
                    <th className="px-4 py-3">P.U.</th>
                    <th className="px-4 py-3">Qté</th>
                    <th className="px-4 py-3">Retournés</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((i) => (
                    <tr key={i.id} className="border-b border-ink-50 last:border-0">
                      <td className="px-4 py-3 font-semibold text-ink-800">{i.product_name}</td>
                      <td className="px-4 py-3 text-ink-600">{fmtMoney(i.price)}</td>
                      <td className="px-4 py-3 text-ink-600">{i.qty}</td>
                      <td className="px-4 py-3">{i.returned_qty > 0 ? <span className="font-bold text-red-600">{i.returned_qty}</span> : '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-ink-800">{fmtMoney(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1 text-sm">
                <p className="flex justify-between gap-8 text-ink-600"><span>Sous-total</span><span>{fmtMoney(detail.subtotal)}</span></p>
                {detail.discount > 0 && <p className="flex justify-between gap-8 text-ink-600"><span>Réduction</span><span>- {fmtMoney(detail.discount)}</span></p>}
                <p className="flex justify-between gap-8 font-display text-base font-extrabold text-ink-900"><span>Total</span><span>{fmtMoney(detail.total)}</span></p>
              </div>
              <div className="no-print flex gap-2">
                <button className="btn-ghost !px-4 !py-2.5 text-sm" onClick={() => downloadPdf(detail)}>⬇ Ticket PDF</button>
                <button className="btn-ghost !px-4 !py-2.5 text-sm" onClick={() => downloadInvoice(detail)}>🧾 Facture PDF</button>
                {detail.status !== 'retournee' && (
                  <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => { setRetSale(detail); setDetail(null); }}>
                    ↩ Retourner
                  </button>
                )}
                <button className="btn-ghost !px-4 !py-2.5 !text-red-600 text-sm" onClick={() => voidSale(detail)}>
                  Annuler
                </button>
              </div>
            </div>
            {(detail.returns || []).length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Retours enregistrés</p>
                <ul className="space-y-2">
                  {detail.returns.map((rt) => (
                    <li key={rt.id} className="rounded-xl bg-accent-50 px-4 py-3 text-sm">
                      <p className="font-bold text-accent-900">{fmtMoney(rt.total)} — {fmtDateTime(rt.created_at)}</p>
                      {rt.reason && <p className="mt-0.5 text-xs text-ink-500">{rt.reason}</p>}
                      <p className="mt-1 text-xs text-ink-600">
                        {rt.items.map((ri, i) => `${ri.qty} × ligne #${ri.sale_item_id}`).join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!retSale} onClose={() => setRetSale(null)} title={retSale ? `Retour — ${retSale.number}` : ''} wide>
        {retSale && (
          <ReturnModal
            sale={retSale}
            onDone={() => {
              setRetSale(null);
              load();
            }}
            onClose={() => setRetSale(null)}
          />
        )}
      </Modal>

      <Modal open={!!report} onClose={() => setReport(null)} title={report ? `Rapport de caisse — ${report.date}` : ''} wide>
        {report && (
          <div className="space-y-4">
            <ReportSheet rep={report} site={site} />
            <div className="no-print flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-4">
              <button className="btn-ghost !px-4 !py-2.5 text-sm" onClick={openReport}>
                ↻ Actualiser
              </button>
              <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => window.print()}>
                🖨 Imprimer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ProductForm({ initial, categories, onSaved, onClose }) {
  const [f, setF] = useState({
    name: initial.name ?? '',
    reference: initial.reference ?? '',
    description: initial.description ?? '',
    category_id: initial.category_id ?? '',
    price: initial.price ?? '',
    cost: initial.cost ?? '',
    stock: initial.stock ?? 0,
    min_stock: initial.min_stock ?? 0,
    image: initial.image ?? '',
    active: initial.active ?? 1
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...f,
        category_id: f.category_id || null,
        price: Number(f.price) || 0,
        cost: f.cost === '' ? null : Number(f.cost) || null,
        stock: Math.max(0, Math.trunc(Number(f.stock) || 0)),
        min_stock: Math.max(0, Math.trunc(Number(f.min_stock) || 0))
      };
      if (initial.id) {
        delete payload.stock;
        await api.pos.products.update(initial.id, payload);
      } else {
        await api.pos.products.create(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom *">
          <input className="input" value={f.name} onChange={set('name')} placeholder="Ex. T-shirt ADI ONG" />
        </Field>
        <Field label="Référence (SKU)">
          <input className="input" value={f.reference} onChange={set('reference')} placeholder="Ex. TSH-BLU-M" />
        </Field>
        <Field label="Catégorie">
          <select className="input" value={f.category_id ?? ''} onChange={set('category_id')}>
            <option value="">Sans catégorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Statut">
          <select className="input" value={f.active} onChange={(e) => setF({ ...f, active: e.target.value === '1' ? 1 : 0 })}>
            <option value="1">Actif (visible en caisse)</option>
            <option value="0">Inactif</option>
          </select>
        </Field>
        <Field label="Prix de vente (USD) *">
          <input className="input" type="number" min="0" step="0.01" value={f.price} onChange={set('price')} placeholder="Ex. 12" />
        </Field>
        <Field label="Coût d'achat (optionnel)">
          <input className="input" type="number" min="0" step="0.01" value={f.cost} onChange={set('cost')} placeholder="Pour la valeur du stock" />
        </Field>
        {!initial.id && (
          <Field label="Stock initial">
            <input className="input" type="number" min="0" step="1" value={f.stock} onChange={set('stock')} />
          </Field>
        )}
        <Field label="Seuil d'alerte (stock bas)">
          <input className="input" type="number" min="0" step="1" value={f.min_stock} onChange={set('min_stock')} placeholder="Ex. 5" />
        </Field>
      </div>
      {initial.id && (
        <p className="rounded-xl bg-cream px-4 py-3 text-sm text-ink-500">
          💡 Stock actuel : <strong>{initial.stock}</strong> — pour le modifier, utilisez le bouton « Mouvement » (l'ajustement reste tracé).
        </p>
      )}
      <Field label="Image (bibliothèque)">
        <ImageInput label="" value={f.image || ''} onChange={(v) => setF({ ...f, image: v })} />
      </Field>
      <Field label="Description">
        <textarea className="input" rows={3} value={f.description} onChange={set('description')} placeholder="Matière, taille, provenance…" />
      </Field>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={saving || !f.name.trim()}>
          {saving ? 'Enregistrement…' : 'Enregistrer le produit'}
        </button>
      </div>
    </div>
  );
}

function MovementForm({ product, onDone, onClose }) {
  const [type, setType] = useState('entree');
  const [qty, setQty] = useState('');
  const [newStock, setNewStock] = useState(String(product.stock));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = { type, reason };
      if (type === 'ajustement') payload.new_stock = Number(newStock) || 0;
      else payload.qty = Math.trunc(Number(qty) || 0);
      await api.pos.products.movement(product.id, payload);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-500">
        Stock actuel de <strong>{product.name}</strong> : <strong>{product.stock}</strong>
      </p>
      <Field label="Type de mouvement">
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(MOVE_TYPES).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>
      {type === 'ajustement' ? (
        <Field label="Nouveau stock">
          <input className="input" type="number" min="0" step="1" value={newStock} onChange={(e) => setNewStock(e.target.value)} />
        </Field>
      ) : (
        <Field label="Quantité *">
          <input className="input" type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Ex. 10" />
        </Field>
      )}
      <Field label="Motif">
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === 'entree' ? 'Ex. réception fournisseur' : type === 'sortie' ? 'Ex. casse, usage interne…' : 'Ex. inventaire physique'} />
      </Field>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={submit} disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer le mouvement'}
        </button>
      </div>
    </div>
  );
}

function CategoriesModal({ categories, onChanged, onClose }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    try {
      await api.pos.categories.create({ name });
      setName('');
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };
  const rename = async (c, newName) => {
    try {
      await api.pos.categories.update(c.id, { name: newName });
      onChanged();
    } catch (e) {
      alert(e.message);
    }
  };
  const remove = async (c) => {
    if (!confirm(`Supprimer la catégorie « ${c.name} » ?`)) return;
    try {
      await api.pos.categories.remove(c.id);
      onChanged();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <input
          className="input"
          value={name}
          placeholder="Nouvelle catégorie (ex. Merchandising)"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn-primary shrink-0 !px-5 text-sm" onClick={add} disabled={!name.trim()}>
          Ajouter
        </button>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <ul className="divide-y divide-ink-50 rounded-2xl ring-1 ring-ink-100">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-lg">🏷️</span>
            <input
              className="input !w-56 !border-0 !bg-transparent !px-2 !py-1.5 font-semibold text-ink-800 focus:!ring-1"
              defaultValue={c.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && rename(c, e.target.value.trim())}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
            />
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">{c.products} produit(s)</span>
            <button
              onClick={() => remove(c)}
              className="ml-auto rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
              title="Supprimer"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {categories.length === 0 && <p className="py-8 text-center text-sm text-ink-400">Aucune catégorie pour le moment.</p>}
    </div>
  );
}

function StockTab() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [prodModal, setProdModal] = useState(null);
  const [moveModal, setMoveModal] = useState(null);
  const [catsModal, setCatsModal] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([api.pos.products.list(), api.pos.categories.list()])
      .then(([p, c]) => { setProducts(p); setCats(c); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = products.filter(
    (p) =>
      (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.reference?.toLowerCase().includes(search.toLowerCase())) &&
      (!cat || String(p.category_id) === String(cat))
  );
  const lowStock = products.filter((p) => p.active && p.stock <= (p.min_stock || 0));

  const removeProduct = async (p) => {
    if (!confirm(`Supprimer « ${p.name} » du catalogue ?`)) return;
    try {
      await api.pos.products.remove(p.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-5">
      {lowStock.length > 0 && (
        <p className="rounded-2xl border border-accent-200 bg-accent-50 px-5 py-4 text-sm font-semibold text-accent-900">
          ⚠️ {lowStock.length} produit(s) sous le seuil d'alerte : {lowStock.map((p) => p.name).join(', ')}
        </p>
      )}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input !w-56 !py-2.5 text-sm"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input !w-48 !py-2.5 text-sm" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost !px-4 !py-2.5 text-sm" onClick={() => setCatsModal(true)}>
            🏷️ Catégories
          </button>
          <button className="btn-primary !px-5 !py-2.5 text-sm" onClick={() => setProdModal({})}>
            + Produit
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-cream/70 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-4">Produit</th>
                <th className="px-6 py-4">Catégorie</th>
                <th className="px-6 py-4">Prix</th>
                <th className="px-6 py-4">Coût</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Seuil</th>
                <th className="px-6 py-4">État</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {p.image ? (
                        <img src={p.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-ink-100" />
                      ) : (
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cream">📦</span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink-900">{p.name}</p>
                        <p className="truncate text-xs text-ink-400">{p.reference || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-ink-600">{p.category || '—'}</td>
                  <td className="px-6 py-4 font-bold text-ink-800">{fmtMoney(p.price)}</td>
                  <td className="px-6 py-4 text-ink-600">{p.cost != null ? fmtMoney(p.cost) : '—'}</td>
                  <td className="px-6 py-4 font-bold text-ink-800">{p.stock}</td>
                  <td className="px-6 py-4 text-ink-500">{p.min_stock || '—'}</td>
                  <td className="px-6 py-4">{stockBadge(p)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => setMoveModal(p)} className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100">
                        Mouvement
                      </button>
                      <button onClick={() => setProdModal({ ...p })} className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100">
                        Modifier
                      </button>
                      <button onClick={() => removeProduct(p)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" title="Supprimer">
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && <p className="py-12 text-center text-ink-400">Aucun produit — ajoutez le premier.</p>}
      </div>

      <Modal open={!!prodModal} onClose={() => setProdModal(null)} title={prodModal?.id ? `Modifier — ${prodModal.name}` : 'Nouveau produit'} wide>
        {prodModal && (
          <ProductForm
            initial={prodModal}
            categories={cats}
            onSaved={load}
            onClose={() => setProdModal(null)}
          />
        )}
      </Modal>

      <Modal open={!!moveModal} onClose={() => setMoveModal(null)} title={moveModal ? `Mouvement — ${moveModal.name}` : ''}>
        {moveModal && (
          <MovementForm
            product={moveModal}
            onDone={() => { setMoveModal(null); load(); }}
            onClose={() => setMoveModal(null)}
          />
        )}
      </Modal>

      <Modal open={catsModal} onClose={() => setCatsModal(false)} title="Catégories de produits">
        <CategoriesModal
          categories={cats}
          onChanged={load}
          onClose={() => setCatsModal(false)}
        />
      </Modal>
    </div>
  );
}

function MovementsTab() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [prodId, setProdId] = useState('');
  const [type, setType] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const p = {};
    if (prodId) p.product_id = prodId;
    if (type) p.type = type;
    api.pos.movements.list(p).then(setRows).catch((e) => setError(e.message));
  }, [prodId, type]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.pos.products.list().then(setProducts).catch(() => {});
  }, []);

  const qtyCell = (m) => {
    if (m.type === 'entree') return <span className="font-bold text-emerald-600">+ {m.qty}</span>;
    if (m.type === 'sortie') return <span className="font-bold text-red-600">− {m.qty}</span>;
    return <span className="font-bold text-accent-800">= {m.new_stock}</span>;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <select className="input !w-60 !py-2.5 text-sm" value={prodId} onChange={(e) => setProdId(e.target.value)}>
          <option value="">Tous les produits</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className="input !w-44 !py-2.5 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Tous les types</option>
          {Object.entries(MOVE_TYPES).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <p className="text-sm text-ink-400">Historique tracé : entrées, sorties (ventes comprises) et ajustements.</p>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-cream/70 text-xs font-bold tracking-wide text-ink-400 uppercase">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Produit</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Qté</th>
                <th className="px-6 py-4">Motif</th>
                <th className="px-6 py-4">Par</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-ink-50 last:border-0 hover:bg-cream/50">
                  <td className="px-6 py-4 text-ink-600">{fmtDateTime(m.created_at)}</td>
                  <td className="px-6 py-4 font-semibold text-ink-800">{m.product_name}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${MOVE_STYLES[m.type] || ''}`}>
                      {MOVE_TYPES[m.type] || m.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">{qtyCell(m)}</td>
                  <td className="max-w-[240px] truncate px-6 py-4 text-ink-500" title={m.reason}>{m.reason || '—'}</td>
                  <td className="px-6 py-4 text-ink-500">{m.created_by_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="py-12 text-center text-ink-400">Aucun mouvement enregistré.</p>}
      </div>
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.pos.stats().then(setStats).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>;
  if (!stats) return <p className="text-sm text-ink-400">Chargement…</p>;

  const max7 = Math.max(1, ...stats.last7.map((d) => d.total));
  const cards = [
    { icon: '💵', label: 'Ventes aujourd\'hui', value: fmtMoney(stats.today.total), sub: `${stats.today.n} vente(s)` },
    { icon: '📈', label: 'CA 7 jours', value: fmtMoney(stats.last7.reduce((a, d) => a + d.total, 0)), sub: `${stats.last7.reduce((a, d) => a + d.n, 0)} vente(s)` },
    { icon: '🏦', label: 'Valeur du stock', value: fmtMoney(stats.stockValue), sub: `${stats.products} produit(s) actif(s)` },
    { icon: '⚠️', label: 'Stock bas / rupture', value: stats.lowStock.length, sub: `${stats.outOfStock} en rupture` }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card flex items-center gap-4 p-6">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl">{c.icon}</span>
            <div className="min-w-0">
              <p className="font-display text-xl font-bold text-ink-900">{c.value}</p>
              <p className="truncate text-sm font-semibold text-ink-500">{c.label}</p>
              <p className="text-xs text-ink-400">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-7">
          <h3 className="mb-5 font-display text-lg font-bold text-ink-900">Ventes — 7 derniers jours</h3>
          <div className="flex h-44 items-end gap-3">
            {stats.last7.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                <p className="text-[10px] font-bold text-ink-500">{d.total > 0 ? fmtMoney(d.total) : ''}</p>
                <div
                  className={`w-full rounded-t-lg ${d.date === stats.last7[6].date ? 'bg-brand-600' : 'bg-brand-200'}`}
                  style={{ height: `${Math.max(4, (d.total / max7) * 120)}px` }}
                  title={`${d.n} vente(s) — ${fmtMoney(d.total)}`}
                />
                <p className="text-[10px] font-semibold text-ink-400">
                  {new Date(d.date + 'T00:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' })}
                </p>
              </div>
            ))}
          </div>
          {stats.byPayment.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
              {stats.byPayment.map((p) => (
                <span key={p.payment_method} className="rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-ink-600">
                  {PAY_METHODS[p.payment_method] || p.payment_method} : {fmtMoney(p.total)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-7">
            <h3 className="mb-4 font-display text-lg font-bold text-ink-900">Meilleures ventes (30 jours)</h3>
            {stats.topProducts.length === 0 && <p className="text-sm text-ink-400">Aucune vente sur 30 jours.</p>}
            <ul className="space-y-3">
              {stats.topProducts.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-800">{i + 1}. {p.name}</p>
                    <p className="text-xs text-ink-400">{p.qty} unité(s)</p>
                  </div>
                  <span className="shrink-0 font-bold text-brand-700">{fmtMoney(p.total)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-7">
            <h3 className="mb-4 font-display text-lg font-bold text-ink-900">Alertes stock</h3>
            {stats.lowStock.length === 0 && <p className="text-sm text-ink-400">✅ Aucun produit sous le seuil d'alerte.</p>}
            <ul className="space-y-2">
              {stats.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-2.5 text-sm">
                  <span className="truncate font-semibold text-ink-800">{p.name}</span>
                  <span className={`shrink-0 font-bold ${p.stock === 0 ? 'text-red-600' : 'text-accent-800'}`}>
                    {p.stock} / seuil {p.min_stock}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PosAdmin() {
  const [tab, setTab] = useState('caisse');
  const [moduleError, setModuleError] = useState('');

  const checkModule = useCallback(() => {
    api.pos.stats()
      .then(() => setModuleError(''))
      .catch((e) => {
        if (String(e.message).includes('désactivé')) setModuleError(e.message);
      });
  }, []);
  useEffect(() => { checkModule(); }, [checkModule]);

  if (moduleError)
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-red-50 p-8 text-center">
        <p className="text-sm font-bold text-red-700">{moduleError}</p>
        <p className="mt-2 text-sm text-red-600">
          Le super administrateur peut l'activer dans Paramètres → Modules.
        </p>
      </div>
    );

  return (
    <div>
      <PageTitle
        title="Point de vente (POS)"
        subtitle="Caisse, ventes, stock et statistiques — module interne activable par le super administrateur"
      />
      <div className="mb-8 flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
              tab === id ? 'bg-brand-600 text-white shadow-soft' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:ring-brand-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'caisse' && <CaisseTab />}
      {tab === 'ventes' && <SalesTab />}
      {tab === 'stock' && <StockTab />}
      {tab === 'mouvements' && <MovementsTab />}
      {tab === 'stats' && <StatsTab />}
    </div>
  );
}
