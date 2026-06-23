import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((title, message, type = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed top-28 right-4 z-50 space-y-2 pointer-events-none max-w-sm w-full"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-lg border flex items-start space-x-3 pointer-events-auto ${
              toast.type === 'success'
                ? 'bg-white border-l-4 border-emerald-500 border-slate-100'
                : 'bg-white border-l-4 border-red-500 border-slate-100'
            }`}
            role="status"
          >
            <div className="flex-1">
              <h3 className="text-xs font-bold text-slate-900">{toast.title}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
