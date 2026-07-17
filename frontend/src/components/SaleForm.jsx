import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../api/client";
import { useToast } from "../context/ToastContext";
import { Select } from "@mantine/core";


function formatDateLabel(dateValue) {
  if (!dateValue) return "Unknown date";

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";

  return parsed.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatWeightClassLabel(weightClass) {
  const normalized = Number(weightClass);
  const displayValue = Number.isInteger(normalized)
    ? `${normalized}`
    : normalized.toFixed(1).replace(/\.0$/, "");

  return `Weight - ${displayValue} kg`;
}

function productOptionLabel(product) {
  const createdAtLabel = formatDateLabel(product.created_at);

  if (Number(product.stock_quantity) === 0) {
    return `OUT OF STOCK! - ${createdAtLabel}`;
  }

  const isLowStock = product.health_indicator === "Low Stock";
  const healthLabel = isLowStock ? "LOW!" : "";
  return `${healthLabel} Stock: ${product.stock_quantity} - ${createdAtLabel}`;
}

export default function SaleForm({
  customers,
  products,
  brands,
  onSubmit,
  initialValues,
  submitLabel = "Save Sale",
  title = "Record New Sale",
  description = "Inventory base price loads automatically but can be edited manually",
  compact = false,
  showPaymentMethod = true,
}) {
  const { showToast } = useToast();
  const [mode, setMode] = useState(
    initialValues?.customerId ? "existing" : "existing",
  );
  const [customerId, setCustomerId] = useState(initialValues?.customerId || "");
  const [customerName, setCustomerName] = useState(
    initialValues?.customerName || "",
  );
  const [fbName, setFbName] = useState(initialValues?.fbName || "");
  const [phoneNumber, setPhoneNumber] = useState(
    initialValues?.phoneNumber || "",
  );
  const [priceType, setPriceType] = useState(
    initialValues?.priceType || "Regular Retail",
  );
  const [paymentMethod, setPaymentMethod] = useState(
    initialValues?.paymentMethod || "Fully Paid",
  );
  const [initialPayment, setInitialPayment] = useState(
    initialValues?.initialPayment ?? "",
  );
  const [brand, setBrand] = useState(initialValues?.brand || brands[0] || "");
  const [isFilled, setIsFilled] = useState(initialValues?.isFilled ?? true);
  const [purchaseTank, setPurchaseTank] = useState(
    initialValues?.purchaseTank ?? false,
  );
  const [productId, setProductId] = useState(initialValues?.productId || "");
  const [quantity, setQuantity] = useState(initialValues?.quantity || 1);
  const [unitPrice, setUnitPrice] = useState(initialValues?.unitPrice || 0);
  const [lpgTankVariant, setLpgTankVariant] = useState(
    initialValues?.lpgTankVariant || brands[0] || "Regasco",
  );

  const productStatus = isFilled ? "Filled Tank" : "Empty Cylinder";

  const filteredProducts = useMemo(() => {
    const matchedProducts = products.filter(
      (p) => p.status === productStatus && p.brand === brand,
    );

    const groupedProducts = new Map();
    matchedProducts.forEach((product) => {
      const group = groupedProducts.get(product.weight_class) || [];
      group.push(product);
      groupedProducts.set(product.weight_class, group);
    });

    return Array.from(groupedProducts.entries())
      .sort(([left], [right]) => Number(left) - Number(right))
      .flatMap(([, productsForWeight]) => {
        const sortedProducts = [...productsForWeight].sort(
          (left, right) =>
            new Date(left.created_at) - new Date(right.created_at),
        );

        if (sortedProducts.length === 1) {
          return sortedProducts;
        }

        let firstAvailableIndex = -1;
        for (let index = 0; index < sortedProducts.length; index += 1) {
          if (Number(sortedProducts[index].stock_quantity) > 0) {
            firstAvailableIndex = index;
            break;
          }
        }

        if (firstAvailableIndex === -1) {
          return sortedProducts.slice(-1);
        }

        return sortedProducts.slice(firstAvailableIndex);
      });
  }, [products, productStatus, brand]);

  const groupedProductOptions = useMemo(() => {
    const grouped = new Map();

    filteredProducts.forEach((product) => {
      const groupLabel = formatWeightClassLabel(product.weight_class);
      const groupItems = grouped.get(groupLabel) || [];
      groupItems.push({
        value: product.product_id,
        label: productOptionLabel(product),
      });
      grouped.set(groupLabel, groupItems);
    });

    return Array.from(grouped.entries()).map(([groupLabel, options]) => ({
      groupLabel,
      options,
    }));
  }, [filteredProducts]);

  // Searchable customer list: dedupe by name (case-insensitive) so
  // customers with multiple historical records only appear once, sorted
  // alphabetically. Mantine's Select performs case-insensitive partial
  // matching as the user types.
  const customerOptions = useMemo(() => {
    const seen = new Map();
    customers.forEach((c) => {
      const key = c.name?.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.set(key, { value: c.customer_id, label: c.name });
      }
    });
    return Array.from(seen.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [customers]);

  const selectedProduct = filteredProducts.find(
    (p) => p.product_id === productId,
  );
  const shouldEnableLpgField = !purchaseTank && isFilled;
  const customerLpgValue = shouldEnableLpgField ? lpgTankVariant : "N/A";

  useEffect(() => {
    if (!brand && brands.length) setBrand(brands[0]);
  }, [brand, brands]);

  useEffect(() => {
    if (filteredProducts.length) {
      if (!filteredProducts.find((p) => p.product_id === productId)) {
        setProductId(filteredProducts[0].product_id);
      }
      return;
    }

    setProductId("");
    setUnitPrice(0);
  }, [filteredProducts, productId]);

  useEffect(() => {
    if (!selectedProduct) return;
    const base =
      priceType === "Regular Retail"
        ? selectedProduct.regular_retail
        : selectedProduct.wholesale_price;
    setUnitPrice(Number(base));
  }, [selectedProduct, priceType]);

  useEffect(() => {
    if (mode === "existing" && customerId) {
      const customer = customers.find((c) => c.customer_id === customerId);
      if (customer) {
        setCustomerName(customer.name);
        setFbName(customer.fb_name || "");
        setPhoneNumber(customer.phone_number || "");
      }
    }
  }, [customerId, customers, mode]);

  const total = quantity * unitPrice;

  const handleSubmit = (e) => {
    e.preventDefault();
    // Mantine's Select doesn't reliably enforce native HTML5 "required"
    // validation, so guard explicitly before submitting.
    if (mode === "existing" && !customerId) {
      showToast("Validation Error", "Please select a customer.", "error");
      return;
    }
    onSubmit({
      customerId: mode === "existing" ? customerId : undefined,
      customerName,
      fbName,
      phoneNumber,
      priceType,
      paymentMethod: showPaymentMethod ? paymentMethod : "Fully Paid",
      initialPayment:
        paymentMethod === "Credit" ? Number(initialPayment) || 0 : undefined,
      productId,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      isFilled,
      purchaseTank,
      brand,
      lpgTankVariant: shouldEnableLpgField ? lpgTankVariant : undefined,
    });
  };

  return (
    <div
      className={`bg-white rounded-xl space-y-4 ${compact ? "" : "p-6 border border-slate-200 shadow-sm"}`}
    >
      {!compact && (
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase text-slate-500">
            Customer Mode
          </legend>
          <label className="inline-flex items-center gap-2 mr-4 text-sm">
            <input
              type="radio"
              name="customerMode"
              checked={mode === "existing"}
              onChange={() => setMode("existing")}
            />
            Existing Customer
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="customerMode"
              checked={mode === "new"}
              onChange={() => setMode("new")}
            />
            New Customer
          </label>
        </fieldset>

        {mode === "existing" ? (
          <div>
            <Select
              id="customer-select"
              label="Customer Name"
              placeholder="Search or select a customer..."
              data={customerOptions}
              value={customerId || null}
              onChange={(value) => setCustomerId(value || "")}
              searchable
              nothingFoundMessage="No matching customers"
              required
              classNames={{
                label: "text-xs font-bold uppercase text-slate-500 mb-1",
              }}
            />
          </div>
        ) : (
          <div>
            <label
              htmlFor="customer-name"
              className="block text-xs font-bold uppercase text-slate-500 mb-1"
            >
              Customer Name
            </label>
            <input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              className="w-full text-sm p-3 border border-slate-200 rounded-xl"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="fb-name"
              className="block text-xs font-bold uppercase text-slate-500 mb-1"
            >
              FB Name
            </label>
            <input
              id="fb-name"
              value={fbName}
              onChange={(e) => setFbName(e.target.value)}
              className="w-full text-sm p-3 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label
              htmlFor="phone"
              className="block text-xs font-bold uppercase text-slate-500 mb-1"
            >
              Phone Number
            </label>
            <input
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full text-sm p-3 border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="price-type"
            className="block text-xs font-bold uppercase text-slate-500 mb-1"
          >
            Price Type
          </label>
          <select
            id="price-type"
            value={priceType}
            onChange={(e) => setPriceType(e.target.value)}
            className="w-full text-sm py-3 px-4 border border-slate-200 bg-white rounded-xl"
          >
            <option value="Regular Retail">Consumer Price</option>
            <option value="Wholesale">Retail Price</option>
          </select>
        </div>

        {showPaymentMethod && (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="payment-method"
                className="block text-xs font-bold uppercase text-slate-500 mb-1"
              >
                Payment Method
              </label>
              <select
                id="payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full text-sm py-3 px-4 border border-slate-200 bg-white rounded-xl"
              >
                <option value="Fully Paid">Fully Paid</option>
                <option value="Credit">Credit</option>
              </select>
            </div>
            {paymentMethod === "Credit" && (
              <div>
                <label
                  htmlFor="initial-payment"
                  className="block text-xs font-bold uppercase text-slate-500 mb-1"
                >
                  Initial Payment{" "}
                  <span className="font-normal normal-case text-slate-400">
                    (optional)
                  </span>
                </label>
                <input
                  id="initial-payment"
                  type="number"
                  step="0.01"
                  min="0"
                  max={total}
                  value={initialPayment}
                  onChange={(e) => setInitialPayment(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-sm p-3 border border-slate-200 rounded-xl"
                />
              </div>
            )}
          </div>
        )}

        <fieldset className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <legend className="text-xs font-bold uppercase text-slate-500">
            Tank Type
          </legend>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isFilled}
                onChange={(e) => setIsFilled(e.target.checked)}
              />
              Filled
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={purchaseTank}
                onChange={(e) => setPurchaseTank(e.target.checked)}
              />
              Purchase Tank
            </label>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="brand"
              className="block text-xs font-bold uppercase text-slate-500 mb-1"
            >
              Brand (Filled Tank Sold)
            </label>
            <select
              id="brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full text-sm py-3 px-4 border border-slate-200 bg-white rounded-xl"
            >
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="product"
              className="block text-xs font-bold uppercase text-slate-500 mb-1"
            >
              Product Selection
            </label>
            <select
              id="product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="w-full text-xs py-3 px-4 border border-slate-200 bg-white rounded-xl font-mono"
            >
              <option value="" disabled>
                Select a batch
              </option>
              {groupedProductOptions.map(({ groupLabel, options }) => (
                <optgroup key={groupLabel} label={groupLabel}>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div>
            <label
              htmlFor="qty"
              className="block text-xs font-bold uppercase text-slate-500 mb-1"
            >
              Quantity
            </label>
            <input
              id="qty"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="w-full text-sm p-2 border border-slate-200 rounded-lg text-center font-bold"
            />
          </div>
          <div>
            <label
              htmlFor="unit-price"
              className="block text-xs font-bold uppercase text-slate-500 mb-1"
            >
              Unit Price
            </label>
            <input
              id="unit-price"
              type="number"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              required
              className="w-full text-sm p-2 bg-amber-50 border border-amber-300 rounded-lg text-center font-bold"
            />
          </div>
        </div>

        <fieldset className="space-y-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
          <legend className="text-xs font-bold uppercase text-indigo-700 px-1">
            Customer LPG Tank
          </legend>
          <p className="text-[11px] text-slate-500">
            Brand of the empty cylinder returned by the customer (same weight as
            filled tank sold)
          </p>
          <div>
            <label
              htmlFor="customer-lpg"
              className="block text-xs font-bold uppercase text-slate-500 mb-1"
            >
              Customer LPG
            </label>
            <select
              id="customer-lpg"
              value={customerLpgValue}
              onChange={(e) => setLpgTankVariant(e.target.value)}
              required={shouldEnableLpgField}
              disabled={!shouldEnableLpgField}
              className="w-full text-sm py-3 px-4 border border-slate-200 bg-white rounded-xl disabled:bg-slate-100 disabled:text-slate-500"
            >
              {shouldEnableLpgField ? (
                brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))
              ) : (
                <option value="N/A">N/A</option>
              )}
            </select>
          </div>
        </fieldset>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Total Bill Summary:
          </span>
          <span className="text-xl font-black text-red-600" aria-live="polite">
            {formatCurrency(total)}
          </span>
        </div>

        <button
          type="submit"
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl shadow transition text-sm"
        >
          {submitLabel}
        </button>
      </form>
    </div>
  );
}
