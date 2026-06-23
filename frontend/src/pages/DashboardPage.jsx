import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatCurrency } from '../api/client';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import SaleForm from '../components/SaleForm';

function productLabel(product) {
  const statusShort = product.status === 'Filled Tank' ? 'Filled' : 'Empty';
  return `${product.weight_class}kg [${statusShort}] - Stock: ${product.stock_quantity}`;
}

export default function DashboardPage() {
  const { showToast } = useToast();
  const [metrics, setMetrics] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [confirmSale, setConfirmSale] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const [metricsRes, productsRes, customersRes, salesRes] = await Promise.all([
        api.getMetrics(),
        api.getProducts({ archived: 'false' }),
        api.getCustomers(),
        api.getSales({ todayOnly: 'true', page: String(page), limit: '10' }),
      ]);
      setMetrics(metricsRes.data);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
      setRecentSales(salesRes.data);
      setPagination(salesRes.pagination);
    } catch (err) {
      showToast('Load Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      await loadData(pagination.page);
    } catch (err) {
      showToast('Save Failed', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !metrics) return <LoadingSpinner />;

  const lowStock = metrics?.lowStockProducts || [];
  const alertCardClass =
    lowStock.length > 0
      ? 'bg-amber-50 border-2 border-amber-500 shadow-md'
      : 'bg-white border border-slate-200 shadow-sm';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <article className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Items Sold</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{metrics?.totalItemsSold || 0} Items</p>
        </article>
        <article className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Revenue</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(metrics?.totalRevenue)}</p>
        </article>
        <article className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Filled Stock</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{metrics?.totalFilledStock || 0} Tanks</p>
        </article>
        <article className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Empty Stock</p>
          <p className="text-2xl font-bold text-slate-500 mt-1">{metrics?.totalEmptyStock || 0} Cylinders</p>
        </article>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3 shadow-sm" role="alert">
          <div className="flex items-center space-x-2 text-amber-800">
            <h3 className="text-sm font-bold uppercase tracking-wider">Low Stock Reminder</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs font-semibold text-amber-900">
            {lowStock.map((item) => (
              <div key={item.product_id} className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold block text-slate-900">{item.product_id}</span>
                  <span className="text-slate-500 text-[11px]">
                    {item.brand} {item.weight_class}kg [{item.status === 'Filled Tank' ? 'Filled' : 'Empty'}]
                  </span>
                </div>
                <span className={`px-2 py-1 rounded text-[10px] font-black tracking-wider ${item.health_indicator === 'Out of Stock' ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'}`}>
                  {item.health_indicator === 'Out of Stock' ? 'OUT' : 'LOW'} ({item.stock_quantity})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SaleForm
          customers={customers}
          products={products}
          brands={brands}
          onSubmit={handleSaveRequest}
        />

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recent Sales Entries</h2>
              <p className="text-xs text-slate-400">Today&apos;s sales — 10 entries per page</p>
            </div>
            <Link to="/sales-log" className="text-xs font-bold text-red-600 hover:underline">
              View Full Log &rarr;
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                <tr>
                  <th className="p-3">Customer</th>
                  <th className="p-3">FB Profile</th>
                  <th className="p-3">Product Details</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                {recentSales.map((sale) => (
                  <tr key={sale.sale_id}>
                    <td className="p-3 font-bold text-slate-800">{sale.customer_name}</td>
                    <td className="p-3">{sale.fb_name || <span className="text-slate-300 italic">-</span>}</td>
                    <td className="p-3">{sale.brand} - {sale.weight_class}kg - {sale.product_status}</td>
                    <td className="p-3 text-center font-bold">{sale.sale_quantity}</td>
                    <td className="p-3 text-right text-red-600 font-bold">{formatCurrency(sale.total_amount)}</td>
                  </tr>
                ))}
                {recentSales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-slate-400">No sales recorded today.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pagination.totalPages > 1 && (
            <nav className="flex justify-end gap-2" aria-label="Recent sales pagination">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => loadData(pagination.page - 1)}
                className="px-3 py-1 rounded-lg bg-slate-100 text-xs font-bold disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs self-center">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadData(pagination.page + 1)}
                className="px-3 py-1 rounded-lg bg-slate-100 text-xs font-bold disabled:opacity-50"
              >
                Next
              </button>
            </nav>
          )}
        </div>
      </div>

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
            <div className="flex justify-between"><dt className="text-slate-500">Product</dt><dd>{confirmSale.productLabel}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Quantity</dt><dd>{confirmSale.quantity}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Unit Price</dt><dd>{formatCurrency(confirmSale.unitPrice)}</dd></div>
            <div className="flex justify-between border-t pt-2"><dt className="font-bold">Total</dt><dd className="font-black text-red-600">{formatCurrency(confirmSale.total)}</dd></div>
          </dl>
        </Modal>
      )}
    </div>
  );
}
