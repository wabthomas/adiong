import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken } from '../../api.js';
import { usePerm } from '../../usePerm.js';
import { Modal, Field } from './AdminUI.jsx';


const chatFileUrl = (url) => {
  if (!url) return '';
  const t = getToken();
  if (!t || !String(url).startsWith('/uploads/chat/')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}access=${encodeURIComponent(t)}`;
};

const QUICK_EMOJIS = ['😀', '😂', '😊', '😅', '😉', '😍', '🤔', '🙃', '🙏', '', '🙌', '🎯', '❤️', '🎉', '✅', '❌', '️', '💡', '🌟', '🔥', '', '☕', '🌍', '🕐'];
const SENDER_COLORS = ['text-brand-700', 'text-emerald-600', 'text-accent-700', 'text-violet-600', 'text-rose-600', 'text-sky-600', 'text-lime-700'];

const ts = (v) => new Date(String(v || '').replace(' ', 'T') + 'Z').getTime();
const fmtTime = (v) => {
  const t = ts(v);
  return isNaN(t) ? '' : new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};
const dayKey = (v) => {
  const t = ts(v);
  if (isNaN(t)) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const fmtDayLabel = (v) => {
  const t = ts(v);
  if (isNaN(t)) return '';
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const d = new Date(t);
  if (key(d) === key(today)) return "Aujourd'hui";
  if (key(d) === key(yest)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};
const fmtListTime = (v) => {
  const t = ts(v);
  if (!v || isNaN(t)) return '';
  const d = new Date(t);
  const today = new Date();
  const key = (x) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  if (key(d) === key(today)) return fmtTime(v);
  const yest = new Date(Date.now() - 86400000);
  if (key(d) === key(yest)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

function Avatar({ src, name, group = false, size = 'h-12 w-12', txt = 'text-sm' }) {
  const url = chatFileUrl(src);
  if (url) return <img src={url} alt="" className={`${size} shrink-0 rounded-full object-cover ring-1 ring-ink-100`} />;
  const initials = (name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className={`${size} grid shrink-0 place-items-center rounded-full ${group ? 'bg-accent-100 font-bold text-accent-800' : 'bg-brand-100 font-display font-bold text-brand-700'} ${txt}`}>
      {group && !initials ? '👥' : initials || '👥'}
    </span>
  );
}

function CheckMarks({ read }) {
  return (
    <span className={`text-[10px] leading-none ${read ? 'text-emerald-300' : 'text-white/60'}`}>
      {read ? '✓✓' : '✓'}
    </span>
  );
}

function Attachment({ m, onZoom }) {
  const mime = String(m.attachment_mime || '');
  if (mime.startsWith('audio/')) {
    return (
      <div className="flex items-center gap-2.5 py-1">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/10 text-lg">🎤</span>
        <audio controls src={chatFileUrl(m.attachment)} className="h-10 w-56 max-w-full" />
      </div>
    );
  }
  if (mime.startsWith('image/')) {
    return (
      <button onClick={() => onZoom?.(chatFileUrl(m.attachment), m.attachment_name)} className="block cursor-zoom-in" title="Agrandir">
        <img src={chatFileUrl(m.attachment)} alt={m.attachment_name} className="max-h-64 w-auto rounded-lg ring-1 ring-ink-100" />
      </button>
    );
  }
  return (
    <a href={chatFileUrl(m.attachment)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-xs font-bold hover:bg-black/10">
      📄 <span className="max-w-[180px] truncate">{m.attachment_name || 'Fichier'}</span>
    </a>
  );
}
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function Bubble({ m, me, group, canModerate, onReply, onPin, onEdit, onDelete, onReact, onZoom }) {
  const mine = m.sender_id === me;
  const color = SENDER_COLORS[(m.sender_id || 0) % SENDER_COLORS.length];
  if (m.deleted_at) {
    return (
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[78%] rounded-2xl bg-ink-100/70 px-4 py-2.5 text-sm text-ink-400 italic">
          🚫 Message supprimé
          <span className="ml-2 text-[10px] not-italic text-ink-300">{fmtTime(m.created_at)}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`relative max-w-[78%] rounded-2xl px-3.5 py-2 shadow-sm ${mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white text-ink-800 ring-1 ring-ink-100'}`}>
        {group && !mine && <p className={`mb-0.5 text-xs font-extrabold ${color}`}>{m.sender_name || 'Membre'}</p>}
        {m.reply_body && (
          <div className={`mb-1.5 rounded-lg border-l-4 px-2.5 py-1.5 text-xs ${mine ? 'border-white/40 bg-white/10' : 'border-brand-300 bg-brand-50'}`}>
            <p className={`font-bold ${mine ? 'text-white' : 'text-brand-700'}`}>{m.reply_sender_name || 'Message'}</p>
            <p className="line-clamp-2 opacity-80">{m.reply_body}</p>
          </div>
        )}
        {m.attachment && <Attachment m={m} onZoom={onZoom} />}
        {m.body && <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{m.body}</p>}
        <div className={`mt-1 flex items-center gap-1.5 text-[10px] ${mine ? 'text-white/70' : 'text-ink-400'}`}>
          {m.pinned === 1 && <span title="Épinglé">📌</span>}
          {m.edited_at && <span>· Modifié</span>}
          <span>{fmtTime(m.created_at)}</span>
          {mine && <CheckMarks read={!!m.read} />}
        </div>
        {m.reactions?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact?.(m, r.emoji)}
                title={r.mine ? 'Retirer ma réaction' : `Réagir ${r.emoji}`}
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ring-1 transition-colors ${r.mine ? 'bg-brand-100 ring-brand-300' : 'bg-white/85 ring-ink-100 hover:bg-cream'}`}
              >
                {r.emoji} {r.count > 1 ? r.count : ''}
              </button>
            ))}
          </div>
        )}
        <div className={`absolute top-1/2 hidden -translate-y-1/2 flex-col gap-1 group-hover:flex ${mine ? 'right-full mr-1.5' : 'left-full ml-1.5'}`}>
          <div className="flex gap-1">
            <button onClick={() => onReply(m)} title="Répondre" className="grid h-7 w-7 place-items-center rounded-full bg-white text-xs shadow-soft ring-1 ring-ink-100 hover:bg-cream">↩</button>
            <button onClick={() => onPin(m)} title={m.pinned === 1 ? 'Désépingler' : 'Épingler'} className="grid h-7 w-7 place-items-center rounded-full bg-white text-xs shadow-soft ring-1 ring-ink-100 hover:bg-cream">📌</button>
            {mine && (
              <button onClick={() => onEdit(m)} title="Modifier" className="grid h-7 w-7 place-items-center rounded-full bg-white text-xs shadow-soft ring-1 ring-ink-100 hover:bg-cream">✎</button>
            )}
            {(mine || canModerate) && (
              <button onClick={() => onDelete(m)} title="Supprimer" className="grid h-7 w-7 place-items-center rounded-full bg-white text-xs shadow-soft ring-1 ring-red-100 text-red-500 hover:bg-red-50">🗑</button>
            )}
          </div>
          <div className="flex gap-0.5 rounded-full bg-white px-1 py-0.5 shadow-soft ring-1 ring-ink-100">
            {REACTION_EMOJIS.map((em) => (
              <button key={em} onClick={() => onReact?.(m, em)} title={`Réagir ${em}`} className="grid h-6 w-6 place-items-center rounded-full text-sm hover:bg-cream">
                {em}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StaffPicker({ staff, selected, onToggle, excludeSelf = false }) {
  return (
    <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-xl border border-ink-100 bg-cream/60 p-2">
      {staff.map((e) => {
        const isSel = selected.includes(e.id);
        const locked = e.is_me;
        return (
          <label key={e.id} className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-white ${locked ? 'cursor-default opacity-70' : ''}`}>
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#0f3a88]"
              checked={locked || isSel}
              disabled={locked || excludeSelf && locked}
              onChange={() => !locked && onToggle(e.id)}
            />
            <Avatar src={e.photo} name={e.full_name} size="h-8 w-8" txt="text-[10px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink-800">{e.full_name}{locked ? ' (vous)' : ''}</span>
              <span className="block truncate text-xs text-ink-400">{e.position || e.department_name || '—'}</span>
            </span>
          </label>
        );
      })}
      {staff.length === 0 && <p className="py-6 text-center text-sm text-ink-400">Aucun collaborateur actif.</p>}
    </div>
  );
}

function NewGroupModal({ staff, onCreated, onClose }) {
  const [f, setF] = useState({ name: '', description: '', avatar: '' });
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (id) => setMembers((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const uploadAvatar = async (file) => {
    if (!file) return;
    try {
      const r = await api.chat.upload(file);
      setF((cur) => ({ ...cur, avatar: r.url }));
    } catch (e) {
      alert(e.message);
    }
  };
  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const conv = await api.chat.createGroup({ ...f, member_ids: members });
      onCreated(conv);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-500">Créez un groupe de discussion : nom, photo, description et membres. Vous en êtes le propriétaire.</p>
      <div className="grid gap-4 sm:grid-cols-[96px_minmax(0,1fr)]">
        <Field label="Photo du groupe">
          <div className="flex flex-col items-center gap-2">
            <Avatar src={f.avatar} name={f.name || 'G'} group size="h-20 w-20" txt="text-lg" />
            <label className="btn-ghost cursor-pointer !px-3 !py-1.5 text-xs">
              {f.avatar ? 'Changer' : '📤 Photo'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
            </label>
          </div>
        </Field>
        <div className="space-y-4">
          <Field label="Nom du groupe *">
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. Équipe Programme Goma" />
          </Field>
          <Field label="Description">
            <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Objet du groupe (optionnel)" />
          </Field>
        </div>
      </div>
      <Field label={`Membres (${members.length} sélectionné(s))`}>
        <StaffPicker staff={staff} selected={members} onToggle={toggle} />
      </Field>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-ink-100 pt-4">
        <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={create} disabled={busy || !f.name.trim() || members.length === 0}>
          {busy ? 'Création…' : 'Créer le groupe'}
        </button>
      </div>
    </div>
  );
}

function NewDmModal({ staff, onOpened, onClose }) {
  const [q, setQ] = useState('');
  const list = staff.filter((e) => !e.is_me && (e.full_name + ' ' + (e.position || '')).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-500">Choisissez un collaborateur pour démarrer une discussion privée.</p>
      <input className="input" placeholder="Rechercher un collaborateur…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {list.map((e) => (
          <button key={e.id} onClick={() => onOpened(e)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-cream">
            <Avatar src={e.photo} name={e.full_name} size="h-10 w-10" txt="text-xs" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-ink-900">{e.full_name}</span>
              <span className="block truncate text-xs text-ink-400">{e.position || e.department_name || '—'}</span>
            </span>
          </button>
        ))}
        {list.length === 0 && <p className="py-8 text-center text-sm text-ink-400">Aucun collaborateur trouvé.</p>}
      </div>
    </div>
  );
}

function SettingsModal({ conv, isSuperRole, onClose }) {
  const isOwner = conv.my_role === 'proprietaire';
  const isMod = isOwner || conv.my_role === 'moderateur';
  const [f, setF] = useState({ name: conv.name || '', description: conv.description || '', avatar: conv.avatar || '', join_policy: conv.join_policy || 'ferme' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const uploadAvatar = async (file) => {
    if (!file) return;
    try {
      const r = await api.chat.upload(file);
      setF((cur) => ({ ...cur, avatar: r.url }));
    } catch (e) {
      alert(e.message);
    }
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.chat.update(conv.id, f);
      setMsg('✓ Groupes mis à jour.');
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const deleteGroup = async () => {
    if (!confirm(`Supprimer le groupe « ${conv.name} » et tout son historique ? Cette action est définitive.`)) return;
    try {
      await api.chat.remove(conv.id);
      onClose();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[96px_minmax(0,1fr)]">
        <div>
          <p className="label">Photo</p>
          <div className="flex flex-col items-center gap-2">
            <Avatar src={f.avatar} name={f.name || 'G'} group size="h-20 w-20" txt="text-lg" />
            {isMod && (
              <label className="btn-ghost cursor-pointer !px-3 !py-1.5 text-xs">
                {f.avatar ? 'Changer' : '📤 Photo'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
              </label>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Nom du groupe">
            <input className="input" value={f.name} disabled={!isMod} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Description">
            <input className="input" value={f.description} disabled={!isMod} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
        </div>
      </div>
      {isMod && (
        <Field label="Adhésion" hint="Ouvert : tout collaborateur peut rejoindre le groupe. Fermé : seuls les modérateurs ajoutent des membres.">
          <div className="flex gap-4">
            {['ferme', 'ouvert'].map((p) => (
              <label key={p} className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-700">
                <input type="radio" className="h-4 w-4 accent-[#0f3a88]" checked={f.join_policy === p} onChange={() => setF({ ...f, join_policy: p })} />
                {p === 'ferme' ? 'Groupe fermé (invitations)' : 'Groupe ouvert (adhésion libre)'}
              </label>
            ))}
          </div>
        </Field>
      )}
      {msg && <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">{msg}</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      {isMod && (
        <div className="flex justify-end gap-3 border-t border-ink-100 pt-4">
          <button className="btn-primary !px-6 !py-2.5 text-sm" onClick={save} disabled={busy || !f.name.trim()}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      )}
      {isOwner && (
        <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
          <p className="text-sm font-bold text-red-700">Zone dangereuse</p>
          <p className="mt-1 text-xs text-red-600">Supprimer le groupe efface définitivement toutes les discussions et pièces jointes.</p>
          <button onClick={deleteGroup} className="btn-ghost mt-3 !px-4 !py-2 text-sm !text-red-600">Supprimer le groupe</button>
        </div>
      )}
    </div>
  );
}

function MembersModal({ conv, onClose, onChanged }) {
  const isOwner = conv.my_role === 'proprietaire';
  const isMod = isOwner || conv.my_role === 'moderateur';
  const [members, setMembers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.chat.members(conv.id).then(setMembers).catch((e) => setError(e.message));
  }, [conv.id]);
  useEffect(() => {
    load();
    api.chat.staff().then(setStaff).catch(() => {});
  }, [load]);

  const canRemove = (m) => m.is_me ? conv.my_role !== 'proprietaire' : isMod && m.role !== 'proprietaire';
  const remove = async (m) => {
    const label = m.is_me ? 'quitter le groupe' : `retirer ${m.full_name} du groupe`;
    if (!confirm(`Confirmer : ${label} ?`)) return;
    try {
      const r = await api.chat.removeMember(conv.id, m.id);
      if (r.deleted) { alert('Le groupe a été supprimé (plus assez de membres).'); onClose(); return; }
      load();
      onChanged();
    } catch (e) {
      alert(e.message);
    }
  };
  const setRole = async (m, role) => {
    try {
      await api.chat.setMemberRole(conv.id, m.id, role);
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const add = async (id) => {
    try {
      await api.chat.addMember(conv.id, { user_id: Number(id) });
      setAddOpen(false);
      load();
      onChanged();
    } catch (e) {
      alert(e.message);
    }
  };
  const addable = staff.filter((e) => !members.some((m) => m.id === e.id));

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ink-700">{members.length} membre(s)</p>
        {isMod && (
          <button className="btn-ghost !px-4 !py-2 text-sm" onClick={() => setAddOpen((v) => !v)}>
            {addOpen ? 'Fermer' : '+ Ajouter un membre'}
          </button>
        )}
      </div>
      {addOpen && isMod && (
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-ink-100 bg-cream/60 p-2">
          {addable.map((e) => (
            <button key={e.id} onClick={() => add(e.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white">
              <Avatar src={e.photo} name={e.full_name} size="h-8 w-8" txt="text-[10px]" />
              <span className="truncate font-semibold text-ink-800">{e.full_name}</span>
              <span className="ml-auto text-xs text-brand-700">Ajouter</span>
            </button>
          ))}
          {addable.length === 0 && <p className="py-4 text-center text-xs text-ink-400">Tout le monde est déjà membre.</p>}
        </div>
      )}
      <ul className="max-h-80 space-y-1 overflow-y-auto">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-cream/60">
            <Avatar src={m.photo} name={m.full_name} size="h-9 w-9" txt="text-[10px]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink-900">
                {m.full_name}
                {m.is_me && <span className="ml-1.5 rounded-full bg-accent-400 px-1.5 py-0.5 text-[9px] font-bold text-ink-950">VOUS</span>}
                {!m.is_active && <span className="ml-1.5 rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-bold text-ink-500">inactif</span>}
              </p>
              <p className="truncate text-xs text-ink-400">{m.position || '—'}</p>
            </div>
            {isOwner && !m.is_me && (
              <select
                className="input !w-32 !py-1 text-xs font-bold"
                value={m.role}
                disabled={m.role === 'proprietaire'}
                onChange={(e) => setRole(m, e.target.value)}
              >
                <option value="membre">Membre</option>
                <option value="moderateur">Modérateur</option>
              </select>
            )}
            {!isOwner && m.role_label && (
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${m.role === 'proprietaire' ? 'bg-accent-100 text-accent-800' : m.role === 'moderateur' ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>
                {m.role_label}
              </span>
            )}
            {isOwner && m.role !== 'proprietaire' && (
              <button onClick={() => remove(m)} title="Retirer du groupe" className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100">✕</button>
            )}
          </li>
        ))}
      </ul>
      {conv.type === 'group' && conv.my_role !== 'proprietaire' && (
        <div className="border-t border-ink-100 pt-3">
          <button onClick={() => remove(members.find((m) => m.is_me))} className="btn-ghost !px-4 !py-2 text-sm !text-red-600">
            Quitter le groupe
          </button>
        </div>
      )}
    </div>
  );
}

export default function Chat() {
  const canCreateGroup = usePerm('chat.groups', ['super_admin', 'admin']);
  const [convs, setConvs] = useState([]);
  const [openGroups, setOpenGroups] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pins, setPins] = useState([]);
  const [staff, setStaff] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [reply, setReply] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState(null);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [zoom, setZoom] = useState(null);
  const [recording, setRecording] = useState(null);
  const [sideTab, setSideTab] = useState('chats'); // chats | contacts | groups
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const searchTimer = useRef(null);
  const scrollRef = useRef(null);
  const atBottomRef = useRef(true);
  const prevLastMsgRef = useRef(0);
  const typingSentAtRef = useRef(0);
  const recorderRef = useRef(null);
  const recTimerRef = useRef(null);
  const recChunksRef = useRef([]);
  const recSendRef = useRef(true);

  const me = active?.me;
  const meRef = useRef(null);
  useEffect(() => { meRef.current = me; }, [me]);
  const activeRole = active?.conversation?.my_role || 'membre';
  const canModerate = active?.conversation?.type === 'group' && ['proprietaire', 'moderateur'].includes(activeRole);
  const typingFresh = typing && typing.at && Date.now() - ts(typing.at) < 6000;

  const askNotifyPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  };
  const playBeep = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.setValueAtTime(1174, ctx.currentTime + 0.09);
      g.gain.setValueAtTime(0.07, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      o.start();
      o.stop(ctx.currentTime + 0.42);
      o.onended = () => ctx.close();
    } catch { /* audio indisponible */ }
  };
  const notifyFresh = (d) => {
    const conv = d.conversation;
    if (!conv || conv.muted) return;
    playBeep();
    const lastOther = [...d.messages].reverse().find((m) => m.sender_id !== meRef.current);
    if (!lastOther) return;
    const preview = lastOther.body
      || (String(lastOther.attachment_mime || '').startsWith('audio/') ? '🎤 Message vocal'
        : String(lastOther.attachment_mime || '').startsWith('image/') ? '📷 Photo' : '📎 Pièce jointe');
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`${conv.name}${lastOther.sender_name ? ' — ' + lastOther.sender_name : ''}`, { body: preview.slice(0, 140), tag: `adiong-chat-${conv.id}` });
      } catch { /* notification refusée */ }
    }
  };

  const loadConvs = useCallback(() => {
    api.chat.conversations().then(setConvs).catch(() => {});
    api.chat.openGroups().then(setOpenGroups).catch(() => {});
  }, []);
  useEffect(() => {
    loadConvs();
    const id = setInterval(loadConvs, 15000);
    return () => clearInterval(id);
  }, [loadConvs]);
  useEffect(() => {
    api.chat.staff().then(setStaff).catch(() => {});
  }, []);

  const loadMsgs = useCallback(() => {
    if (!activeId) return;
    api.chat.messages(activeId).then((d) => {
      const prevLast = prevLastMsgRef.current;
      const fresh = d.messages.filter((m) => m.id > prevLast && m.sender_id !== meRef.current).length;
      setActive(d);
      setPins(d.pins);
      setTyping(d.typing || null);
      setMessages(d.messages);
      if (d.messages.length) prevLastMsgRef.current = d.messages[d.messages.length - 1].id;
      if (fresh > 0) {
        if (document.visibilityState === 'hidden') notifyFresh(d);
        else if (!atBottomRef.current) setNewCount((c) => c + fresh);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);
  useEffect(() => {
    if (!activeId) { setActive(null); setMessages([]); setPins([]); setTyping(null); return; }
    prevLastMsgRef.current = 0;
    setNewCount(0);
    atBottomRef.current = true;
    setAtBottom(true);
    loadMsgs();
    const id = setInterval(loadMsgs, 5000);
    return () => clearInterval(id);
  }, [activeId, loadMsgs]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && (atBottomRef.current || last.sender_id === me)) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, me]);

  useEffect(() => {
    if (!activeId) return;
    const onVis = () => { if (document.visibilityState === 'visible') loadMsgs(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [activeId, loadMsgs]);

  const onScrollChat = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    atBottomRef.current = nearEnd;
    setAtBottom(nearEnd);
    if (nearEnd) setNewCount(0);
  };
  const scrollBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setNewCount(0);
  };
  const sendTyping = () => {
    if (!activeId) return;
    const now = Date.now();
    if (now - typingSentAtRef.current < 1800) return;
    typingSentAtRef.current = now;
    api.chat.typing(activeId).catch(() => {});
  };
  const doMute = async (muted) => {
    try {
      await api.chat.mute(activeId, muted);
      loadMsgs();
      loadConvs();
    } catch (e) {
      alert(e.message);
    }
  };
  const doReact = async (m, emoji) => {
    try {
      await api.chat.react(m.id, emoji);
      loadMsgs();
    } catch (e) {
      alert(e.message);
    }
  };

  const openConv = (id) => {
    setActiveId(id);
    setSearchQ('');
    setSearchRes(null);
  };
  const startDm = async (e) => {
    try {
      const conv = await api.chat.dm(e.id);
      setModal(null);
      loadConvs();
      openConv(conv.id);
    } catch (err) {
      alert(err.message);
    }
  };
  const createdGroup = (conv) => {
    loadConvs();
    openConv(conv.id);
  };

  const doSearch = (q) => {
    clearTimeout(searchTimer.current);
    if (!q || q.trim().length < 2) { setSearchRes(null); return; }
    searchTimer.current = setTimeout(() => {
      api.chat.search(q.trim()).then(setSearchRes).catch(() => setSearchRes(null));
    }, 350);
  };

  const send = async () => {
    if ((!text.trim() && !file) || !activeId) return;
    setBusy(true);
    askNotifyPermission();
    try {
      await api.chat.send(activeId, text.trim(), reply?.id || 0, file);
      setText('');
      setFile(null);
      setReply(null);
      if (fileRef.current) fileRef.current.value = '';
      loadMsgs();
      loadConvs();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };
  const sendVoice = async (f) => {
    if (!activeId) return;
    setBusy(true);
    askNotifyPermission();
    try {
      await api.chat.send(activeId, '', 0, f);
      loadMsgs();
      loadConvs();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) recChunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recTimerRef.current);
        setRecording(null);
        const blob = new Blob(recChunksRef.current, { type: rec.mimeType || 'audio/webm' });
        recChunksRef.current = [];
        if (recSendRef.current && blob.size > 0) {
          const ext = String(rec.mimeType || '').includes('mp4') ? 'm4a' : 'webm';
          sendVoice(new File([blob], `message-vocal-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.${ext}`, { type: blob.type }));
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording({ sec: 0 });
      recTimerRef.current = setInterval(() => setRecording((r) => (r ? { ...r, sec: r.sec + 1 } : r)), 1000);
    } catch {
      alert('Microphone inaccessible — vérifiez les autorisations du navigateur.');
    }
  };
  const stopRec = (sendIt) => {
    recSendRef.current = !!sendIt;
    recorderRef.current?.stop();
    recorderRef.current = null;
  };
  const doEdit = async (m) => {
    const v = prompt('Modifier le message :', m.body || '');
    if (v === null || !v.trim() || v.trim() === m.body) return;
    try {
      await api.chat.editMessage(m.id, v.trim());
      loadMsgs();
    } catch (e) {
      alert(e.message);
    }
  };
  const doDelete = async (m) => {
    if (!confirm('Supprimer ce message pour tout le monde ?')) return;
    try {
      await api.chat.deleteMessage(m.id);
      loadMsgs();
      loadConvs();
    } catch (e) {
      alert(e.message);
    }
  };
  const doPin = async (m) => {
    try {
      await api.chat.togglePin(m.id);
      loadMsgs();
    } catch (e) {
      alert(e.message);
    }
  };
  const insertEmoji = (em) => {
    setText((t) => t + em);
    setEmojiOpen(false);
  };
  const joinOpenGroup = async (g) => {
    if (!confirm(`Rejoindre le groupe « ${g.name} » ?`)) return;
    try {
      await api.chat.joinGroup(g.id);
      loadConvs();
    } catch (e) {
      alert(e.message);
    }
  };

  const rendered = [];
  let lastDay = '';
  for (const m of messages) {
    const day = dayKey(m.created_at);
    const sep = day !== lastDay;
    lastDay = day;
    rendered.push(
      <React.Fragment key={m.id}>
        {sep && (
          <div className="my-3 flex justify-center">
            <span className="rounded-full bg-white/90 px-3.5 py-1 text-[11px] font-bold text-ink-400 shadow-sm ring-1 ring-ink-100">
              {fmtDayLabel(m.created_at)}
            </span>
          </div>
        )}
        <Bubble
          m={m}
          me={me}
          group={active?.conversation?.type === 'group'}
          canModerate={canModerate}
          onReply={(mm) => setReply(mm)}
          onPin={doPin}
          onEdit={doEdit}
          onDelete={doDelete}
          onReact={doReact}
          onZoom={(url, name) => setZoom({ url, name })}
        />
      </React.Fragment>
    );
  }

  const contacts = staff.filter((e) => !e.is_me);
  const myGroups = convs.filter((c) => c.type === 'group');
  const chatList = sideTab === 'groups' ? myGroups : sideTab === 'contacts' ? [] : convs;

  return (
    <div className="flex h-[calc(100vh-190px)] min-h-[540px] overflow-hidden rounded-2xl bg-white ring-1 ring-ink-950/5">
      <div className={`w-full flex-col border-r border-ink-100 lg:flex lg:w-[340px] lg:shrink-0 ${activeId ? 'hidden' : 'flex'}`}>
        <div className="border-b border-ink-100 bg-cream/70 px-4 py-3.5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink-900">Messages</h2>
            <div className="flex gap-1.5">
              <button className="btn-ghost !px-3 !py-1.5 text-xs" title="Nouvelle discussion" onClick={() => { setSideTab('contacts'); setModal('dm'); }}>✉</button>
              {canCreateGroup && (
                <button className="btn-ghost !px-3 !py-1.5 text-xs" title="Nouveau groupe" onClick={() => setModal('group')}>👥</button>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-white p-1 ring-1 ring-ink-100">
            {[
              { id: 'chats', label: 'Discussions' },
              { id: 'contacts', label: 'Contacts' },
              { id: 'groups', label: 'Groupes' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setSideTab(t.id); setSearchRes(null); setSearchQ(''); }}
                className={`rounded-lg px-2 py-1.5 text-[11px] font-bold ${sideTab === t.id ? 'bg-brand-600 text-white' : 'text-ink-500 hover:bg-cream'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            className="input mt-2.5 !py-2 text-sm"
            placeholder={sideTab === 'contacts' ? 'Rechercher un contact…' : sideTab === 'groups' ? 'Rechercher un groupe…' : 'Rechercher une discussion…'}
            value={searchQ}
            onChange={(e) => {
              setSearchQ(e.target.value);
              if (sideTab === 'chats') doSearch(e.target.value);
            }}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {sideTab === 'contacts' ? (
            <ul>
              {contacts
                .filter((e) => !searchQ.trim() || `${e.full_name} ${e.position || ''} ${e.email || ''}`.toLowerCase().includes(searchQ.toLowerCase()))
                .map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => startDm(e)} className="flex w-full items-center gap-3 border-b border-ink-50 px-4 py-3 text-left hover:bg-cream/60">
                      <Avatar src={e.photo} name={e.full_name} size="h-11 w-11" txt="text-xs" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-ink-900">{e.full_name}</span>
                        <span className="block truncate text-xs text-ink-400">{e.position || e.department_name || '—'}</span>
                      </span>
                    </button>
                  </li>
                ))}
              {contacts.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-400">Aucun autre compte.</p>}
            </ul>
          ) : searchRes !== null && sideTab === 'chats' ? (
            <ul>
              {searchRes.map((r) => (
                <li key={r.id}>
                  <button onClick={() => openConv(r.conversation_id)} className="flex w-full items-start gap-3 border-b border-ink-50 px-4 py-3 text-left hover:bg-cream/60">
                    <span className="mt-0.5 text-lg">🔎</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-ink-400">{r.conversation_name} · {r.sender_name || '—'}</span>
                      <span className="block truncate text-sm text-ink-700">{r.deleted_at ? 'Message supprimé' : r.body}</span>
                    </span>
                  </button>
                </li>
              ))}
              {searchRes.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-400">Aucun message trouvé.</p>}
            </ul>
          ) : chatList.length === 0 && (sideTab !== 'groups' || openGroups.length === 0) ? (
            <div className="grid h-full place-items-center p-6 text-center">
              <div>
                <p className="mt-3 text-sm font-bold text-ink-700">{sideTab === 'groups' ? 'Aucun groupe' : 'Aucune discussion'}</p>
                <p className="mt-1 text-xs text-ink-400">
                  {sideTab === 'groups'
                    ? (canCreateGroup ? 'Créez un groupe et invitez l’équipe.' : 'Les groupes sont créés par un administrateur.')
                    : 'Onglet Contacts pour démarrer une discussion privée.'}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  {sideTab !== 'groups' && <button className="btn-primary !px-4 !py-2 text-sm" onClick={() => { setSideTab('contacts'); setModal('dm'); }}>+ Discussion</button>}
                  {canCreateGroup && <button className="btn-ghost !px-4 !py-2 text-sm" onClick={() => setModal('group')}>+ Groupe</button>}
                </div>
              </div>
            </div>
          ) : (
            <>
              {chatList.length > 0 && (
                <ul>
                  {chatList.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => openConv(c.id)}
                        className={`flex w-full items-center gap-3 border-b border-ink-50 px-4 py-3.5 text-left transition-colors ${activeId === c.id ? 'bg-brand-50' : 'hover:bg-cream/60'}`}
                      >
                        <Avatar src={c.avatar} name={c.name} group={c.type === 'group'} size="h-12 w-12" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-bold text-ink-900">
                              {c.name}
                              {c.muted && <span className="ml-1.5 text-xs opacity-70" title="Sourdine">🔕</span>}
                            </span>
                            <span className="shrink-0 text-[10px] font-semibold text-ink-400">{fmtListTime(c.last_message_at)}</span>
                          </span>
                          <span className="mt-0.5 flex items-center justify-between gap-2">
                            <span className={`truncate text-xs ${c.muted ? 'text-ink-300' : 'text-ink-500'}`}>
                              {c.type === 'group' && c.last_message_sender ? `${c.last_message_sender.split(' ')[0]} : ` : ''}
                              {c.last_message_body || (c.type === 'group' ? `${c.member_count} membre(s)` : 'Discussion privée')}
                            </span>
                            {c.unread > 0 && !c.muted && (
                              <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-brand-600 px-1.5 text-[10px] font-black text-white">
                                {c.unread > 99 ? '99+' : c.unread}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {sideTab === 'groups' && openGroups.length > 0 && (
                <div>
                  <p className="px-4 pb-1 pt-4 text-[11px] font-bold tracking-wide text-ink-400 uppercase">Groupes ouverts</p>
                  <ul>
                    {openGroups.map((g) => (
                      <li key={g.id} className="border-b border-ink-50">
                        <div className="flex items-center gap-3 px-4 py-3">
                          <Avatar src={g.avatar} name={g.name} group size="h-10 w-10" txt="text-xs" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-ink-900">{g.name}</p>
                            <p className="truncate text-xs text-ink-400">{g.description || `${g.member_count} membre(s)`}</p>
                          </div>
                          <button className="btn-primary shrink-0 !px-3 !py-1.5 text-xs" onClick={() => joinOpenGroup(g)}>Rejoindre</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className={`relative min-w-0 flex-1 flex-col ${activeId ? 'flex' : 'hidden lg:flex'}`}>
        {!active ? (
          <div className="grid flex-1 place-items-center bg-cream/40 p-8 text-center">
            <div>
              <p className="text-5xl">💬</p>
              <h3 className="mt-4 font-display text-lg font-bold text-ink-800">Espace Messages</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
                Discussions privées, groupes créés par l’admin, documents, vocaux, emoji et indicateurs de saisie — comme WhatsApp, pour l’équipe.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-ink-100 bg-cream/70 px-4 py-3">
              <button className="btn-ghost !px-2.5 !py-1.5 lg:hidden" onClick={() => setActiveId(null)}>←</button>
              <Avatar src={active.conversation.avatar} name={active.conversation.name} group={active.conversation.type === 'group'} size="h-10 w-10" txt="text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">
                  {active.conversation.name}
                  {active.conversation.join_policy === 'ouvert' && active.conversation.type === 'group' && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">groupe ouvert</span>
                  )}
                </p>
                <p className={`truncate text-xs ${typingFresh ? 'font-semibold text-brand-600' : 'text-ink-400'}`}>
                  {typingFresh
                    ? (active.conversation.type === 'group'
                        ? `${(typing.name || '').split(' ')[0]} est en train d'écrire…`
                        : 'est en train d’écrire…')
                    : (active.conversation.type === 'group'
                      ? `${active.conversation.member_count} membre(s) · ${activeRole === 'proprietaire' ? 'vous êtes propriétaire' : activeRole === 'moderateur' ? 'modérateur' : 'discussion de groupe'}`
                      : active.conversation.other?.position || 'Discussion privée')}
                </p>
              </div>
              <button
                className={`btn-ghost !px-3 !py-1.5 text-xs ${active.conversation.muted ? '!text-ink-400' : ''}`}
                title={active.conversation.muted ? 'Réactiver les notifications' : 'Sourdine (masque les non-lus)'}
                onClick={() => doMute(!active.conversation.muted)}
              >
                {active.conversation.muted ? '🔕' : '🔔'}
              </button>
              <button className="btn-ghost !px-3 !py-1.5 text-xs" title="Membres" onClick={() => setModal('members')}>👥</button>
              {active.conversation.type === 'group' && (
                <button className="btn-ghost !px-3 !py-1.5 text-xs" title="Paramètres du groupe" onClick={() => setModal('settings')}>⚙</button>
              )}
            </div>

            {pins.length > 0 && (
              <div className="flex items-center gap-2.5 border-b border-accent-100 bg-accent-50 px-4 py-2">
                <span className="text-sm">📌</span>
                <p className="min-w-0 flex-1 truncate text-xs font-semibold text-accent-900">
                  <strong>{pins[0].sender_name || 'Membre'} :</strong> {pins[0].body || 'Pièce jointe'}
                  {pins.length > 1 && <span className="ml-2 text-accent-600">+{pins.length - 1} autre(s) épinglé(s)</span>}
                </p>
              </div>
            )}

            <div ref={scrollRef} onScroll={onScrollChat} className="flex-1 space-y-2 overflow-y-auto bg-[#eef3f0] px-4 py-4">
              {rendered}
              <div ref={endRef} />
            </div>
            {!atBottom && (
              <button
                onClick={scrollBottom}
                className="absolute right-5 z-10 rounded-full bg-brand-600 px-3.5 py-2 text-xs font-bold text-white shadow-lift transition-colors hover:bg-brand-700"
                style={{ bottom: '7.5rem' }}
              >
                ↓ {newCount > 0 ? `${newCount} nouveau${newCount > 1 ? 'x' : ''}` : 'Bas de discussion'}
              </button>
            )}

            <div className="border-t border-ink-100 bg-white p-3">
              {reply && (
                <div className="mb-2 flex items-center gap-2.5 rounded-lg border-l-4 border-brand-500 bg-brand-50 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-brand-700">Répondre à {reply.sender_name || '—'}</p>
                    <p className="truncate text-xs text-ink-500">{reply.body || 'Pièce jointe'}</p>
                  </div>
                  <button onClick={() => setReply(null)} className="text-ink-400 hover:text-ink-600">✕</button>
                </div>
              )}
              {file && (
                <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-cream px-3 py-2">
                  <span>📎</span>
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-700">{file.name}</p>
                  <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-ink-400 hover:text-ink-600">✕</button>
                </div>
              )}
              {recording ? (
                <div className="flex items-center gap-3 rounded-xl bg-rose-50 px-4 py-2.5 ring-1 ring-rose-100">
                  <span className="h-3 w-3 animate-pulse rounded-full bg-rose-500" />
                  <span className="text-sm font-bold text-rose-700">Enregistrement… {recording.sec} s</span>
                  <div className="ml-auto flex gap-2">
                    <button className="btn-ghost !px-3 !py-1.5 text-sm" title="Annuler l'enregistrement" onClick={() => stopRec(false)}>✕</button>
                    <button className="btn-primary !px-4 !py-1.5 text-sm" onClick={() => stopRec(true)}>Envoyer</button>
                  </div>
                </div>
              ) : (
              <div className="flex items-end gap-2">
                <div className="relative">
                  <button className="btn-ghost !px-3 !py-2.5" title="Émoticônes" onClick={() => setEmojiOpen((v) => !v)}>😊</button>
                  {emojiOpen && (
                    <div className="absolute bottom-12 left-0 z-10 grid w-64 grid-cols-8 gap-1 rounded-xl bg-white p-2 shadow-lift ring-1 ring-ink-100">
                      {QUICK_EMOJIS.map((em) => (
                        <button key={em} onClick={() => insertEmoji(em)} className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-cream">{em}</button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv,audio/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <button className="btn-ghost !px-3 !py-2.5" title="Pièce jointe (image, PDF, document…)" onClick={() => fileRef.current?.click()}>📎</button>
                <button className="btn-ghost !px-3 !py-2.5" title="Message vocal (micro)" onClick={startRec}>🎤</button>
                <textarea
                  className="input max-h-32 flex-1 resize-none !py-3"
                  rows={1}
                  placeholder="Écrire un message…"
                  value={text}
                  onChange={(e) => { setText(e.target.value); if (e.target.value.trim()) sendTyping(); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button className="btn-primary !px-5 !py-3 text-sm" onClick={send} disabled={busy || (!text.trim() && !file)}>
                  {busy ? '…' : 'Envoyer'}
                </button>
              </div>
              )}
            </div>
          </>
        )}
      </div>

      <Modal open={modal === 'group' && canCreateGroup} onClose={() => setModal(null)} title="Nouveau groupe" wide>
        <NewGroupModal staff={staff} onCreated={createdGroup} onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'dm'} onClose={() => setModal(null)} title="Nouvelle conversation">
        <NewDmModal staff={staff} onOpened={startDm} onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'settings'} onClose={() => setModal(null)} title={`Paramètres — ${active?.conversation?.name || ''}`} wide>
        {modal === 'settings' && active && (
          <SettingsModal conv={active.conversation} onClose={() => { setModal(null); loadConvs(); }} />
        )}
      </Modal>
      <Modal open={modal === 'members'} onClose={() => setModal(null)} title={`Membres — ${active?.conversation?.name || ''}`} wide>
        {modal === 'members' && active && (
          <MembersModal conv={active.conversation} onClose={() => setModal(null)} onChanged={loadConvs} />
        )}
      </Modal>

      {zoom && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-6" onClick={() => setZoom(null)}>
          <div className="max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.url} alt={zoom.name || 'Image'} className="max-h-[82vh] w-auto rounded-xl shadow-lift" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-semibold text-white">{zoom.name || 'Image'}</p>
              <div className="flex shrink-0 gap-2">
                <a href={zoom.url} download={zoom.name || 'image'} className="btn-ghost !bg-white/15 !px-4 !py-2 text-sm !text-white hover:!bg-white/25">
                  ⬇ Télécharger
                </a>
                <button className="btn-ghost !bg-white/15 !px-4 !py-2 text-sm !text-white hover:!bg-white/25" onClick={() => setZoom(null)}>
                  ✕ Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
