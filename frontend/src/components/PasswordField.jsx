import { useState } from 'react';

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

export function MaskedPasswordField({ label = 'Password', id = 'password-view' }) {
  const [visible, setVisible] = useState(false);
  const displayValue = visible ? 'Password is set (hashed)' : '••••••••';

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          readOnly
          value={displayValue}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 pr-10"
          aria-readonly="true"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
          aria-label={visible ? 'Hide password status' : 'Show password status'}
          aria-pressed={visible}
        >
          <EyeIcon open={visible} />
        </button>
      </div>
    </div>
  );
}

export default function PasswordField({
  label = 'Password',
  id = 'password',
  value,
  onChange,
  placeholder = 'Enter new password',
  autoComplete = 'new-password',
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 pr-10 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          <EyeIcon open={visible} />
        </button>
      </div>
    </div>
  );
}

export function ProfileField({ label, value, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      {children || (
        <input
          id={htmlFor}
          type="text"
          readOnly
          value={value || '—'}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
          aria-readonly="true"
        />
      )}
    </div>
  );
}
