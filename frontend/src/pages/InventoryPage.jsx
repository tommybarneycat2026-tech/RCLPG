import { useCallback, useEffect, useState } from 'react';
import { api, formatCurrency } from '../api/client';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';

const BRANDS = ['Regasco', 'Pryce', 'Seagas'];
const WEIGHTS = [2.7, 5, 11, 22, 50];
const STATUSES = ['Filled Tank', 'Empty Cylinder'];

const emptyForm = {
  brand: 'Regasco',
  weightClass: 11,
  status: 'Filled Tank',
  stockQuantity: 0,
  regularRetail: '',
  wholesalePrice: '',
};

export default function InventoryPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState([]);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editProduct, setEditProduct] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [productsRes, summaryRes] = await Promise.all([
        api.getProducts({ search, archived: String(showArchived) }),
        api.getWeeklySummary(),
      ]);
      setProducts(productsRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      showToast('Load Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, showArchived, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.createProduct({
        brand: form.brand,
        weightClass: Number(form.weightClass),
        status: form.status,
        stockQuantity: Number(form.stockQuantity),
        regularRetail: Number(form.regularRetail),
        wholesalePrice: Number(form.wholesalePrice),
      });
      showToast('Record Created', 'Product saved successfully.');
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      showToast('Save Failed', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editProduct) return;
    try {
      setSaving(true);
      await api.updateProduct(editProduct.product_id, {
        brand: editProduct.brand,
        weightClass: Number(editProduct.weight_class),
        status: editProduct.status,
        stockQuantity: Number(editProduct.stock_quantity),
        regularRetail: Number(editProduct.regular_retail),
        wholesalePrice: Number(editProduct.wholesale_price),
      });
      showToast('Updated', 'Product record updated.');
      setEditProduct(null);
      await loadData();
    } catch (err) {
      showToast('Update Failed', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    try {
      setSaving(true);
      await api.archiveProduct(archiveTarget.product_id);
      showToast('Archived', 'Product moved to archive.');
      setArchiveTarget(null);
      await loadData();
    } catch (err) {
      showToast('Archive Failed', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !products.length) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 lg:col-span-1">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-base font-bold text-slate-900">Add New Product</h2>
            <p className="text-xs text-slate-400">Product ID is generated automatically</p>
          </div>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="brand" className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Brand</label>
                <select id="brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full text-xs p-2.5 border border-slate-200 rounded-xl">
                  {BRANDS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="weight" className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Weight Class</label>
                <select id="weight" value={form.weightClass} onChange={(e) => setForm({ ...form, weightClass: e.target.value })} className="w-full text-xs p-2.5 border border-slate-200 rounded-xl">
                  {WEIGHTS.map((w) => <option key={w} value={w}>{w}kg</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="status" className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Gas Status</label>
                <select id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full text-xs p-2.5 border border-slate-200 rounded-xl">
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="stock" className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Stock Quantity</label>
                <input id="stock" type="number" min="0" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} className="w-full text-xs p-2.5 border border-slate-200 rounded-xl font-bold" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="retail" className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Regular Retail Price</label>
                <input id="retail" type="number" step="0.01" required value={form.regularRetail} onChange={(e) => setForm({ ...form, regularRetail: e.target.value })} className="w-full text-xs p-2.5 border border-slate-200 rounded-xl" />
              </div>
              <div>
                <label htmlFor="wholesale" className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Wholesale Price</label>
                <input id="wholesale" type="number" step="0.01" required value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} className="w-full text-xs p-2.5 border border-slate-200 rounded-xl" />
              </div>
            </div>
            <button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl">
              Save Product Record
            </button>
          </form>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 lg:col-span-2">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-base font-bold text-slate-900">Weekly Stocks Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3 rounded-l-lg">Weight Class</th>
                  <th className="p-3 text-center">Filled Stock Units</th>
                  <th className="p-3 text-center">Empty Stock Units</th>
                  <th className="p-3 text-right rounded-r-lg">Combined Storage Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {summary.map((row) => (
                  <tr key={row.weight_class}>
                    <td className="p-3 font-bold text-slate-900">{row.weight_class}kg Class</td>
                    <td className="p-3 text-center text-indigo-600 font-bold">{row.filled_stock} Units</td>
                    <td className="p-3 text-center text-slate-500 font-bold">{row.empty_stock} Units</td>
                    <td className="p-3 text-right font-black text-slate-800 bg-slate-50/60">{row.combined_volume} Total</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Inventory Catalog</h2>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setShowArchived(false)} className={`text-xs font-bold px-3 py-1 rounded-lg ${!showArchived ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>Active</button>
              <button type="button" onClick={() => setShowArchived(true)} className={`text-xs font-bold px-3 py-1 rounded-lg ${showArchived ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>Archived</button>
            </div>
          </div>
          <div className="w-full sm:w-64">
            <label htmlFor="inventory-search" className="sr-only">Search inventory</label>
            <input id="inventory-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search catalog..." className="w-full text-xs p-2.5 border border-slate-200 rounded-xl" />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Brand</th>
                <th className="p-3">Weight Class</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Stock Qty</th>
                <th className="p-3 text-center">Health Indicator</th>
                <th className="p-3 text-right">Regular Retail</th>
                <th className="p-3 text-right">Wholesale Price</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {products.map((p) => (
                <tr key={p.product_id}>
                  <td className="p-3 font-semibold">{p.brand}</td>
                  <td className="p-3 font-bold">{p.weight_class}kg</td>
                  <td className="p-3">{p.status}</td>
                  <td className="p-3 text-center font-black">{p.stock_quantity}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-black uppercase ${p.health_indicator === 'Out of Stock' ? 'bg-red-50 text-red-700' : p.health_indicator === 'Low Stock' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {p.health_indicator}
                    </span>
                  </td>
                  <td className="p-3 text-right">{formatCurrency(p.regular_retail)}</td>
                  <td className="p-3 text-right text-red-600">{formatCurrency(p.wholesale_price)}</td>
                  <td className="p-3 text-center space-x-1">
                    {!showArchived && (
                      <>
                        <button type="button" onClick={() => setEditProduct({ ...p })} className="text-xs font-bold bg-amber-100 hover:bg-amber-500 hover:text-white px-2.5 py-1 rounded-lg">Edit</button>
                        <button type="button" onClick={() => setArchiveTarget(p)} className="text-xs font-bold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-2.5 py-1 rounded-lg">Archive</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editProduct && (
        <Modal title={`Edit Product ${editProduct.product_id}`} onClose={() => setEditProduct(null)} footer={
          <>
            <button type="button" onClick={() => setEditProduct(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold">Cancel</button>
            <button type="button" disabled={saving} onClick={handleUpdate} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold">Save Changes</button>
          </>
        }>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="space-y-1"><span className="text-xs font-bold uppercase text-slate-500">Brand</span>
              <select value={editProduct.brand} onChange={(e) => setEditProduct({ ...editProduct, brand: e.target.value })} className="w-full p-2 border rounded-lg">{BRANDS.map((b) => <option key={b}>{b}</option>)}</select>
            </label>
            <label className="space-y-1"><span className="text-xs font-bold uppercase text-slate-500">Weight</span>
              <select value={editProduct.weight_class} onChange={(e) => setEditProduct({ ...editProduct, weight_class: e.target.value })} className="w-full p-2 border rounded-lg">{WEIGHTS.map((w) => <option key={w} value={w}>{w}kg</option>)}</select>
            </label>
            <label className="space-y-1"><span className="text-xs font-bold uppercase text-slate-500">Status</span>
              <select value={editProduct.status} onChange={(e) => setEditProduct({ ...editProduct, status: e.target.value })} className="w-full p-2 border rounded-lg">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            </label>
            <label className="space-y-1"><span className="text-xs font-bold uppercase text-slate-500">Stock</span>
              <input type="number" min="0" value={editProduct.stock_quantity} onChange={(e) => setEditProduct({ ...editProduct, stock_quantity: e.target.value })} className="w-full p-2 border rounded-lg" />
            </label>
            <label className="space-y-1"><span className="text-xs font-bold uppercase text-slate-500">Regular Retail</span>
              <input type="number" step="0.01" value={editProduct.regular_retail} onChange={(e) => setEditProduct({ ...editProduct, regular_retail: e.target.value })} className="w-full p-2 border rounded-lg" />
            </label>
            <label className="space-y-1"><span className="text-xs font-bold uppercase text-slate-500">Wholesale</span>
              <input type="number" step="0.01" value={editProduct.wholesale_price} onChange={(e) => setEditProduct({ ...editProduct, wholesale_price: e.target.value })} className="w-full p-2 border rounded-lg" />
            </label>
          </div>
        </Modal>
      )}

      {archiveTarget && (
        <Modal title="Archive Product" onClose={() => setArchiveTarget(null)} footer={
          <>
            <button type="button" onClick={() => setArchiveTarget(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold">Cancel</button>
            <button type="button" disabled={saving} onClick={confirmArchive} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold">Confirm Archive</button>
          </>
        }>
          <p className="text-sm text-slate-600">
            Archive product <strong>{archiveTarget.product_id}</strong>? This will hide it from active inventory without deleting the record.
          </p>
        </Modal>
      )}
    </div>
  );
}
