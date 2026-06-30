import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, formatCurrency } from '../api/client';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';
import SaleForm from './SaleForm';

function productLabel(product) {
  const statusShort = product.status === 'Filled Tank' ? 'Filled' : 'Empty';
  return `${product.weight_class}kg [${statusShort}] - Stock: ${product.stock_quantity}`;
}

export default function RecordSaleModal({ open, onClose, onSuccess }) {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmSale, setConfirmSale] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [productsRes, customersRes] = await Promise.all([
        api.getProducts(),
        api.getCustomers(),
      ]);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
    } catch (err) {
      showToast('Load Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand))], [products]);

  const handleSaveRequest = (payload) => {
    const product = products.find((p) => p.product_id === payload.productId);
    const customer = payload.customerId
      ? customers.find((c) => c.customer_id === payload.customerId)
      : { name: payload.customerName, fb_name: payload.fbName, phone_number: payload.phoneNumber };

    setConfirmSale({
      ...payload,
      productLabel: product ? `${product.brand} (${productLabel(product)})` : payload.productId,
      customerName: customer?.name || payload.customerName,
      fbName: customer?.fb_name || payload.fbName,
      phoneNumber: customer?.phone_number || payload.phoneNumber,
      total: payload.quantity * payload.unitPrice,
    });
  };

  const commitSale = async () => {
    if (!confirmSale) return;
    try {
      setSaving(true);
      await api.createSale(confirmSale);
      showToast('Transaction Logged', 'Sale saved and inventory updated.');
      setConfirmSale(null);
      onClose();
      onSuccess?.();
    } catch (err) {
      showToast('Save Failed', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <Modal title="Record New Sale" onClose={onClose} size="xl">
        {loading ? (
          <p className="text-sm text-slate-500 text-center py-8">Loading...</p>
        ) : (
          <SaleForm
            customers={customers}
            products={products}
            brands={brands}
            onSubmit={handleSaveRequest}
            compact
            submitLabel="Review & Save Sale"
          />
        )}
      </Modal>

      {confirmSale && (
        <Modal
          title="Confirm Sale"
          onClose={() => setConfirmSale(null)}
          footer={
            <>
              <button type="button" onClick={() => setConfirmSale(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold">
                Cancel
              </button>
              <button type="button" disabled={saving} onClick={commitSale} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold">
                {saving ? 'Saving...' : 'Confirm & Save'}
              </button>
            </>
          }
        >
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-slate-500">Customer</dt><dd className="font-semibold">{confirmSale.customerName}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Facebook</dt><dd>{confirmSale.fbName || '-'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Phone</dt><dd>{confirmSale.phoneNumber || '-'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Price Type</dt><dd>{confirmSale.priceType}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Payment Method</dt><dd>{confirmSale.paymentMethod}</dd></div>
            {confirmSale.paymentMethod === 'Credit' && (
              <div className="flex justify-between"><dt className="text-slate-500">Initial Payment</dt><dd>{formatCurrency(confirmSale.initialPayment || 0)}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-slate-500">Product</dt><dd>{confirmSale.productLabel}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Quantity</dt><dd>{confirmSale.quantity}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Customer LPG (Empty Returned)</dt><dd className="font-semibold">{confirmSale.lpgTankVariant}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Unit Price</dt><dd>{formatCurrency(confirmSale.unitPrice)}</dd></div>
            <div className="flex justify-between border-t pt-2"><dt className="font-bold">Total</dt><dd className="font-black text-red-600">{formatCurrency(confirmSale.total)}</dd></div>
          </dl>
        </Modal>
      )}
    </>
  );
}
