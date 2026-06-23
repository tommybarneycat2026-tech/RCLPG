import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../api/client';

function productOptionLabel(product) {
  const statusShort = product.status === 'Filled Tank' ? 'Filled' : 'Empty';
  let prefix = '';
  if (product.stock_quantity === 0) prefix = '!! OUT !! ';
  else if (product.health_indicator === 'Low Stock') prefix = '[LOW] ';
  return `${prefix}(${product.weight_class}kg [${statusShort}] - Stock: ${product.stock_quantity})`;
}

export default function SaleForm({ customers, products, brands, onSubmit, initialValues, submitLabel = 'Save Sale', title = 'Record New Sale', description = 'Inventory base price loads automatically but can be edited manually', compact = false }) {
  const [mode, setMode] = useState(initialValues?.customerId ? 'existing' : 'existing');
  const [customerId, setCustomerId] = useState(initialValues?.customerId || '');
  const [customerName, setCustomerName] = useState(initialValues?.customerName || '');
  const [fbName, setFbName] = useState(initialValues?.fbName || '');
  const [phoneNumber, setPhoneNumber] = useState(initialValues?.phoneNumber || '');
  const [priceType, setPriceType] = useState(initialValues?.priceType || 'Regular Retail');
  const [brand, setBrand] = useState(initialValues?.brand || brands[0] || '');
  const [productId, setProductId] = useState(initialValues?.productId || '');
  const [quantity, setQuantity] = useState(initialValues?.quantity || 1);
  const [unitPrice, setUnitPrice] = useState(initialValues?.unitPrice || 0);

  const filteredProducts = useMemo(
    () => products.filter((p) => p.brand === brand && !p.is_archived),
    [products, brand]
  );

  const selectedProduct = products.find((p) => p.product_id === productId);

  useEffect(() => {
    if (!brand && brands.length) setBrand(brands[0]);
  }, [brand, brands]);

  useEffect(() => {
    if (filteredProducts.length && !filteredProducts.find((p) => p.product_id === productId)) {
      setProductId(filteredProducts[0].product_id);
    }
  }, [filteredProducts, productId]);

  useEffect(() => {
    if (!selectedProduct) return;
    const base = priceType === 'Regular Retail' ? selectedProduct.regular_retail : selectedProduct.wholesale_price;
    setUnitPrice(Number(base));
  }, [selectedProduct, priceType]);

  useEffect(() => {
    if (mode === 'existing' && customerId) {
      const customer = customers.find((c) => c.customer_id === customerId);
      if (customer) {
        setCustomerName(customer.name);
        setFbName(customer.fb_name || '');
        setPhoneNumber(customer.phone_number || '');
      }
    }
  }, [customerId, customers, mode]);

  const total = quantity * unitPrice;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      customerId: mode === 'existing' ? customerId : undefined,
      customerName,
      fbName,
      phoneNumber,
      priceType,
      productId,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
    });
  };

  return (
    <div className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 ${compact ? 'border-0 shadow-none p-0' : ''}`}>
      {!compact && (
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase text-slate-500">Customer Mode</legend>
          <label className="inline-flex items-center gap-2 mr-4 text-sm">
            <input type="radio" name="customerMode" checked={mode === 'existing'} onChange={() => setMode('existing')} />
            Existing Customer
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="radio" name="customerMode" checked={mode === 'new'} onChange={() => setMode('new')} />
            New Customer
          </label>
        </fieldset>

        {mode === 'existing' ? (
          <div>
            <label htmlFor="customer-select" className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Customer Name
            </label>
            <select
              id="customer-select"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full text-sm py-3 px-4 border border-slate-200 bg-white rounded-xl"
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="customer-name" className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Customer Name
            </label>
            <input id="customer-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required className="w-full text-sm p-3 border border-slate-200 rounded-xl" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="fb-name" className="block text-xs font-bold uppercase text-slate-500 mb-1">FB Name</label>
            <input id="fb-name" value={fbName} onChange={(e) => setFbName(e.target.value)} className="w-full text-sm p-3 border border-slate-200 rounded-xl" />
          </div>
          <div>
            <label htmlFor="phone" className="block text-xs font-bold uppercase text-slate-500 mb-1">Phone Number</label>
            <input id="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full text-sm p-3 border border-slate-200 rounded-xl" />
          </div>
        </div>

        <div>
          <label htmlFor="price-type" className="block text-xs font-bold uppercase text-slate-500 mb-1">Price Type</label>
          <select id="price-type" value={priceType} onChange={(e) => setPriceType(e.target.value)} className="w-full text-sm py-3 px-4 border border-slate-200 bg-white rounded-xl">
            <option value="Regular Retail">Regular Retail</option>
            <option value="Wholesale">Wholesale</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="brand" className="block text-xs font-bold uppercase text-slate-500 mb-1">Brand</label>
            <select id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full text-sm py-3 px-4 border border-slate-200 bg-white rounded-xl">
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="product" className="block text-xs font-bold uppercase text-slate-500 mb-1">Product Selection</label>
            <select id="product" value={productId} onChange={(e) => setProductId(e.target.value)} required className="w-full text-xs py-3 px-4 border border-slate-200 bg-white rounded-xl font-mono">
              {filteredProducts.map((p) => (
                <option key={p.product_id} value={p.product_id}>{productOptionLabel(p)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div>
            <label htmlFor="qty" className="block text-xs font-bold uppercase text-slate-500 mb-1">Quantity</label>
            <input id="qty" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="w-full text-sm p-2 border border-slate-200 rounded-lg text-center font-bold" />
          </div>
          <div>
            <label htmlFor="unit-price" className="block text-xs font-bold uppercase text-slate-500 mb-1">Unit Price (Editable)</label>
            <input id="unit-price" type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required className="w-full text-sm p-2 bg-amber-50 border border-amber-300 rounded-lg text-center font-bold" />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Bill Summary:</span>
          <span className="text-xl font-black text-red-600" aria-live="polite">{formatCurrency(total)}</span>
        </div>

        <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl shadow transition text-sm">
          {submitLabel}
        </button>
      </form>
    </div>
  );
}
