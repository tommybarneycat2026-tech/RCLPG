import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import PasswordField, { MaskedPasswordField, ProfileField } from '../components/PasswordField';
import ViewUserModal from '../components/ViewUserModal';
import AddMemberModal from '../components/AddMemberModal';
import { isAdministratorRole } from '../utils/roles';
import { formatRoleLabel } from '../utils/roles';
import { subscribeRealtime } from '../utils/realtime';

export default function AdminProfilePage() {
  const { refreshAdmin } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewUserId, setViewUserId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    phoneNumber: '',
    password: '',
  });

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const profileRes = await api.getProfile();
      setProfile(profileRes.data);
      setForm({
        name: profileRes.data.name,
        username: profileRes.data.username,
        email: profileRes.data.email,
        phoneNumber: profileRes.data.phoneNumber,
        password: '',
      });
    } catch (err) {
      showToast('Load Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      setUsersError('');
      const usersRes = await api.getUsers({ includeArchived: String(showArchived) });
      setUsers(usersRes.data);
    } catch (err) {
      setUsers([]);
      setUsersError(err.message || 'Unable to load staff list.');
      showToast('Staff List Failed', err.message, 'error');
    } finally {
      setUsersLoading(false);
    }
  }, [showArchived, showToast]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const unsubscribeAdmin = subscribeRealtime('admin:changed', () => {
      loadUsers();
      loadProfile();
    });
    const unsubscribeAuth = subscribeRealtime('auth:updated', () => {
      loadUsers();
      loadProfile();
    });

    return () => {
      unsubscribeAdmin();
      unsubscribeAuth();
    };
  }, [loadProfile, loadUsers]);

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
      };
      if (form.password.trim()) payload.password = form.password;
      const result = await api.updateProfile(payload);
      setProfile(result.data);
      await refreshAdmin();
      setEditing(false);
      setForm((prev) => ({ ...prev, password: '' }));
      showToast('Profile Updated', 'Your administrator profile has been saved.');
    } catch (err) {
      showToast('Save Failed', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setForm({
      name: profile?.name || '',
      username: profile?.username || '',
      email: profile?.email || '',
      phoneNumber: profile?.phoneNumber || '',
      password: '',
    });
  };

  if (loading && !profile) {
    return <LoadingSpinner label="Loading admin profile" />;
  }

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Administrator Profile</h1>
            <p className="text-sm text-slate-500 mt-1">Manage your account details and staff users.</p>
          </div>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="self-start px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700"
            >
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2 self-start">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {editing ? (
            <>
              <ProfileField label="Full Name" htmlFor="admin-name">
                <input
                  id="admin-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                />
              </ProfileField>
              <ProfileField label="Username" htmlFor="admin-username">
                <input
                  id="admin-username"
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                />
              </ProfileField>
              <ProfileField label="Email" htmlFor="admin-email">
                <input
                  id="admin-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                />
              </ProfileField>
              <ProfileField label="Phone Number" htmlFor="admin-phone">
                <input
                  id="admin-phone"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                />
              </ProfileField>
              <div className="md:col-span-2">
                <PasswordField
                  id="admin-password"
                  label="New Password (optional)"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Leave blank to keep current password"
                />
              </div>
            </>
          ) : (
            <>
              <ProfileField label="Full Name" value={profile?.name} htmlFor="admin-name-ro" />
              <ProfileField label="Username" value={profile?.username} htmlFor="admin-username-ro" />
              <ProfileField label="Email" value={profile?.email} htmlFor="admin-email-ro" />
              <ProfileField label="Phone Number" value={profile?.phoneNumber} htmlFor="admin-phone-ro" />
              <ProfileField label="Role" value={formatRoleLabel(profile?.role)} htmlFor="admin-role-ro" />
              <div className="md:col-span-2">
                <MaskedPasswordField id="admin-password-ro" />
              </div>
            </>
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">Management Staff List</h2>
            <p className="text-sm text-slate-500 mt-1">View and manage portal staff accounts.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              className={`text-xs font-bold px-4 py-2.5 rounded-lg ${!showArchived ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className={`text-xs font-bold px-4 py-2.5 rounded-lg ${showArchived ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}
            >
              Archived
            </button>
            {isAdministratorRole(profile?.role) && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="self-start px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700"
              >
                Add Member
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone Number</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Loading staff list…
                  </td>
                </tr>
              ) : usersError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-red-500">
                    {usersError}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No {showArchived ? 'archived' : 'active'} staff found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.adminId} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-900">{user.name}</td>
                    <td className="px-4 py-3 text-slate-600">{user.username}</td>
                    <td className="px-4 py-3 text-slate-600">{user.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{user.phoneNumber || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                        {formatRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setViewUserId(user.adminId)}
                        className="text-xs font-bold text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {viewUserId && (
        <ViewUserModal
          userId={viewUserId}
          onClose={() => setViewUserId(null)}
          onUpdated={() => {
            loadUsers();
            loadProfile();
          }}
        />
      )}
      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}
