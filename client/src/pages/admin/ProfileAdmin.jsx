import React, { useEffect, useState } from 'react';
import { api, setSavedUser } from '../../api.js';
import { PageTitle } from './AdminUI.jsx';
import { UserProfileFields, MemberQrCard } from './UserProfileFields.jsx';

export default function ProfileAdmin() {
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.me.get()
      .then((u) => {
        setForm({ ...u, password: '' });
        setSavedUser(u);
      })
      .catch((e) => setError(e.message));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setOk('');
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        photo: form.photo || '',
        phone: form.phone || '',
        job_title: form.job_title || '',
        bio: form.bio || ''
      };
      if (form.password) payload.password = form.password;
      const updated = await api.me.update(payload);
      setForm({ ...updated, password: '' });
      setSavedUser(updated);
      setOk('Profil enregistré.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <PageTitle title="Mon profil" />;

  return (
    <div>
      <PageTitle
        subtitle="Photo, coordonnées, code unique et QR code — votre fiche membre ADI."
      />
      <form onSubmit={save} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="card p-6 sm:p-8">
          <UserProfileFields value={form} onChange={setForm} />
          {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          {ok && <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{ok}</p>}
          <div className="mt-6 flex justify-end border-t border-ink-100 pt-5">
            <button type="submit" className="btn-primary !px-6 !py-2.5 text-sm" disabled={saving || !form.email}>
              {saving ? 'Enregistrement…' : 'Enregistrer mon profil'}
            </button>
          </div>
        </div>
        <MemberQrCard user={form} />
      </form>
    </div>
  );
}
