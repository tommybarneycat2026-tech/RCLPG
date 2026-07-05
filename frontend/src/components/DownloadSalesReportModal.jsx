import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom Date Range' },
];

export default function DownloadSalesReportModal({ onClose }) {
  const { showToast } = useToast();
  const [period, setPeriod] = useState('today');
  const [monthValue, setMonthValue] = useState('');
  const [yearValue, setYearValue] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    try {
      setLoading(true);
      const params = { period };

      if (period === 'monthly') {
        if (!monthValue) {
          showToast('Month Required', 'Please select a month.', 'error');
          return;
        }
        params.startDate = `${monthValue}-01`;
      }

      if (period === 'yearly') {
        if (!yearValue) {
          showToast('Year Required', 'Please select a year.', 'error');
          return;
        }
        params.startDate = `${yearValue}-01-01`;
      }

      if (period === 'custom') {
        if (!startDate || !endDate) {
          showToast('Date Range Required', 'Select both start and end dates.', 'error');
          return;
        }
        if (new Date(startDate) > new Date(endDate)) {
          showToast('Invalid Range', 'Start date cannot be after end date.', 'error');
          return;
        }
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const { blob, filename } = await api.downloadSalesReport(params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Report Ready', 'Sales report downloaded successfully.');
      onClose();
    } catch (err) {
      showToast('Download Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="download-report-title">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <h2 id="download-report-title" className="text-lg font-bold text-slate-900">
          Download Sales Report
        </h2>
        <p className="text-xs text-slate-500">
          Generate an Excel report with summary metrics and charts for the selected period.
        </p>

        <fieldset className="space-y-2">
          <legend className="sr-only">Report type</legend>
          {PERIODS.map((item) => (
            <label key={item.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="report-period"
                value={item.value}
                checked={period === item.value}
                onChange={() => setPeriod(item.value)}
              />
              {item.label}
            </label>
          ))}
        </fieldset>

        {period === 'monthly' && (
          <div>
            <label htmlFor="report-month" className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Month
            </label>
            <input
              id="report-month"
              type="month"
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
              className="w-full text-sm p-2.5 border border-slate-200 rounded-xl"
            />
          </div>
        )}

        {period === 'yearly' && (
          <div>
            <label htmlFor="report-year" className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Year
            </label>
            <input
              id="report-year"
              type="number"
              min="2000"
              max="2100"
              value={yearValue}
              onChange={(e) => setYearValue(e.target.value)}
              className="w-full text-sm p-2.5 border border-slate-200 rounded-xl"
            />
          </div>
        )}

        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="report-start-date" className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Start Date
              </label>
              <input
                id="report-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm p-2.5 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label htmlFor="report-end-date" className="block text-xs font-bold uppercase text-slate-500 mb-1">
                End Date
              </label>
              <input
                id="report-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm p-2.5 border border-slate-200 rounded-xl"
              />
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
            onClick={handleDownload}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-60"
          >
            {loading ? 'Generating...' : 'Download Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
