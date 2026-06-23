export default function Modal({ title, children, onClose, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold" aria-label="Close modal">
            &times;
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="flex justify-end gap-2 pt-2">{footer}</div>}
      </div>
    </div>
  );
}
