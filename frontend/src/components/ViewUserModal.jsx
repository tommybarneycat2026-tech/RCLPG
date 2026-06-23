import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';
import PasswordField, { MaskedPasswordField, ProfileField } from './PasswordField';

export default function ViewUserModal({ userId, onClose, onUpdated }) {
  const { admin: currentAdmin } = useAuth();
  const { showToast } = useToast();
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    phoneNumber: '',
    password: '',
  });

  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.getUser(userId);
      setUser(result.data);
      setForm({
        name: result.data.name,
        username: result.data.username,
        email: result.data.email,
        phoneNumber: result.data.phoneNumber,
        password: '',
      });
    } catch (err) {
      showToast('Load Failed', err.message, 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [userId, showToast, onClose]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
      };
      if (form.password.trim()) payload.password = form.password;
      const result = await api.updateUser(userId, payload);
      setUser(result.data);
      setEditing(false);
      setForm((prev) => ({ ...prev, password: '' }));
      onUpdated?.();
      showToast('User Updated', 'Staff record saved successfully.');
    } catch (err) {
      showToast('Save Failed', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm(`Archive ${user?.name}? They will no longer be able to sign in.`)) return;
    try {
      setArchiving(true);
      const result = await api.archiveUser(userId);
      setUser(result.data);
      onUpdated?.();
      showToast('User Archived', result.message || 'User has been archived.');
    } catch (err) {
      showToast('Archive Failed', err.message, 'error');
    } finally {
      setArchiving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setForm({
      name: user?.name || '',
      username: user?.username || '',
      email: user?.email || '',
      phoneNumber: user?.phoneNumber || '',
      password: '',
    });
  };

  const isSelf = currentAdmin?.adminId === userId;
  const isArchived = user?.status === 'Archived';

  return (
    <Modal
      title={editing ? 'Edit User' : 'View User'}
      onClose={onClose}
      footer={
        <>
          {!editing && user?.status === 'Active' && !isSelf && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiving}
              className="px-4 py-2 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
            >
              {archiving ? 'Archiving…' : 'Archive'}
            </button>
          )}
          {editing ? (
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
                disabled={saving}
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
              {!isArchived && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700"
                >
                  Edit
                </button>
              )}
            </>
          )}
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-slate-500">Loading user…</p>
      ) : (
        <div className="space-y-4">
          {editing ? (
            <>
              <ProfileField label="Full Name" htmlFor="view-user-name">
                <input
                  id="view-user-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                />
              </ProfileField>
              <ProfileField label="Username" htmlFor="view-user-username">
                <input
                  id="view-user-username"
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                />
              </ProfileField>
              <ProfileField label="Email" htmlFor="view-user-email">
                <input
                  id="view-user-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                />
              </ProfileField>
              <ProfileField label="Phone Number" htmlFor="view-user-phone">
                <input
                  id="view-user-phone"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                />
              </ProfileField>
              <PasswordField
                id="view-user-password"
                label="New Password (optional)"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Leave blank to keep current password"
              />
            </>
          ) : (
            <>
              <ProfileField label="Full Name" value={user?.name} htmlFor="view-user-name-ro" />
              <ProfileField label="Username" value={user?.username} htmlFor="view-user-username-ro" />
              <ProfileField label="Email" value={user?.email} htmlFor="view-user-email-ro" />
              <ProfileField label="Phone Number" value={user?.phoneNumber} htmlFor="view-user-phone-ro" />
              <ProfileField label="Role" value={user?.role} htmlFor="view-user-role-ro" />
              <ProfileField
                label="Status"
                value={user?.status === 'Archived' ? 'Archived' : 'Active'}
                htmlFor="view-user-status-ro"
              />
              <MaskedPasswordField id="view-user-password-ro" />
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
