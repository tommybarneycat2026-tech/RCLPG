import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatCurrency } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import RecordSaleModal from "../components/RecordSaleModal";
import RecordExpenseModal from "../components/RecordExpenseModal";
import SalesReportSection from "../components/SalesReportSection";
import BrandInventoryOverview from "../components/BrandInventoryOverview";
import Modal from "../components/Modal";

export default function DashboardPage() {
  const { showToast } = useToast();
  const { isAdministrator } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseDeleteTarget, setExpenseDeleteTarget] = useState(null);
  const [deletingExpense, setDeletingExpense] = useState(false);
  const [dailyExpenses, setDailyExpenses] = useState([]);
  const [reportRefreshKey, setReportRefreshKey] = useState(0);

  const loadData = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const [metricsRes, salesRes, expensesRes] = await Promise.all([
          api.getMetrics(),
          api.getSales({ todayOnly: "true", page: String(page), limit: "10" }),
          api.getExpenses({ todayOnly: "true", limit: "100" }),
        ]);
        setMetrics(metricsRes.data);
        setRecentSales(salesRes.data);
        setPagination(salesRes.pagination);
        setDailyExpenses(expensesRes.data);
      } catch (err) {
        showToast("Load Failed", err.message, "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaleSuccess = () => {
    loadData(pagination.page);
    setReportRefreshKey((k) => k + 1);
  };

  const handleExpenseSuccess = () => {
    loadData(pagination.page);
    setReportRefreshKey((k) => k + 1);
  };

  const openEditExpense = (item) => {
    setEditingExpense(item);
    setExpenseModalOpen(true);
  };

  const closeExpenseModal = () => {
    setExpenseModalOpen(false);
    setEditingExpense(null);
  };

  const confirmDeleteExpense = async () => {
    if (!expenseDeleteTarget) return;
    try {
      setDeletingExpense(true);
      await api.deleteExpense(expenseDeleteTarget.expenses_id);
      showToast("Expense Deleted", "The expense has been removed.");
      setExpenseDeleteTarget(null);
      loadData(pagination.page);
      setReportRefreshKey((k) => k + 1);
    } catch (err) {
      showToast("Delete Failed", err.message, "error");
    } finally {
      setDeletingExpense(false);
    }
  };

  if (loading && !metrics) return <LoadingSpinner />;

  const lowStock = metrics?.lowStockProducts || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <article className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Items Sold
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {metrics?.totalItemsSold || 0} Items
          </p>
        </article>
        <article className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Filled Stock
          </p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">
            {metrics?.totalFilledStock || 0} Tanks
          </p>
        </article>
        <article className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Empty Stock
          </p>
          <p className="text-2xl font-bold text-slate-500 mt-1">
            {metrics?.totalEmptyStock || 0} Cylinders
          </p>
        </article>
      </div>

      <BrandInventoryOverview refreshKey={reportRefreshKey} />

      {lowStock.length > 0 && (
        <div
          className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3 shadow-sm"
          role="alert"
        >
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800">
            Low Stock Reminder
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs font-semibold text-amber-900">
            {lowStock.map((item) => (
              <div
                key={item.product_id}
                className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-sm flex items-center justify-between"
              >
                <div>
                  <span className="font-mono font-bold block text-slate-900">
                    {item.product_id}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {item.brand} {item.weight_class}kg [
                    {item.status === "Filled Tank" ? "Filled" : "Empty"}]
                  </span>
                </div>
                <span
                  className={`px-2 py-1 rounded text-[10px] font-black tracking-wider ${item.health_indicator === "Out of Stock" ? "bg-red-600 text-white" : "bg-amber-600 text-white"}`}
                >
                  {item.health_indicator === "Out of Stock" ? "OUT" : "LOW"} (
                  {item.stock_quantity})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => setExpenseModalOpen(true)}
          className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm px-6 py-3 rounded-xl shadow transition"
        >
          Add Expenses
        </button>
        <button
          type="button"
          onClick={() => setSaleModalOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-6 py-3 rounded-xl shadow transition"
        >
          Record New Sale
        </button>
      </div>

      {isAdministrator && <SalesReportSection refreshKey={reportRefreshKey} />}

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-900">Expenses</h2>
          <p className="text-xs text-slate-400">
            Today&apos;s recorded expenses
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
              <tr>
                <th className="p-3 text-center">Expense</th>
                <th className="p-3 text-center">Amount</th>
                <th className="p-3 text-center">Date</th>
                {isAdministrator && (
                  <th className="p-3 text-center">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
              {dailyExpenses.map((item) => (
                <tr key={item.expenses_id}>
                  <td className="p-3 font-bold text-slate-800 text-center">
                    {item.expenses}
                  </td>
                  <td className="p-3 text-red-600 font-bold text-center">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="p-3 text-center">
                    {new Date(item.date).toLocaleDateString("en-PH")}
                  </td>
                  {isAdministrator && (
                    <td className="p-3 text-center space-x-1">
                      <button
                        type="button"
                        onClick={() => openEditExpense(item)}
                        className="text-xs font-bold bg-amber-100 hover:bg-amber-500 hover:text-white px-2.5 py-1 rounded-lg"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpenseDeleteTarget(item)}
                        className="text-xs font-bold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-2.5 py-1 rounded-lg"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {dailyExpenses.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdministrator ? 4 : 3}
                    className="text-center py-4 text-slate-400"
                  >
                    No expenses recorded today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Recent Sales Entries
            </h2>
            <p className="text-xs text-slate-400">
              Today&apos;s sales — 10 entries per page
            </p>
          </div>
          <Link
            to="/sales-log"
            className="text-xs font-bold text-red-600 hover:underline"
          >
            View Full Log &rarr;
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
              <tr>
                <th className="p-3">Customer</th>
                <th className="p-3">Product Details</th>
                <th className="p-3">Customer LPG</th>
                <th className="p-3 text-center">Qty</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
              {recentSales.map((sale) => (
                <tr key={sale.sale_id}>
                  <td className="p-3 font-bold text-slate-800">
                    {sale.customer_name}
                  </td>
                  <td className="p-3">
                    {sale.brand} - {sale.weight_class}kg - {sale.product_status}
                  </td>
                  <td className="p-3">{sale.lpg_tank_variant || "-"}</td>
                  <td className="p-3 text-center font-bold">
                    {sale.sale_quantity}
                  </td>
                  <td className="p-3 text-right text-red-600 font-bold">
                    {formatCurrency(sale.total_amount)}
                  </td>
                </tr>
              ))}
              {recentSales.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-slate-400">
                    No sales recorded today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pagination.totalPages > 1 && (
          <nav
            className="flex justify-end gap-2"
            aria-label="Recent sales pagination"
          >
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

      <RecordSaleModal
        open={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        onSuccess={handleSaleSuccess}
      />
      <RecordExpenseModal
        open={expenseModalOpen}
        onClose={closeExpenseModal}
        onSuccess={handleExpenseSuccess}
        editingExpense={editingExpense}
      />

      {isAdministrator && expenseDeleteTarget && (
        <Modal
          title="Delete Expense"
          onClose={() => setExpenseDeleteTarget(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setExpenseDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingExpense}
                onClick={confirmDeleteExpense}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold"
              >
                {deletingExpense ? "Deleting..." : "Confirm Delete"}
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            Permanently delete the{" "}
            <strong>{expenseDeleteTarget.expenses}</strong> expense of{" "}
            {formatCurrency(expenseDeleteTarget.amount)}?
          </p>
        </Modal>
      )}
    </div>
  );
}
