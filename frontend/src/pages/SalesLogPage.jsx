import { useCallback, useEffect, useState } from "react";
import { api, formatCurrency } from "../api/client";
import { formatDateLocale } from "../utils/dates";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import SaleForm from "../components/SaleForm";
import RecordSaleModal from "../components/RecordSaleModal";
import RecordExpenseModal from "../components/RecordExpenseModal";
import DownloadSalesLogModal from "../components/DownloadSalesLogModal";
import Modal from "../components/Modal";
import { subscribeRealtime } from "../utils/realtime";

export default function SalesLogPage() {
  const { showToast } = useToast();
  const { isAdministrator } = useAuth();
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
  const [paymentEditTarget, setPaymentEditTarget] = useState(null);
  const [paymentDeleteTarget, setPaymentDeleteTarget] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [expenseFilter, setExpenseFilter] = useState("today");
  const [expenseStartDate, setExpenseStartDate] = useState("");
  const [expenseEndDate, setExpenseEndDate] = useState("");

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
      console.log(salesRes.data);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
    } catch (err) {
      showToast("Load Failed", err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [search, dateFilter, customerNameFilter, productFilter, showToast]);

  const loadExpenses = useCallback(async () => {
    try {
      const expenseParams = { limit: "100", quickFilter: expenseFilter };
      if (expenseFilter === "custom") {
        if (expenseStartDate) expenseParams.startDate = expenseStartDate;
        if (expenseEndDate) expenseParams.endDate = expenseEndDate;
      }
      const expensesRes = await api.getExpenses(expenseParams);
      setExpenses(expensesRes.data || []);
    } catch (err) {
      showToast("Expenses Load Failed", err.message, "error");
    }
  }, [expenseEndDate, expenseFilter, expenseStartDate, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    const unsubscribeSales = subscribeRealtime("sales:changed", () => {
      loadData();
    });
    const unsubscribeCredits = subscribeRealtime("credits:changed", () => {
      loadData();
    });
    const unsubscribeInventory = subscribeRealtime("inventory:changed", () => {
      loadData();
    });
    const unsubscribeExpenses = subscribeRealtime("expenses:changed", () => {
      loadExpenses();
    });

    return () => {
      unsubscribeSales();
      unsubscribeCredits();
      unsubscribeInventory();
      unsubscribeExpenses();
    };
  }, [loadData, loadExpenses]);

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

  const handlePaymentOverride = async () => {
    if (!paymentEditTarget) return;
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      showToast("Invalid Amount", "Enter a valid payment amount.", "error");
      return;
    }
    try {
      setSaving(true);
      await api.updateCreditPayment(paymentEditTarget.credit_id, amount);
      showToast("Payment Updated", "Credit payment updated successfully.");
      setPaymentEditTarget(null);
      setPaymentAmount("");
      await loadData();
    } catch (err) {
      showToast("Update Failed", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmPaymentDelete = async () => {
    if (!paymentDeleteTarget) return;
    try {
      setSaving(true);
      await api.deleteCreditPayment(paymentDeleteTarget.credit_id);
      showToast("Payment Deleted", "Credit payment removed successfully.");
      setPaymentDeleteTarget(null);
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
          {isAdministrator && (
            <button
              type="button"
              onClick={() => setDownloadModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl"
            >
              Download Sales Log
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          {isAdministrator && (
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
          )}

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

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Expense Overview</h3>
            <p className="text-[11px] text-slate-400">
              Review expenses for the selected time period.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={expenseFilter}
              onChange={(e) => setExpenseFilter(e.target.value)}
              className="text-xs p-2.5 border border-slate-200 rounded-xl"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="first_half">First Half (Jan-Jun)</option>
              <option value="second_half">Second Half (Jul-Dec)</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
            {expenseFilter === "custom" && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={expenseStartDate}
                  onChange={(e) => setExpenseStartDate(e.target.value)}
                  className="text-xs p-2.5 border border-slate-200 rounded-xl"
                />
                <input
                  type="date"
                  value={expenseEndDate}
                  onChange={(e) => setExpenseEndDate(e.target.value)}
                  className="text-xs p-2.5 border border-slate-200 rounded-xl"
                />
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-white border-b border-slate-200 text-slate-500 font-bold uppercase">
              <tr>
                <th className="p-3 text-center">Expense</th>
                <th className="p-3 text-center">Amount</th>
                <th className="p-3 text-center">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
              {expenses.map((item) => (
                <tr key={item.expenses_id}>
                  <td className="p-3 font-bold text-slate-800 text-center">
                    {item.expenses}
                  </td>
                  <td className="p-3 text-red-600 font-bold text-center">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="p-3 text-center">
                    {formatDateLocale(item.date)}
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-4 text-slate-400">
                    No expenses recorded for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdministrator && selectedSale && (
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
              filled: selectedSale.product_status === "Filled Tank",
              productId: selectedSale.product_id,
              quantity: selectedSale.sale_quantity,
              unitPrice: selectedSale.unit_price,
              lpgTankVariant: selectedSale.lpg_tank_variant || "",
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
              <th className="p-3">Product</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Type</th>
              <th className="p-3 text-center">Traded</th>
              <th className="p-3 text-center">Qty</th>
              <th className="p-3 text-right">Unit Price</th>
              <th className="p-3 text-right">Total Billing</th>  
              <th className="p-3 text-right">Balance Paid</th>
              {isAdministrator && <th className="p-3 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
            {sales.map((sale) => {
              const isPayment = sale.entry_type === "payment";
              return (
                <tr
                  key={`${sale.entry_type}-${sale.sale_id}-${sale.log_date}`}
                  className={
                    selectedSaleId === sale.sale_id
                      ? "bg-red-50"
                      : "hover:bg-slate-50/80"
                  }
                >
                  <td className="p-3">
                    {formatDateLocale(sale.log_date || sale.date_created || sale.date_paid)}
                  </td>
                  <td className="p-3">
                      {sale.weight_class}kg - {sale.brand}
                  </td>
                  <td className="p-3 font-bold text-slate-800 ">
                    {sale.customer_name}
                  </td>
                  <td className="p-3">
                    {isPayment ? "Credit Payment" : sale.payment_option}
                  </td>
                  <td className="p-3 font-semibold text-indigo-700 text-center">
                      {sale.lpg_tank_variant}
                  </td>
                  <td className="p-3 text-center font-bold">
                    {
                      isPayment ? " " : sale.sale_quantity
                    }
                  </td>
                  <td className="p-3 text-center">
                    {isPayment ? "" : formatCurrency(sale.unit_price)}
                  </td>
                  <td className="p-3 text-center text-red-600 font-extrabold">
                    {isPayment ? formatCurrency(sale.balance_paid || 0) : formatCurrency(sale.total_amount)}
                  </td>
                  <td className="p-3 text-center font-semibold text-slate-700">
                  {sale.payment_option === "Fully Paid"
                    ? `Fully Paid`
                    : formatCurrency(sale.balance_paid || 0)}
                </td>
                  {isAdministrator && (
                    <td className="p-3 text-center space-x-1">
                      {!isPayment && (
                        <>
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
                        </>
                      )}
                      {isPayment && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentEditTarget(sale);
                              setPaymentAmount(sale.balance_paid || "");
                            }}
                            className="text-xs font-bold bg-slate-100 hover:bg-slate-800 hover:text-white px-2 py-1 rounded-lg"
                          >
                            Override
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentDeleteTarget(sale)}
                            className="text-xs font-bold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-2 py-1 rounded-lg"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {sales.length === 0 && (
              <tr>
                <td
                  colSpan={isAdministrator ? 11 : 10}
                  className="text-center py-8 text-slate-400"
                >
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdministrator && deleteTarget && (
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

      {isAdministrator && paymentEditTarget && (
        <Modal
          title="Override Payment"
          onClose={() => setPaymentEditTarget(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setPaymentEditTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handlePaymentOverride}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold"
              >
                {saving ? "Saving..." : "Save Payment"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase text-slate-500">
              Payment Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full text-sm p-3 border border-slate-200 rounded-xl"
            />
          </div>
        </Modal>
      )}

      {isAdministrator && paymentDeleteTarget && (
        <Modal
          title="Delete Payment"
          onClose={() => setPaymentDeleteTarget(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setPaymentDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmPaymentDelete}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold"
              >
                Confirm Delete
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            Delete this payment record for <strong>{paymentDeleteTarget.customer_name}</strong>? The sale itself will remain unchanged and remaining credit will be recalculated.
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
        onSuccess={() => {
          loadData();
          loadExpenses();
        }}
      />
      {downloadModalOpen && (
        <DownloadSalesLogModal onClose={() => setDownloadModalOpen(false)} />
      )}
    </div>
  );
}
