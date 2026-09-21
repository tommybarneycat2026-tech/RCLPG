import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import Logo from '../../RCLPG_Logo.jpg';

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858 3.03a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm p-3 pr-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
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
