import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';
import PasswordField, { MaskedPasswordField, ProfileField } from './PasswordField';

export default function StaffProfileModal({ onClose }) {
  const { admin, refreshAdmin } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', password: '' });

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.getProfile();
      setProfile(result.data);
      setForm({ name: result.data.name, password: '' });
    } catch (err) {
      showToast('Load Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = { name: form.name.trim() };
      if (form.password.trim()) payload.password = form.password;
      const result = await api.updateProfile(payload);
      setProfile(result.data);
      await refreshAdmin();
      setEditing(false);
      setForm((prev) => ({ ...prev, password: '' }));
      showToast('Profile Updated', 'Your profile has been saved.');
    } catch (err) {
      showToast('Save Failed', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setForm({ name: profile?.name || '', password: '' });
  };

  return (
    <Modal
      title="My Profile"
      onClose={onClose}
      footer={
        editing ? (
          <>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700"
            >
              Edit Profile
            </button>
          </>
        )
      }
    >
      {loading ? (
        <p className="text-sm text-slate-500">Loading profile…</p>
      ) : (
        <div className="space-y-4">
          {editing ? (
            <ProfileField label="Full Name" htmlFor="staff-name">
              <input
                id="staff-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
              />
            </ProfileField>
          ) : (
            <ProfileField label="Full Name" value={profile?.name} htmlFor="staff-name-view" />
          )}

          <ProfileField label="Username" value={profile?.username} htmlFor="staff-username" />
          <ProfileField label="Email" value={profile?.email} htmlFor="staff-email" />
          <ProfileField label="Phone Number" value={profile?.phoneNumber} htmlFor="staff-phone" />
          <ProfileField label="Role" value={profile?.role} htmlFor="staff-role" />

          {editing ? (
            <PasswordField
              id="staff-password"
              label="New Password (optional)"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Leave blank to keep current password"
            />
          ) : (
            <MaskedPasswordField id="staff-password-view" />
          )}

          <p className="text-xs text-slate-400">
            Signed in as <span className="font-semibold">{admin?.username}</span>
          </p>
        </div>
      )}
    </Modal>
  );
}
