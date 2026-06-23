import { useCallback, useEffect, useState } from 'react';
import { api, formatCurrency } from '../api/client';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import SaleForm from '../components/SaleForm';

export default function SalesLogPage() {
  const { showToast } = useToast();
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [saving, setSaving] = useState(false);

  const selectedSale = sales.find((s) => s.sale_id === selectedSaleId);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [salesRes, productsRes, customersRes] = await Promise.all([
        api.getSales({ search, archived: String(showArchived), limit: '100' }),
        api.getProducts({ archived: 'false' }),
        api.getCustomers(),
      ]);
      setSales(salesRes.data);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
    } catch (err) {
      showToast('Load Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, showArchived, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const brands = [...new Set(products.map((p) => p.brand))];

  const handleOverride = async (payload) => {
    if (!selectedSaleId) return;
    try {
      setSaving(true);
      await api.updateSale(selectedSaleId, payload);
      showToast('Ledger Corrected', 'Transaction updated successfully.');
      setSelectedSaleId(null);
      await loadData();
    } catch (err) {
      showToast('Update Failed', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = async (saleId) => {
    if (!window.confirm('Archive this transaction? Stock will be restored.')) return;
    try {
      await api.dropSale(saleId);
      showToast('Transaction Dropped', 'Sale archived and stock restored.');
      if (selectedSaleId === saleId) setSelectedSaleId(null);
      await loadData();
    } catch (err) {
      showToast('Drop Failed', err.message, 'error');
    }
  };

  if (loading && !sales.length) return <LoadingSpinner />;

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Customer & Sales Log</h2>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => setShowArchived(false)} className={`text-xs font-bold px-3 py-1 rounded-lg ${!showArchived ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>Active</button>
            <button type="button" onClick={() => setShowArchived(true)} className={`text-xs font-bold px-3 py-1 rounded-lg ${showArchived ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>Archived</button>
          </div>
        </div>
        <div className="w-full sm:w-64">
          <label htmlFor="sales-search" className="sr-only">Search sales log</label>
          <input id="sales-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions..." className="w-full text-xs p-2.5 border border-slate-200 rounded-xl" />
        </div>
      </div>

      {selectedSale && (
        <div className="bg-red-50/50 p-5 rounded-xl border-2 border-red-200 shadow-inner space-y-4">
          <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Modify Transaction Values</h3>
              <p className="text-[11px] text-slate-400">Sale ID: {selectedSale.sale_id}</p>
            </div>
            <button type="button" onClick={() => setSelectedSaleId(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold" aria-label="Close override panel">&times;</button>
          </div>
          <SaleForm
            compact
            customers={customers}
            products={products}
            brands={brands}
            initialValues={{
              customerId: selectedSale.customer_id,
              customerName: selectedSale.customer_name,
              fbName: selectedSale.fb_name,
              phoneNumber: selectedSale.phone_number,
              priceType: selectedSale.price_type,
              brand: selectedSale.brand,
              productId: selectedSale.product_id,
              quantity: selectedSale.sale_quantity,
              unitPrice: selectedSale.unit_price,
            }}
            submitLabel={saving ? 'Saving...' : 'Commit Entry Correction'}
            onSubmit={handleOverride}
          />
        </div>
      )}

      <div className="overflow-x-auto border border-slate-100 rounded-xl">
        <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
            <tr>
              <th className="p-3">Log Date</th>
              <th className="p-3">Customer Name</th>
              <th className="p-3">Facebook Profile</th>
              <th className="p-3">Phone Number</th>
              <th className="p-3">Price Type</th>
              <th className="p-3">Product Specification</th>
              <th className="p-3 text-center">Qty</th>
              <th className="p-3 text-right">Unit Price</th>
              <th className="p-3 text-right">Total Billing</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
            {sales.map((sale) => (
              <tr key={sale.sale_id} className={selectedSaleId === sale.sale_id ? 'bg-red-50' : 'hover:bg-slate-50/80'}>
                <td className="p-3">{new Date(sale.date_created).toLocaleDateString('en-PH')}</td>
                <td className="p-3 font-bold text-slate-800">{sale.customer_name}</td>
                <td className="p-3">{sale.fb_name || <span className="text-slate-300 italic">-</span>}</td>
                <td className="p-3 font-mono text-xs">{sale.phone_number || <span className="text-slate-300 italic">-</span>}</td>
                <td className="p-3">{sale.price_type}</td>
                <td className="p-3">{sale.brand} - {sale.weight_class}kg - {sale.product_status}</td>
                <td className="p-3 text-center font-bold">{sale.sale_quantity}</td>
                <td className="p-3 text-right">{formatCurrency(sale.unit_price)}</td>
                <td className="p-3 text-right text-red-600 font-extrabold">{formatCurrency(sale.total_amount)}</td>
                <td className="p-3 text-center space-x-1">
                  {!showArchived && (
                    <>
                      <button type="button" onClick={() => setSelectedSaleId(sale.sale_id)} className="text-xs font-bold bg-slate-100 hover:bg-slate-800 hover:text-white px-2 py-1 rounded-lg">Override</button>
                      <button type="button" onClick={() => handleDrop(sale.sale_id)} className="text-xs font-bold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-2 py-1 rounded-lg">Drop</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr><td colSpan={10} className="text-center py-8 text-slate-400">No transactions found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
