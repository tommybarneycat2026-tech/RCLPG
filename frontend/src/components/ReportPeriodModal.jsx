import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

const PERIODS = [
  { value: 'current_day', label: 'Current Day' },
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom Date Range' },
];

export default function ReportPeriodModal({ format, onClose }) {
  const { showToast } = useToast();
  const [period, setPeriod] = useState('current_day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      const params = { format: format === 'pdf' ? 'pdf' : 'excel', period };
      if (period === 'daily' || period === 'monthly' || period === 'yearly') {
        if (!startDate) {
          showToast('Date Required', 'Please select a reference date.', 'error');
          return;
        }
        params.startDate = startDate;
      }
      if (period === 'custom') {
        if (!startDate || !endDate) {
          showToast('Date Range Required', 'Select both start and end dates.', 'error');
          return;
        }
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const { blob, filename } = await api.exportReport(params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Export Ready', `${format.toUpperCase()} report downloaded.`);
      onClose();
    } catch (err) {
      showToast('Export Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <h2 id="report-modal-title" className="text-lg font-bold text-slate-900">
          Select Reporting Period
        </h2>
        <p className="text-xs text-slate-500">Generate a {format === 'pdf' ? 'PDF' : 'Excel'} report from sales records.</p>

        <fieldset className="space-y-2">
          <legend className="sr-only">Reporting period</legend>
          {PERIODS.map((item) => (
            <label key={item.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="period"
                value={item.value}
                checked={period === item.value}
                onChange={() => setPeriod(item.value)}
              />
              {item.label}
            </label>
          ))}
        </fieldset>

        {(period === 'daily' || period === 'monthly' || period === 'yearly') && (
          <div>
            <label htmlFor="ref-date" className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Reference Date
            </label>
            <input
              id="ref-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm p-2.5 border border-slate-200 rounded-xl"
            />
          </div>
        )}

        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="start-date" className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Start
              </label>
              <input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full text-sm p-2.5 border border-slate-200 rounded-xl" />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-xs font-bold uppercase text-slate-500 mb-1">
                End
              </label>
              <input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full text-sm p-2.5 border border-slate-200 rounded-xl" />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold">
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleExport}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-60"
          >
            {loading ? 'Generating...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
