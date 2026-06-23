export default function LoadingSpinner({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
      <div className="h-8 w-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
