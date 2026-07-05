import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatCurrency } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import BrandAutocomplete from "../components/BrandAutocomplete";
import BrandInventoryOverview from "../components/BrandInventoryOverview";

const FALLBACK_BRANDS = ["Regasco", "Seagas", "Pryce"];
const WEIGHTS = [2.7, 5, 11, 22, 50];
const STATUSES = ["Filled Tank", "Empty Cylinder"];

const emptyForm = {
  brand: "Regasco",
  weightClass: 11,
  status: "Filled Tank",
  stockQuantity: 0,
  regularRetail: "",
  wholesalePrice: "",
  initialPrice: "",
};

function healthBadgeClass(indicator) {
  if (indicator === "Out of Stock") return "bg-red-50 text-red-700";
  if (indicator === "Low Stock") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function InventoryTable({ products, onEdit, onDelete, isAdmin }) {
  if (!products.length) {
    return (
      <p className="text-xs text-slate-400 italic py-3">
        No products match the current filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-100 rounded-xl">
      <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
          <tr>
            <th className="p-3">Weight</th>
            <th className="p-3 text-center">Stock</th>
            <th className="p-3 text-center">Health Status</th>
            {isAdmin && <th className="p-3 text-center">Original Price</th>}
            <th className="p-3 text-center">Consumer Price</th>
            <th className="p-3 text-center">Retail Price</th>
            {isAdmin && <th className="p-3 text-center">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
          {products.map((p) => (
            <tr key={p.product_id}>
              <td className="p-3 font-bold">{p.weight_class}kg</td>
              <td className="p-3 text-center font-black">{p.stock_quantity}</td>
              <td className="p-3 text-center">
                <span
                  className={`inline-flex px-2.5 py-1 rounded-full text-xs font-black uppercase ${healthBadgeClass(p.health_indicator)}`}
                >
                  {p.health_indicator}
                </span>
              </td>
              {isAdmin && (
                <td className="p-3 text-center text-slate-500">
                  {formatCurrency(p.initial_price)}
                </td>
              )}
              <td className="p-3 text-center">
                {formatCurrency(p.regular_retail)}
              </td>
              <td className="p-3 text-center text-red-600">
                {formatCurrency(p.wholesale_price)}
              </td>
              {isAdmin && (
                <td className="p-3 text-center space-x-1">
                  <button
                    type="button"
                    onClick={() => onEdit(p)}
                    className="text-xs font-bold bg-amber-100 hover:bg-amber-500 hover:text-white px-2.5 py-1 rounded-lg"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(p)}
                    className="text-xs font-bold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-2.5 py-1 rounded-lg"
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <hr />
    </div>
  );
}

export default function InventoryPage() {
  const { showToast } = useToast();
  const { isAdministrator } = useAuth();
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState(FALLBACK_BRANDS);
  const [brandFilter, setBrandFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [stockTierFilter, setStockTierFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editProduct, setEditProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (brandFilter) params.brand = brandFilter;
      if (conditionFilter) params.condition = conditionFilter;
      if (stockTierFilter) params.stockTier = stockTierFilter;
      const [productsRes, brandsRes] = await Promise.all([
        api.getProducts(params),
        api.getBrands(),
      ]);
      setProducts(productsRes.data);
      setBrands(brandsRes.data?.length ? brandsRes.data : FALLBACK_BRANDS);
    } catch (err) {
      showToast("Load Failed", err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [brandFilter, conditionFilter, stockTierFilter, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groupedByBrand = useMemo(() => {
    const groups = {};
    brands.forEach((b) => {
      groups[b] = {
        filled: products.filter(
          (p) => p.brand === b && p.status === "Filled Tank",
        ),
        empty: products.filter(
          (p) => p.brand === b && p.status === "Empty Cylinder",
        ),
      };
    });
    return groups;
  }, [products, brands]);

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
        initialPrice: Number(form.initialPrice),
      });
      showToast("Record Created", "Product saved successfully.");
      setForm(emptyForm);
      setAddModalOpen(false);
      await loadData();
      setInventoryRefreshKey((k) => k + 1);
    } catch (err) {
      showToast("Save Failed", err.message, "error");
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
        initialPrice: Number(editProduct.initial_price),
      });
      showToast("Updated", "Product record updated.");
      setEditProduct(null);
      await loadData();
      setInventoryRefreshKey((k) => k + 1);
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
      await api.deleteProduct(deleteTarget.product_id);
      showToast("Deleted", "Product permanently removed.");
      setDeleteTarget(null);
      await loadData();
      setInventoryRefreshKey((k) => k + 1);
    } catch (err) {
      showToast("Delete Failed", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !products.length) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <BrandInventoryOverview refreshKey={inventoryRefreshKey} />

      <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <h2 className="text-base font-bold text-slate-900">
            Quick Catalog Interactive Filters
          </h2>
          <p className="text-xs text-slate-400">All filters work together</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="brand-filter"
              className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
            >
              Brand
            </label>
            <select
              id="brand-filter"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="condition-filter"
              className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
            >
              Tank Condition
            </label>
            <select
              id="condition-filter"
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl"
            >
              <option value="">All Conditions</option>
              <option value="filled">Filled Tanks</option>
              <option value="empty">Empty Cylinders</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="stock-filter"
              className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
            >
              Live Stock Warning Tier
            </label>
            <select
              id="stock-filter"
              value={stockTierFilter}
              onChange={(e) => setStockTierFilter(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl"
            >
              <option value="">All Stocks</option>
              <option value="out">Out of Stock</option>
              <option value="low">Low Stock (&lt;5)</option>
              <option value="good">Good Stock (&gt;5)</option>
            </select>
          </div>
        </div>
      </section>

      {isAdministrator && (
        <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Catalog Action Controls
            </h2>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl"
            >
              Add New Product
            </button>
          </div>
        </section>
      )}

      {brands.map((brand) => {
        const { filled, empty } = groupedByBrand[brand];
        if (!filled.length && !empty.length) return null;

        return (
          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-8">
            <div key={brand} className="space-y-4">
              <h3 className="text-base font-black text-slate-800 border-l-4 border-red-600 pl-3">
                {brand} Inventory Holdings
              </h3>
              {filled.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-indigo-600 tracking-wider">
                    Filled Cylinders
                  </h4>
                  <InventoryTable
                    products={filled}
                    onEdit={setEditProduct}
                    onDelete={setDeleteTarget}
                    isAdmin={isAdministrator}
                  />
                </div>
              )}
              {empty.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                    Empty Cylinders
                  </h4>
                  <InventoryTable
                    products={empty}
                    onEdit={setEditProduct}
                    onDelete={setDeleteTarget}
                    isAdmin={isAdministrator}
                  />
                </div>
              )}
              <hr />
            </div>
            {products.length === 0 && (
              <p className="text-center text-slate-400 py-8">
                No inventory matches the selected filters.
              </p>
            )}
          </section>
        );
      })}

      {isAdministrator && addModalOpen && (
        <Modal
          title="Add New Product"
          onClose={() => setAddModalOpen(false)}
          size="lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-product-form"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold"
              >
                {saving ? "Saving..." : "Save Product Record"}
              </button>
            </>
          }
        >
          <form
            id="add-product-form"
            onSubmit={handleCreate}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <BrandAutocomplete
                  id="brand"
                  value={form.brand}
                  onChange={(value) => setForm({ ...form, brand: value })}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="weight"
                  className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
                >
                  Weight Class
                </label>
                <select
                  id="weight"
                  value={form.weightClass}
                  onChange={(e) =>
                    setForm({ ...form, weightClass: e.target.value })
                  }
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl"
                >
                  {WEIGHTS.map((w) => (
                    <option key={w} value={w}>
                      {w}kg
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="status"
                  className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
                >
                  Gas Status
                </label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl"
                >
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="stock"
                  className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
                >
                  Stock Quantity
                </label>
                <input
                  id="stock"
                  type="number"
                  min="0"
                  value={form.stockQuantity}
                  onChange={(e) =>
                    setForm({ ...form, stockQuantity: e.target.value })
                  }
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl font-bold"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label
                  htmlFor="initial"
                  className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
                >
                  Initial Price
                </label>
                <input
                  id="initial"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.initialPrice}
                  onChange={(e) =>
                    setForm({ ...form, initialPrice: e.target.value })
                  }
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl"
                  placeholder="Acquisition cost"
                />
              </div>
              <div>
                <label
                  htmlFor="retail"
                  className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
                >
                  Regular Retail Price
                </label>
                <input
                  id="retail"
                  type="number"
                  step="0.01"
                  required
                  value={form.regularRetail}
                  onChange={(e) =>
                    setForm({ ...form, regularRetail: e.target.value })
                  }
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label
                  htmlFor="wholesale"
                  className="block text-[11px] font-bold uppercase text-slate-500 mb-1"
                >
                  Wholesale Price
                </label>
                <input
                  id="wholesale"
                  type="number"
                  step="0.01"
                  required
                  value={form.wholesalePrice}
                  onChange={(e) =>
                    setForm({ ...form, wholesalePrice: e.target.value })
                  }
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {isAdministrator && editProduct && (
        <Modal
          title={`Edit Product ${editProduct.product_id}`}
          onClose={() => setEditProduct(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditProduct(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleUpdate}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold"
              >
                Save Changes
              </button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="space-y-1 col-span-2">
              <BrandAutocomplete
                value={editProduct.brand}
                onChange={(value) =>
                  setEditProduct({ ...editProduct, brand: value })
                }
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">
                Weight
              </span>
              <select
                value={editProduct.weight_class}
                onChange={(e) =>
                  setEditProduct({
                    ...editProduct,
                    weight_class: e.target.value,
                  })
                }
                className="w-full p-2 border rounded-lg"
              >
                {WEIGHTS.map((w) => (
                  <option key={w} value={w}>
                    {w}kg
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">
                Status
              </span>
              <select
                value={editProduct.status}
                onChange={(e) =>
                  setEditProduct({ ...editProduct, status: e.target.value })
                }
                className="w-full p-2 border rounded-lg"
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">
                Stock
              </span>
              <input
                type="number"
                min="0"
                value={editProduct.stock_quantity}
                onChange={(e) =>
                  setEditProduct({
                    ...editProduct,
                    stock_quantity: e.target.value,
                  })
                }
                className="w-full p-2 border rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">
                Initial Price
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editProduct.initial_price}
                onChange={(e) =>
                  setEditProduct({
                    ...editProduct,
                    initial_price: e.target.value,
                  })
                }
                className="w-full p-2 border rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">
                Regular Retail
              </span>
              <input
                type="number"
                step="0.01"
                value={editProduct.regular_retail}
                onChange={(e) =>
                  setEditProduct({
                    ...editProduct,
                    regular_retail: e.target.value,
                  })
                }
                className="w-full p-2 border rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">
                Wholesale
              </span>
              <input
                type="number"
                step="0.01"
                value={editProduct.wholesale_price}
                onChange={(e) =>
                  setEditProduct({
                    ...editProduct,
                    wholesale_price: e.target.value,
                  })
                }
                className="w-full p-2 border rounded-lg"
              />
            </label>
          </div>
        </Modal>
      )}

      {isAdministrator && deleteTarget && (
        <Modal
          title="Delete Product"
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
            Permanently delete product{" "}
            <strong>{deleteTarget.product_id}</strong> ({deleteTarget.brand}{" "}
            {deleteTarget.weight_class}kg)? This action cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
