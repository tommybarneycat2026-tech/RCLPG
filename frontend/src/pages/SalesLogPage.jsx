import { useCallback, useEffect, useState } from "react";
import { api, formatCurrency } from "../api/client";
import { useToast } from "../context/ToastContext";
import LoadingSpinner from "../components/LoadingSpinner";
import SaleForm from "../components/SaleForm";
import RecordSaleModal from "../components/RecordSaleModal";
import RecordExpenseModal from "../components/RecordExpenseModal";
import DownloadSalesLogModal from "../components/DownloadSalesLogModal";
import Modal from "../components/Modal";

export default function SalesLogPage() {
  const { showToast } = useToast();
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [customerNameFilter, setCustomerNameFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedSale = sales.find((s) => s.sale_id === selectedSaleId);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: "100" };
      if (search) params.search = search;
      if (dateFilter) params.dateFilter = dateFilter;
      if (customerNameFilter) params.customerName = customerNameFilter;
      if (productFilter) params.productFilter = productFilter;

      const [salesRes, productsRes, customersRes] = await Promise.all([
        api.getSales(params),
        api.getProducts(),
        api.getCustomers(),
      ]);
      setSales(salesRes.data);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
    } catch (err) {
      showToast("Load Failed", err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [search, dateFilter, customerNameFilter, productFilter, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const brands = [...new Set(products.map((p) => p.brand))];

  const handleOverride = async (payload) => {
    if (!selectedSaleId) return;
    try {
      setSaving(true);
      await api.updateSale(selectedSaleId, payload);
      showToast("Ledger Corrected", "Transaction updated successfully.");
      setSelectedSaleId(null);
      await loadData();
    } catch (err) {
      showToast("Update Failed", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      await api.deleteSale(deleteTarget.sale_id);
      showToast("Transaction Deleted", "Sale removed and stock restored.");
      if (selectedSaleId === deleteTarget.sale_id) setSelectedSaleId(null);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast("Delete Failed", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !sales.length) return <LoadingSpinner />;

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="border-b border-slate-100 pb-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">
            Customer & Sales Log
          </h2>
          <button
            type="button"
            onClick={() => setDownloadModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl"
          >
            Download Sales Log
          </button>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setExpenseModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl"
            >
              Add Expenses
            </button>
            <button
              type="button"
              onClick={() => setSaleModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl"
            >
              Record Sale
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
            <div>
              <label
                htmlFor="date-filter"
                className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
              >
                Date Filter
              </label>
              <input
                id="date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label
                htmlFor="customer-filter"
                className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
              >
                Customer Name
              </label>
              <input
                id="customer-filter"
                type="text"
                value={customerNameFilter}
                onChange={(e) => setCustomerNameFilter(e.target.value)}
                placeholder="Filter by name..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label
                htmlFor="product-filter"
                className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
              >
                Product Filter
              </label>
              <input
                id="product-filter"
                type="text"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                placeholder="Brand, weight, status..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label
                htmlFor="sales-search"
                className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
              >
                Search
              </label>
              <input
                id="sales-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transactions..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl"
              />
            </div>
          </div>
        </div>
      </div>

      {selectedSale && (
        <div className="bg-red-50/50 p-5 rounded-xl border-2 border-red-200 shadow-inner space-y-4">
          <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Modify Transaction Values
              </h3>
              <p className="text-[11px] text-slate-400">
                Sale ID: {selectedSale.sale_id}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSaleId(null)}
              className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              aria-label="Close override panel"
            >
              &times;
            </button>
          </div>
          <SaleForm
            compact
            showPaymentMethod={false}
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
              lpgTankVariant: selectedSale.lpg_tank_variant || "Regasco",
            }}
            submitLabel={saving ? "Saving..." : "Commit Entry Correction"}
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
              <th className="p-3">Customer LPG Tank</th>
              <th className="p-3 text-center">Qty</th>
              <th className="p-3 text-right">Unit Price</th>
              <th className="p-3 text-right">Total Billing</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
            {sales.map((sale) => (
              <tr
                key={sale.sale_id}
                className={
                  selectedSaleId === sale.sale_id
                    ? "bg-red-50"
                    : "hover:bg-slate-50/80"
                }
              >
                <td className="p-3">
                  {new Date(sale.date_created).toLocaleDateString("en-PH")}
                </td>
                <td className="p-3 font-bold text-slate-800">
                  {sale.customer_name}
                </td>
                <td className="p-3">
                  {sale.fb_name || (
                    <span className="text-slate-300 italic">-</span>
                  )}
                </td>
                <td className="p-3 font-mono text-xs">
                  {sale.phone_number || (
                    <span className="text-slate-300 italic">-</span>
                  )}
                </td>
                <td className="p-3">{sale.price_type}</td>
                <td className="p-3">
                  {sale.brand} - {sale.weight_class}kg - {sale.product_status}
                </td>
                <td className="p-3 font-semibold text-indigo-700">
                  {sale.lpg_tank_variant || (
                    <span className="text-slate-300 italic">-</span>
                  )}
                </td>
                <td className="p-3 text-center font-bold">
                  {sale.sale_quantity}
                </td>
                <td className="p-3 text-right">
                  {formatCurrency(sale.unit_price)}
                </td>
                <td className="p-3 text-right text-red-600 font-extrabold">
                  {formatCurrency(sale.total_amount)}
                </td>
                <td className="p-3 text-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setSelectedSaleId(sale.sale_id)}
                    className="text-xs font-bold bg-slate-100 hover:bg-slate-800 hover:text-white px-2 py-1 rounded-lg"
                  >
                    Override
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(sale)}
                    className="text-xs font-bold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-2 py-1 rounded-lg"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-8 text-slate-400">
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <Modal
          title="Delete Sale"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold"
              >
                Confirm Delete
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            Permanently delete this sale for{" "}
            <strong>{deleteTarget.customer_name}</strong>? Stock will be
            restored and all payment records will be removed.
          </p>
        </Modal>
      )}

      <RecordSaleModal
        open={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        onSuccess={loadData}
      />
      <RecordExpenseModal
        open={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        onSuccess={loadData}
      />
      {downloadModalOpen && (
        <DownloadSalesLogModal onClose={() => setDownloadModalOpen(false)} />
      )}
    </div>
  );
}
