import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { api } from '../api/client';

export default function AddMemberModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    phoneNumber: '',
    role: 'Staff',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const firstFieldRef = useRef(null);

  useEffect(() => {
    // focus first field for accessibility
    firstFieldRef.current?.focus();
  }, []);

  const validate = () => {
    if (!form.name.trim()) return 'Full name is required.';
    if (!form.username.trim()) return 'Username is required.';
    if (!form.email.trim()) return 'Email is required.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return 'Email is invalid.';
    if (!form.role) return 'Role is required.';
    if (!form.password) return 'Password is required.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async () => {
    setError('');
    const v = validate();
    if (v) return setError(v);
    try {
      setLoading(true);
      const payload = {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim() || null,
        role: form.role,
        password: form.password,
      };
      await api.createUser(payload);
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Create New Member"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create Member'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <div className="text-sm text-red-500">{error}</div>}
        <div>
          <label className="text-sm font-bold text-slate-700">Full Name</label>
          <input
            ref={firstFieldRef}
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Full name"
          />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700">Username</label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Username"
          />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Email"
          />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700">Phone Number (optional)</label>
          <input
            type="tel"
            value={form.phoneNumber}
            onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Phone number"
          />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700">Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Role"
          >
            <option>Staff</option>
            <option>Admin</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700">Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Password"
          />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700">Confirm Password</label>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Confirm password"
          />
        </div>
      </div>
    </Modal>
  );
}
