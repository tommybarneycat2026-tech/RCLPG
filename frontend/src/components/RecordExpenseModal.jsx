import { useEffect, useMemo, useState } from "react";
import { Autocomplete } from "@mantine/core";
import { api, formatCurrency } from "../api/client";
import { useToast } from "../context/ToastContext";
import Modal from "./Modal";

const DEFAULT_CATEGORIES = ["Truck Gas", "Motor Gas", "Foods", "Gas Refill"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(isoDate) {
  return new Date(isoDate).toLocaleDateString("en-PH", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function RecordExpenseModal({
  open,
  onClose,
  onSuccess,
  editingExpense = null,
}) {
  const { showToast } = useToast();
  const isEditing = Boolean(editingExpense);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [expense, setExpense] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmData, setConfirmData] = useState(null);
  const [saving, setSaving] = useState(false);
  const expenseDate = useMemo(
    () => (isEditing ? editingExpense.date : todayISO()),
    [open, isEditing, editingExpense],
  );

  useEffect(() => {
    if (!open) return;
    setExpense(editingExpense?.expenses || "");
    setAmount(editingExpense ? String(editingExpense.amount) : "");
    setConfirmData(null);
    api
      .getExpenseCategories()
      .then((res) =>
        setCategories(res.data?.length ? res.data : DEFAULT_CATEGORIES),
      )
      .catch(() => setCategories(DEFAULT_CATEGORIES));
  }, [open, editingExpense]);

  const handleReview = (e) => {
    e.preventDefault();
    const trimmed = expense.trim();
    const parsedAmount = Number(amount);

    if (!trimmed) {
      showToast(
        "Validation Error",
        "Please enter an expense category.",
        "error",
      );
      return;
    }
    if (amount === "" || Number.isNaN(parsedAmount) || parsedAmount < 0) {
      showToast(
        "Validation Error",
        "Please enter a valid non-negative amount.",
        "error",
      );
      return;
    }

    setConfirmData({
      expenses: trimmed,
      amount: parsedAmount,
      date: expenseDate,
    });
  };

  const commitExpense = async () => {
    if (!confirmData) return;
    try {
      setSaving(true);
      if (isEditing) {
        await api.updateExpense(editingExpense.expenses_id, confirmData);
        showToast(
          "Expense Updated",
          "The expense has been updated successfully.",
        );
      } else {
        await api.createExpense(confirmData);
        showToast(
          "Expense Saved",
          "The expense has been recorded successfully.",
        );
      }
      setConfirmData(null);
      onClose();
      onSuccess?.();
    } catch (err) {
      showToast("Save Failed", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <Modal
        title={isEditing ? "Edit Expense" : "Add Expense"}
        onClose={onClose}
      >
        <form onSubmit={handleReview} className="space-y-4">
          <div>
            <Autocomplete
              label="Expense"
              placeholder="Select or type expense"
              data={categories}
              value={expense}
              onChange={setExpense}
              limit={10}
              withAsterisk
              classNames={{
                label: "text-[11px] font-bold uppercase text-slate-500 mb-1",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="expense-amount"
              className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
            >
              Amount
            </label>
            <input
              id="expense-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "-" || e.key === "e") e.preventDefault();
              }}
              className="w-full text-sm p-2.5 border border-slate-200 rounded-xl"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label
              htmlFor="expense-date"
              className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
            >
              Date
            </label>
            <input
              id="expense-date"
              type="text"
              value={formatDisplayDate(expenseDate)}
              readOnly
              className="w-full text-sm p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-600 cursor-not-allowed"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold"
            >
              {isEditing ? "Review Changes" : "Review Expense"}
            </button>
          </div>
        </form>
      </Modal>

      {confirmData && (
        <Modal
          title={isEditing ? "Confirm Expense Update" : "Confirm Expense"}
          onClose={() => setConfirmData(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmData(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={commitExpense}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold"
              >
                {saving ? "Saving..." : "Confirm"}
              </button>
            </>
          }
        >
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-slate-500">Expense</dt>
              <dd className="font-semibold">{confirmData.expenses}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Amount</dt>
              <dd className="font-semibold text-red-600">
                {formatCurrency(confirmData.amount)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Date</dt>
              <dd>{formatDisplayDate(confirmData.date)}</dd>
            </div>
          </dl>
        </Modal>
      )}
    </>
  );
}
