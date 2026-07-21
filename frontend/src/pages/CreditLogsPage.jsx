import { useCallback, useEffect, useState } from 'react';
import { api, formatCurrency } from '../api/client';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import DownloadCreditLogModal from '../components/DownloadCreditLogModal';
import { subscribeRealtime } from '../utils/realtime';

function CreditStatusBadge({ status }) {
  const isPaid = status === 'Paid';
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-black uppercase ${isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
      {status}
    </span>
  );
}

function CreditDetailModal({ saleId, readOnly, onClose, onSettled }) {
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amountToPay, setAmountToPay] = useState('');
  const [confirmSettlement, setConfirmSettlement] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getCreditSummary(saleId);
      setSummary(res.data);
    } catch (err) {
      showToast('Load Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [saleId, showToast]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const unsubscribe = subscribeRealtime('credits:changed', () => {
      loadSummary();
    });

    return () => unsubscribe();
  }, [loadSummary]);

  const handleSettlementRequest = () => {
    const amount = Number(amountToPay);
    if (!amount || amount <= 0) {
      showToast('Invalid Amount', 'Enter a valid payment amount.', 'error');
      return;
    }
    if (amount > summary.remaining_credit) {
      showToast('Invalid Amount', 'Payment exceeds remaining balance.', 'error');
      return;
    }
    setConfirmSettlement({
      amount,
      remainingBefore: summary.remaining_credit,
      remainingAfter: Number((summary.remaining_credit - amount).toFixed(2)),
    });
  };

  const commitSettlement = async () => {
    if (!confirmSettlement) return;
    try {
      setSaving(true);
      await api.createCreditPayment(saleId, confirmSettlement.amount);
      showToast('Payment Recorded', 'Installment saved successfully.');
      setConfirmSettlement(null);
      setAmountToPay('');
      await loadSummary();
      onSettled?.();
    } catch (err) {
      showToast('Payment Failed', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const title = readOnly ? 'View Credit' : 'Manage Credit';

  return (
    <>
      <Modal title={title} onClose={onClose} size="lg">
        {loading || !summary ? (
          <p className="text-sm text-slate-500 text-center py-6">Loading...</p>
        ) : (
          <div className="space-y-4">
            <dl className="text-sm space-y-2 bg-slate-50 p-4 rounded-xl">
              <div className="flex justify-between"><dt className="text-slate-500">Customer Name</dt><dd className="font-semibold">{summary.customer_name}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Phone Number</dt><dd>{summary.phone_number || '-'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Invoice Reference</dt><dd className="font-mono text-xs">{summary.sale_id}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Product Details</dt><dd>{summary.product_details}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Total Cost</dt><dd className="font-bold">{formatCurrency(summary.total_cost)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Total Paid</dt><dd className="font-bold text-emerald-600">{formatCurrency(summary.total_paid)}</dd></div>
              <div className="flex justify-between border-t pt-2"><dt className="font-bold">Remaining Credit</dt><dd className="font-black text-red-600">{formatCurrency(summary.remaining_credit)}</dd></div>
            </dl>

            <div>
              <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Payment History</h3>
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                    <tr>
                      <th className="p-3">Date Paid</th>
                      <th className="p-3 text-right">Balance Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.payment_history.map((row) => (
                      <tr key={row.credit_id}>
                        <td className="p-3">{new Date(row.date_paid).toLocaleString('en-PH')}</td>
                        <td className="p-3 text-right font-bold">{formatCurrency(row.balance_paid)}</td>
                      </tr>
                    ))}
                    {summary.payment_history.length === 0 && (
                      <tr><td colSpan={2} className="p-3 text-center text-slate-400">No payments recorded.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {!readOnly && summary.remaining_credit > 0 && (
              <div className="space-y-3 border-t pt-4">
                <div>
                  <label htmlFor="amount-to-pay" className="block text-xs font-bold uppercase text-slate-500 mb-1">Amount To Pay Now</label>
                  <input
                    id="amount-to-pay"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={summary.remaining_credit}
                    value={amountToPay}
                    onChange={(e) => setAmountToPay(e.target.value)}
                    className="w-full text-sm p-3 border border-slate-200 rounded-xl"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSettlementRequest}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl text-sm"
                >
                  Confirm Settlement
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {confirmSettlement && summary && (
        <Modal
          title="Confirm Settlement"
          onClose={() => setConfirmSettlement(null)}
          footer={
            <>
              <button type="button" onClick={() => setConfirmSettlement(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold">Cancel</button>
              <button type="button" disabled={saving} onClick={commitSettlement} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold">
                {saving ? 'Processing...' : 'Confirm Payment'}
              </button>
            </>
          }
        >
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-slate-500">Customer Name</dt><dd className="font-semibold">{summary.customer_name}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Invoice Reference</dt><dd className="font-mono text-xs">{summary.sale_id}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Amount Being Paid</dt><dd className="font-bold text-red-600">{formatCurrency(confirmSettlement.amount)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Remaining Before Payment</dt><dd>{formatCurrency(confirmSettlement.remainingBefore)}</dd></div>
            <div className="flex justify-between border-t pt-2"><dt className="font-bold">Remaining After Payment</dt><dd className="font-black">{formatCurrency(confirmSettlement.remainingAfter)}</dd></div>
          </dl>
        </Modal>
      )}
    </>
  );
}

export default function CreditLogsPage() {
  const { showToast } = useToast();
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getCredits();
      setCredits(res.data);
    } catch (err) {
      showToast('Load Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribeCredits = subscribeRealtime('credits:changed', () => {
      loadData();
    });
    const unsubscribeSales = subscribeRealtime('sales:changed', () => {
      loadData();
    });

    return () => {
      unsubscribeCredits();
      unsubscribeSales();
    };
  }, [loadData]);

  if (loading && !credits.length) return <LoadingSpinner />;

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Customer Credit Register</h2>
          <button type="button" onClick={() => setDownloadOpen(true)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl">Download Credit Log</button>
        </div>
        <p className="text-xs text-red-600 font-bold uppercase tracking-wider mt-1">UTANG DESK</p>
        <p className="text-xs text-slate-400 mt-1">Track outstanding balances, installment payments, and customer credit status</p>
      </div>

      <div className="overflow-x-auto border border-slate-100 rounded-xl">
        <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
            <tr>
              <th className="p-3">Customer Name</th>
              <th className="p-3">Phone Number</th>
              <th className="p-3">Product Details</th>
              <th className="p-3 text-right">Product Price</th>
              <th className="p-3 text-right">Total Paid</th>
              <th className="p-3 text-right">Remaining Credit</th>
              <th className="p-3 text-center">Credit Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
            {credits.map((row) => (
              <tr key={row.sale_id} className="hover:bg-slate-50/80">
                <td className="p-3 font-bold text-slate-800">{row.customer_name}</td>
                <td className="p-3 font-mono text-xs">{row.phone_number || '-'}</td>
                <td className="p-3">{row.product_details}</td>
                <td className="p-3 text-right">{formatCurrency(row.total_amount)}</td>
                <td className="p-3 text-right text-emerald-600 font-bold">{formatCurrency(row.total_paid)}</td>
                <td className="p-3 text-right text-red-600 font-extrabold">{formatCurrency(row.remaining_credit)}</td>
                <td className="p-3 text-center"><CreditStatusBadge status={row.credit_status} /></td>
                <td className="p-3 text-center">
                  {row.remaining_credit > 0 ? (
                    <button
                      type="button"
                      onClick={() => setActiveModal({ saleId: row.sale_id, readOnly: false })}
                      className="text-xs font-bold bg-red-600 text-white hover:bg-red-700 px-2.5 py-1 rounded-lg"
                    >
                      Manage Credit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveModal({ saleId: row.sale_id, readOnly: true })}
                      className="text-xs font-bold bg-slate-100 hover:bg-slate-800 hover:text-white px-2.5 py-1 rounded-lg"
                    >
                      View Credit
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {credits.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">No credit sales recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {activeModal && (
        <CreditDetailModal
          saleId={activeModal.saleId}
          readOnly={activeModal.readOnly}
          onClose={() => setActiveModal(null)}
          onSettled={loadData}
        />
      )}
      {downloadOpen && (
        <DownloadCreditLogModal onClose={() => setDownloadOpen(false)} />
      )}
    </div>
  );
}
