import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import Logo from '../../RCLPG_Logo.jpg';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await login(username.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      showToast('Login Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const subtitle = 'Sign in to manage inventory and sales';

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="text-center space-y-3">
          <img
            src={Logo}
            alt="RCLPG Logo"
            onError={(e) => {
              e.currentTarget.src = 'https://placehold.co/96x96?text=RCLPG';
            }}
            className="h-25 w-25 mx-auto object-contain rounded-xl border border-slate-100"
          />
          <h1 className="text-2xl font-black text-slate-900">RCLPG Inventory</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
          {params.get('expired') === '1' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2" role="alert">
              Your session expired at midnight. Please sign in again.
            </p>
          )}
        </div>

        <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div>
              <label htmlFor="username" className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        <p className="text-center text-xs text-slate-400">
          Need to reset your account? Contact your administrator.
        </p>

      </div>
    </div>
  );
}
