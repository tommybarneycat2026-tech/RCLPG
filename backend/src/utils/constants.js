export const BRANDS = ['Regasco', 'Pryce', 'Seagas'];
export const WEIGHT_CLASSES = [2.7, 5, 11, 22, 50];
export const PRODUCT_STATUSES = ['Filled Tank', 'Empty Cylinder'];
export const HEALTH_INDICATORS = ['Good Stock', 'Low Stock', 'Out of Stock'];
export const SALE_STATUSES = ['Dropped', 'Active', 'Finished', 'Archived'];
export const PRICE_TYPES = ['Regular Retail', 'Wholesale'];
export const LOW_STOCK_THRESHOLD = 4;
export const PAYMENT_METHODS = ['Fully Paid', 'Credit'];
export const DEFAULT_EXPENSE_CATEGORIES = ['Truck Gas', 'Motor Gas', 'Foods', 'Gas Refill'];

export function computeHealthIndicator(stockQuantity) {
  if (stockQuantity <= 0) return 'Out of Stock';
  if (stockQuantity < 5) return 'Low Stock';
  return 'Good Stock';
}

export function getMidnightExpiry() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor(midnight.getTime() / 1000);
}

export function formatProductLabel(product) {
  const statusShort = product.status === 'Filled Tank' ? 'Filled' : 'Empty';
  return `${product.weight_class}kg [${statusShort}] - Stock: ${product.stock_quantity}`;
}

export function formatProductSpec(product) {
  return `${product.brand} - ${product.weight_class}kg - ${product.status}`;
}

export const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});
