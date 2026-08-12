import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { getManilaTodayISO } from "../utils/timezone.js";

export function buildLocationSummaryRows(rows = []) {
  const locationTotals = new Map();

  for (const row of rows || []) {
    if (String(row.entry_type || "").toLowerCase() === "payment") {
      continue;
    }

    const location = String(row.location || "").trim();
    if (!location) {
      continue;
    }

    const unitsSold = Number(row.sale_quantity ?? 0);
    if (!Number.isFinite(unitsSold) || unitsSold <= 0) {
      continue;
    }

    const customerId = row.customer_id != null && String(row.customer_id).trim() !== ""
      ? String(row.customer_id)
      : null;

    const existing = locationTotals.get(location) || {
      location,
      unitsSold: 0,
      customerCount: 0,
      customerIds: new Set(),
    };

    existing.unitsSold += unitsSold;

    if (customerId && !existing.customerIds.has(customerId)) {
      existing.customerIds.add(customerId);
      existing.customerCount += 1;
    }

    locationTotals.set(location, existing);
  }

  return Array.from(locationTotals.values())
    .map(({ location, unitsSold, customerCount }) => ({ location, customerCount, unitsSold }))
    .sort((left, right) => String(left.location).localeCompare(String(right.location)));
}

export function shouldRenderSalesLogSummarySections({ summary = {}, productMix = [], locationSummaryRows = [] }) {
  const hasSummary = Boolean(summary && Object.keys(summary).length > 0);
  const hasProductMix = Array.isArray(productMix) && productMix.length > 0;
  const hasLocationSummary = Array.isArray(locationSummaryRows) && locationSummaryRows.length > 0;
  return hasSummary || hasProductMix || hasLocationSummary;
}

function mapRow(row) {
  const isPayment = row.entry_type === 'payment';
  return {
    date: row.date_paid || row.date_created,
    customerName: row.customer_name,
    // Facebook profile and phone removed per request
    priceType: row.price_type,
    productSpec: `${row.brand} - ${row.weight_class}kg - ${row.product_status}`,
    quantity: row.sale_quantity,
    unitPrice: isPayment ? Number(row.balance_paid) : Number(row.unit_price),
    totalAmount: isPayment ? Number(row.balance_paid) : Number(row.total_amount),
    paymentType: isPayment ? 'Credit Payment' : row.payment_option,
    balancePaid: isPayment ? Number(row.balance_paid) : null,
    status: row.status,
  };
}

function formatDateLabel(date) {
  return new Date(date).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function formatPhpCurrency(value) {
  return `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getSalesReportSummaryRows(summary = {}) {
  const totalSalesRevenue = Number(summary.totalSalesRevenue ?? 0);

  const totalNetIncome = Number(summary.netIncomeQualified ?? summary.netIncome ?? 0);
  const fullyPaidNetIncome = Number(summary.netIncomeFullyPaid ?? summary.netIncomeWithoutCredit ?? 0);
  const expectedCreditNetIncome = Number(summary.expectedNetIncome ?? 0);
  const totalCreditBalance = Number(summary.totalCreditBalance ?? 0);
  const totalExpenses = Number(summary.totalExpenses ?? 0);
  const totalOrders = Number(summary.totalOrders ?? 0);

  return [
    { label: "Total Sales Revenue", value: totalSalesRevenue, isCurrency: true },
    { label: "Total Net Income", value: totalNetIncome, isCurrency: true },
    { label: "Fully Paid Net Income", value: fullyPaidNetIncome, isCurrency: true },
    { label: "Expected Credit Net Income", value: expectedCreditNetIncome, isCurrency: true },
    { label: "Remaining Credit Balance", value: totalCreditBalance, isCurrency: true },
    { label: "Total Expenses", value: totalExpenses, isCurrency: true },
    { label: "Total Orders", value: totalOrders, isCurrency: false },
  ];
}

async function fetchChartBuffer(config, width = 520, height = 320) {
  const url = `https://quickchart.io/chart?width=${width}&height=${height}&format=png&c=${encodeURIComponent(JSON.stringify(config))}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to generate chart image");
  }
  return Buffer.from(await response.arrayBuffer());
}

function buildLineChartConfig(title, labels, datasets) {
  return {
    type: "line",
    data: { labels, datasets },
    options: {
      plugins: { title: { display: true, text: title } },
      scales: { y: { beginAtZero: true } },
    },
  };
}

function buildPieChartConfig(title, labels, data) {
  return {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            "#ef4444",
            "#3b82f6",
            "#10b981",
            "#f59e0b",
            "#8b5cf6",
            "#64748b",
          ],
        },
      ],
    },
    options: { plugins: { title: { display: true, text: title } } },
  };
}

export async function buildSalesReportExcelBuffer(
  analytics,
  title,
  periodLabel,
) {
  const workbook = new ExcelJS.Workbook();
  const summarySheet = workbook.addWorksheet("Summary");
  const chartsSheet = workbook.addWorksheet("Charts");

  summarySheet.columns = [{ width: 28 }, { width: 22 }];

  summarySheet.addRow([title]);
  summarySheet.addRow(["Reporting Period", periodLabel]);
  summarySheet.addRow([]);
  summarySheet.addRow(["Metric", "Value"]);

  const summaryRows = getSalesReportSummaryRows(analytics.summary || {});
  summaryRows.forEach((row, index) => {
    summarySheet.addRow([row.label, row.value]);
    const cellRef = `B${index + 5}`;
    summarySheet.getCell(cellRef).numFmt = row.isCurrency ? '"₱"#,##0.00' : '#,##0';
  });

  summarySheet.addRow([]);
  summarySheet.addRow([
    "Formula",
    "Combined Net Income = Fully Paid Net Income + Expected Credit Net Income",
  ]);

  const chartMetrics =
    analytics.dailyMetrics.length > 0
      ? analytics.dailyMetrics
      : [
          {
            date: getManilaTodayISO(),
            orders: 0,
            grossIncome: analytics.summary.totalSalesRevenue ?? analytics.summary.grossIncome ?? analytics.summary.totalGrossRevenue ?? 0,
            volumeKg: analytics.summary.totalVolumeKg ?? 0,
            totalExpenses: analytics.summary.totalExpenses ?? 0,
            netIncome: analytics.summary.netIncomeQualified ?? analytics.summary.netIncome ?? 0,
          },
        ];

  const labels = chartMetrics.map((row) => formatDateLabel(row.date));

  const incomeChartConfig = buildLineChartConfig("Income Analysis", labels, [
    {
      label: "Sales Revenue",
      data: chartMetrics.map((row) => row.grossIncome),
      borderColor: "#10b981",
      fill: false,
    },
    {
      label: "Expenses",
      data: chartMetrics.map((row) => row.totalExpenses),
      borderColor: "#ef4444",
      fill: false,
    },
    {
      label: "Combined Net Income",
      data: chartMetrics.map((row) => row.netIncome),
      borderColor: "#8b5cf6",
      fill: false,
    },
  ]);

  const ordersVolumeChartConfig = buildLineChartConfig(
    "Orders & Volume Sold",
    labels,
    [
      {
        label: "Total Orders",
        data: chartMetrics.map((row) => row.orders),
        borderColor: "#3b82f6",
        fill: false,
      },
      {
        label: "Total Volume Sold",
        data: chartMetrics.map((row) => row.volumeKg),
        borderColor: "#ef4444",
        fill: false,
      },
    ],
  );

  const productLabels =
    analytics.productsByBrand.length > 0
      ? analytics.productsByBrand.map((row) => row.brand)
      : ["No Sales"];
  const productData =
    analytics.productsByBrand.length > 0
      ? analytics.productsByBrand.map((row) => row.unitsSold)
      : [1];

  const customerLabels =
    analytics.customerType.length > 0
      ? analytics.customerType.map((row) => row.label)
      : ["No Sales"];
  const customerData =
    analytics.customerType.length > 0
      ? analytics.customerType.map((row) => row.orders)
      : [1];

  const productsChartConfig = buildPieChartConfig(
    "Products Sold",
    productLabels,
    productData,
  );
  const customerChartConfig = buildPieChartConfig(
    "Customer Type",
    customerLabels,
    customerData,
  );

  const [
    incomeChartBuffer,
    ordersVolumeChartBuffer,
    productsChartBuffer,
    customerChartBuffer,
  ] = await Promise.all([
    fetchChartBuffer(incomeChartConfig),
    fetchChartBuffer(ordersVolumeChartConfig),
    fetchChartBuffer(productsChartConfig),
    fetchChartBuffer(customerChartConfig),
  ]);

  const chartImages = [
    { buffer: incomeChartBuffer, title: "Income Analysis" },
    { buffer: ordersVolumeChartBuffer, title: "Orders & Volume Sold" },
    { buffer: productsChartBuffer, title: "Products Sold" },
    { buffer: customerChartBuffer, title: "Customer Type" },
  ];

  let chartRow = 1;
  for (const chart of chartImages) {
    chartsSheet.addRow([chart.title]);
    chartsSheet.getRow(chartRow).font = { bold: true, size: 14 };
    chartRow += 1;

    const imageId = workbook.addImage({
      buffer: chart.buffer,
      extension: "png",
    });

    chartsSheet.addImage(imageId, {
      tl: { col: 0, row: chartRow - 1 },
      ext: { width: 520, height: 320 },
    });

    chartRow += 20;
  }

  return workbook.xlsx.writeBuffer();
}

// Mirrors every column currently displayed on the Customer & Sales Log
// table, so the exported file matches exactly what staff see on screen.
export async function buildSalesLogExcelBuffer(rows, title) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sales Log");

  sheet.columns = [
    { header: "Log Date", key: "date", width: 14 },
    { header: "Customer Name", key: "customerName", width: 22 },
    { header: "Price Type", key: "priceType", width: 16 },
    { header: "Product Specification", key: "productSpec", width: 28 },
    { header: "Customer LPG Tank", key: "lpgTankVariant", width: 18 },
    { header: "Qty", key: "quantity", width: 8 },
    { header: "Unit Price", key: "unitPrice", width: 14 },
    { header: "Total Billing", key: "totalAmount", width: 16 },
  ];

  sheet.insertRow(1, [title]);
  sheet.insertRow(2, []);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.getRow(3).font = { bold: true };

  rows.forEach((row) => {
    sheet.addRow({
      date: new Date(row.date_created).toLocaleDateString("en-PH"),
      customerName: row.customer_name,
      priceType: row.price_type,
      productSpec: `${row.brand} - ${row.weight_class}kg - ${row.product_status}`,
      lpgTankVariant: row.lpg_tank_variant || "",
      quantity: row.sale_quantity,
      unitPrice: row.entry_type === 'payment' ? Number(row.balance_paid) : Number(row.unit_price),
      totalAmount: row.entry_type === 'payment' ? Number(row.balance_paid) : Number(row.total_amount),
    });
  });

  sheet.getColumn("unitPrice").numFmt = '"₱"#,##0.00';
  sheet.getColumn("totalAmount").numFmt = '"₱"#,##0.00';

  return workbook.xlsx.writeBuffer();
}

export async function buildExcelBuffer(rows, title) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sales Report");

  sheet.addRow([title]);
  sheet.addRow([]);
  sheet.addRow([
    "Date",
    "Customer Name",
    "Price Type",
    "Product",
    "Quantity",
    "Unit Price",
    "Total Amount",
    "Status",
  ]);

  rows.forEach((row) => {
    const mapped = mapRow(row);
    sheet.addRow([
      mapped.date,
      mapped.customerName,
      mapped.priceType,
      mapped.productSpec,
      mapped.quantity,
      mapped.unitPrice,
      mapped.totalAmount,
      mapped.status,
    ]);
  });

  return workbook.xlsx.writeBuffer();
}

export async function buildPdfBuffer(rows, title) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
      layout: "landscape",
    });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(title, { align: "left" });
    doc.moveDown();

    const headers = [
      "Date",
      "Customer",
      "Product",
      "Qty",
      "Unit",
      "Total",
      "Type",
    ];
    let y = doc.y;
    const colX = [40, 120, 250, 420, 460, 520, 600];

    doc.fontSize(9).font("Helvetica-Bold");
    headers.forEach((h, i) => doc.text(h, colX[i], y, { width: 80 }));
    doc.moveDown(0.5);
    doc.font("Helvetica");

    rows.forEach((row) => {
      const mapped = mapRow(row);
      y = doc.y;
      if (y > 520) {
        doc.addPage();
        y = 40;
      }
      const dateStr = new Date(mapped.date).toLocaleDateString("en-PH");
      [
        dateStr,
        mapped.customerName,
        mapped.productSpec,
        String(mapped.quantity),
        mapped.unitPrice.toFixed(2),
        mapped.totalAmount.toFixed(2),
        mapped.priceType,
      ].forEach((val, i) =>
        doc.fontSize(8).text(val, colX[i], y, { width: 90 }),
      );
      doc.moveDown(0.8);
    });

    doc.end();
  });
}

export async function buildExpenseLogPdfBuffer(rows, title, generatedBy) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const endPromise = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fontSize(16).font('Helvetica-Bold').text('RCLPG Portal', { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(12).font('Helvetica-Bold').text(title, { align: 'left' });
  if (generatedBy) {
    doc.moveDown(0.1);
    doc.fontSize(9).font('Helvetica').text(`Generated by: ${generatedBy}`);
  }
  doc.moveDown(0.4);

  const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const nameCol = availableWidth * 0.35;
  const amountCol = availableWidth * 0.18;
  const dateCol = availableWidth * 0.16;
  const amountX = doc.page.margins.left + amountCol;
  const dateX = amountX + amountCol;

  const renderExpenseHeader = () => {
    const headerY = doc.y;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Expense', doc.page.margins.left, headerY, {
      width: nameCol,
      lineBreak: false,
    });
    doc.text('Amount', amountX, headerY, {
      width: amountCol,
      align: 'left',
      lineBreak: false,
    });
    doc.text('Date', dateX, headerY, {
      width: dateCol,
      align: 'left',
      lineBreak: false,
    });
    doc.moveDown(0.9);
  };

  renderExpenseHeader();

  doc.font('Helvetica').fontSize(8);
  let currentY = doc.y;
  const lineHeight = 16;
  let totalAmount = 0;

  for (const item of rows) {
    if (currentY + lineHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      renderExpenseHeader();
      currentY = doc.y;
      doc.font('Helvetica').fontSize(8);
    }

    doc.text(String(item.expenses), doc.page.margins.left, currentY, {
      width: nameCol,
      lineBreak: false,
    });
    doc.text(formatPhpCurrency(item.amount), amountX, currentY, {
      width: amountCol,
      align: 'left',
      lineBreak: false,
    });
    doc.text(new Date(item.date).toLocaleDateString('en-PH'), dateX, currentY, {
      width: dateCol,
      align: 'left',
      lineBreak: false,
    });
    currentY += lineHeight;
    doc.y = currentY;
    totalAmount += Number(item.amount || 0);
  }

  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(9);

  const totalY = doc.y;

  doc.text(
    'Total Expenses',
    doc.page.margins.left,
    totalY,
    {
      width: nameCol,
      lineBreak: false,
    }
  );

  doc.text(
    formatPhpCurrency(totalAmount),
    amountX,
    totalY,
    {
      width: amountCol,
      align: 'left',
      lineBreak: false,
    }
  );

  doc.end();
  return endPromise;
}

export async function buildSalesReportPdfBuffer(analytics, title, periodLabel, generatedBy) {
  const doc = new PDFDocument({ margin: 48, size: 'A4', layout: 'landscape' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const endPromise = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // Header
  doc.fontSize(18).font('Helvetica-Bold').text('RCLPG Portal', { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(14).font('Helvetica-Bold').text(title, { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(9).font('Helvetica').text(`Reporting Period: ${periodLabel}`);
  doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`);
  if (generatedBy) doc.text(`Generated by: ${generatedBy}`);
  doc.moveDown(0.6);

  // Summary metrics block
  const s = analytics.summary || {};
  const summaryRows = getSalesReportSummaryRows(s);
  const metrics = summaryRows.map((row) => [row.label, row.value, row.isCurrency]);

  const startY = doc.y;
  const leftColX = doc.x;
  const rightColX = leftColX + 320;
  const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const leftColumnWidth = rightColX - leftColX;
  const rightColumnWidth = availableWidth - leftColumnWidth;

  doc.fontSize(12).font('Helvetica-Bold').text('Summary Metrics', leftColX, startY);
  doc.fontSize(10).font('Helvetica');
  let metricY = doc.y + 8;
  metrics.forEach(([k, v, isCurrency]) => {
    const value = typeof v === 'number' && isCurrency ? formatPhpCurrency(v) : v;
    doc.text(`${k}:`, leftColX, metricY, { width: leftColumnWidth });
    doc.text(String(value), rightColX, metricY, { width: rightColumnWidth, align: 'right' });
    metricY += 16;
  });

  doc.y = metricY + 10;

  // Build charts from analytics data
  const labels = (analytics.dailyMetrics || []).map((d) => formatDateLabel(d.date));
  const paddedDailyMetrics = (analytics.dailyMetrics || []).length
    ? analytics.dailyMetrics
    : [
        {
          date: getManilaTodayISO(),
          orders: 0,
          grossIncome: s.totalSalesRevenue ?? 0,
          volumeKg: s.totalVolumeKg || 0,
          totalExpenses: s.totalExpenses || 0,
          netIncome: s.netIncomeQualified ?? s.netIncome ?? 0,
          netIncomeFullyPaid: s.netIncomeFullyPaid ?? s.netIncomeWithoutCredit ?? 0,
        },
      ];

  const incomeConfig = buildLineChartConfig('Income Analysis', labels.length ? labels : [formatDateLabel(paddedDailyMetrics[0].date)], [
    { label: 'Sales Revenue', data: paddedDailyMetrics.map((d) => d.grossIncome), borderColor: '#10b981', fill: false },
    { label: 'Expenses', data: paddedDailyMetrics.map((d) => d.totalExpenses), borderColor: '#ef4444', fill: false },
    { label: 'Combined Net Income', data: paddedDailyMetrics.map((d) => d.netIncome), borderColor: '#8b5cf6', fill: false },
    { label: 'Fully Paid Net Income', data: paddedDailyMetrics.map((d) => d.netIncomeFullyPaid || 0), borderColor: '#f59e0b', fill: false },
  ]);

  const ordersVolumeConfig = buildLineChartConfig('Orders & Volume Sold', labels.length ? labels : [formatDateLabel(paddedDailyMetrics[0].date)], [
    { label: 'Orders', data: paddedDailyMetrics.map((d) => d.orders), borderColor: '#3b82f6', fill: false },
    { label: 'Volume (kg)', data: paddedDailyMetrics.map((d) => d.volumeKg), borderColor: '#ef4444', fill: false },
  ]);

  const productsConfig = buildPieChartConfig(
    'Product Sales Distribution',
    (analytics.productsByBrand || []).map((p) => p.brand),
    (analytics.productsByBrand || []).map((p) => p.unitsSold),
  );
  const customerConfig = buildPieChartConfig(
    'Customer Type Distribution',
    (analytics.customerType || []).map((c) => c.label),
    (analytics.customerType || []).map((c) => c.orders),
  );

  const [incomeImg, ordersVolumeImg, productsImg, customerImg] = await Promise.all([
    fetchChartBuffer(incomeConfig, 1000, 420),
    fetchChartBuffer(ordersVolumeConfig, 1000, 420),
    fetchChartBuffer(productsConfig, 520, 360),
    fetchChartBuffer(customerConfig, 520, 360),
  ]);

  const chartAvailableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.addPage();
  doc.image(incomeImg, doc.page.margins.left, doc.y, { fit: [chartAvailableWidth, 320], align: 'center' });

  doc.addPage();
  doc.image(ordersVolumeImg, doc.page.margins.left, doc.y, { fit: [chartAvailableWidth, 320], align: 'center' });

  doc.addPage();
  const halfWidth = (chartAvailableWidth - 20) / 2;
  doc.image(productsImg, doc.page.margins.left, doc.y, { fit: [halfWidth, 320] });
  doc.image(customerImg, doc.page.margins.left + halfWidth + 20, doc.y, { fit: [halfWidth, 320] });

  doc.end();
  return endPromise;
}

export async function buildSalesLogPdfBuffer(rows, title, generatedBy, analytics = {}) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  const chunks = [];
  const summary = analytics.summary || {};
  const productMix = analytics.productMix || [];

  // Derive product mix directly from the actual sales rows to ensure Brand + Weight
  // combinations reflect what was sold in the selected period. This is more reliable
  // than relying on analytics payload which may be missing brand values.
  const salesRows = (rows || []).filter((r) => String(r.entry_type || '').toLowerCase() !== 'payment');
  const mixMap = new Map();
  for (const r of salesRows) {
    const brand = r.brand ? String(r.brand).trim() : '';
    const weight = r.weight_class != null ? Number(r.weight_class) : 0;
    const qty = r.sale_quantity != null ? Number(r.sale_quantity) : 0;
    if (!qty || qty <= 0) continue;
    const key = `${brand}::${weight}`;
    const existing = mixMap.get(key) || { brand, weightClass: weight, unitsSold: 0, revenue: 0 };
    existing.unitsSold += qty;
    existing.revenue += Number(r.total_amount || 0);
    mixMap.set(key, existing);
  }

  const salesDerivedMix = Array.from(mixMap.values()).sort((a, b) => {
    const weightCompare = Number(a.weightClass) - Number(b.weightClass);
    if (weightCompare !== 0) return weightCompare;
    return String(a.brand).localeCompare(String(b.brand));
  });

  const fallbackMix = (productMix || []).filter((it) => Number(it.unitsSold || 0) > 0);
  fallbackMix.sort((a, b) => Number(a.weightClass) - Number(b.weightClass) || String(a.brand || '').localeCompare(String(b.brand || '')));

  const filteredProductMix = salesDerivedMix.length > 0 ? salesDerivedMix : fallbackMix;
  const totalUnitsSold = Number(
    analytics.totalUnitsSold ?? filteredProductMix.reduce((sum, item) => sum + Number(item.unitsSold || 0), 0),
  );
  const locationSummaryRows = buildLocationSummaryRows(rows);
  const totalLocationUnitsSold = locationSummaryRows.reduce(
    (sum, item) => sum + Number(item.unitsSold || 0),
    0,
  );
  const totalLocationCustomerCount = locationSummaryRows.reduce(
    (sum, item) => sum + Number(item.customerCount || 0),
    0,
  );

  doc.on('data', (c) => chunks.push(c));
  const endPromise = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fontSize(16).font('Helvetica-Bold').text('RCLPG Portal', { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(12).text(title);
  if (generatedBy) doc.fontSize(9).text(`Generated by: ${generatedBy}`);
  doc.moveDown();

  // Table headers follow the sales log UI layout
  const headers = [
    'Log Date',
    'Product',
    'Customer',
    'Type',
    'Traded',
    'Qty',
    'Unit Price',
    'Total Billing',
    'Balance Paid',
  ];

  const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rel = [0.10, 0.13, 0.15, 0.12, 0.15, 0.06, 0.08, 0.10, 0.08];
  const colWidths = rel.map((r) => Math.floor(r * availableWidth));

  function renderTableHeader() {
    doc.font('Helvetica-Bold').fontSize(9);
    let x = doc.page.margins.left;
    const y = doc.y;
    headers.forEach((h, i) => {
      doc.text(h, x, y, { width: colWidths[i], align: 'left' });
      x += colWidths[i];
    });
    doc.moveDown(0.6);
    doc.font('Helvetica').fontSize(8);
  }

  renderTableHeader();

  for (const row of rows) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
      renderTableHeader();
    }

    const isPayment = row.entry_type === 'payment';
    const formattedDate = new Date(row.log_date || row.date_paid || row.date_created).toLocaleDateString('en-PH');
    const productSpec = `${row.weight_class || ''}kg - ${row.brand || ''}`.trim();
    const paymentType = isPayment ? 'Credit Payment' : row.payment_option || '';
    const qty = isPayment ? '' : row.sale_quantity != null ? String(row.sale_quantity) : '';
    const unitPrice = isPayment
      ? ''
      : row.unit_price != null
      ? Number(row.unit_price).toFixed(2)
      : '';
    const totalBilling = Number(isPayment ? row.balance_paid || 0 : row.total_amount || 0).toFixed(2);
    const balancePaid = row.payment_option === 'Fully Paid'
      ? 'Fully Paid'
      : Number(row.balance_paid || 0).toFixed(2);
    const traded = row.lpg_tank_variant || '';

    const vals = [
      formattedDate,
      productSpec,
      row.customer_name || '',
      paymentType,
      traded,
      qty,
      unitPrice,
      totalBilling,
      balancePaid,
    ];

    const rowStartY = doc.y;
    let x = doc.page.margins.left;
    vals.forEach((v, i) => {
      doc.text(v, x, rowStartY, {
        width: colWidths[i],
        align: 'left',
      });
      x += colWidths[i];
    });

    const lineHeight = 12;
    doc.y = rowStartY + lineHeight;
  }

  const shouldRenderSections = shouldRenderSalesLogSummarySections({
    summary,
    productMix,
    locationSummaryRows,
  });

  if (shouldRenderSections) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 160) {
      doc.addPage();
    }

    const sectionStartY = doc.y + 10;
    const summaryX = doc.page.margins.left;
    const mixX = doc.page.margins.left + 340;
    const summaryWidth = 260;
    const mixWidth = 220;

    if (summary && Object.keys(summary).length > 0) {
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Summary Totals', summaryX, sectionStartY, { width: summaryWidth });

      doc.font('Helvetica').fontSize(8.5);
      const totalSalesRevenue = Number(summary.totalSalesRevenue ?? 0);
      const netIncome = Number(summary.netIncomeQualified ?? summary.netIncome ?? 0);
      const salesExpenses = Number(summary.totalExpenses ?? 0);
      const expectedCreditIncome = Number(summary.expectedNetIncome ?? 0);
      const remainingCreditBalance = Number(summary.totalCreditBalance ?? 0);
      const fleetNetIncome = Number(summary.netIncomeFullyPaid ?? summary.netIncomeWithoutCredit ?? 0);
      const totalNetWithoutExpenses = netIncome + salesExpenses;

      const summaryItems = [
        ['Total Sales Revenue', formatPhpCurrency(totalSalesRevenue)],
        ['Total Net Income', formatPhpCurrency(netIncome)],
        ['Net Without Expenses', formatPhpCurrency(totalNetWithoutExpenses)],
        ['Fully Paid Net Income', formatPhpCurrency(fleetNetIncome)],
        ['Expected Credit Income', formatPhpCurrency(expectedCreditIncome)],
        ['Remaining Credit Balance', formatPhpCurrency(remainingCreditBalance)],
        ['Total Sales Expenses', formatPhpCurrency(salesExpenses)],
      ];

      let summaryY = sectionStartY + 18;
      summaryItems.forEach(([label, value]) => {
        doc.text(`${label}:`, summaryX, summaryY, { width: summaryWidth * 0.62 });
        doc.text(String(value), summaryX + summaryWidth * 0.62, summaryY, { width: summaryWidth * 0.38, align: 'right' });
        summaryY += 14;
      });
    }

    if (productMix.length > 0) {
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Product & Inventory Mix', mixX, sectionStartY, { width: mixWidth });

      doc.font('Helvetica-Bold').fontSize(8);
      doc.text('Brand - Weight', mixX, sectionStartY + 18, { width: mixWidth * 0.6 });
      doc.text('Units Sold', mixX + mixWidth * 0.6, sectionStartY + 18, { width: mixWidth * 0.4, align: 'right' });

      doc.font('Helvetica').fontSize(8);
      let mixY = sectionStartY + 32;
      filteredProductMix.forEach((item) => {
        const brandLabel = item.brand ? `${String(item.brand).trim()} ` : '';
        const weightClass = Number(item.weightClass ?? 0);
        const unitsSold = Number(item.unitsSold ?? 0);
        doc.text(`${brandLabel} - ${weightClass.toFixed(weightClass % 1 === 0 ? 0 : 1)} kg`, mixX, mixY, { width: mixWidth * 0.6 });
        doc.text(String(unitsSold), mixX + mixWidth * 0.6, mixY, { width: mixWidth * 0.4, align: 'right' });
        mixY += 12;
      });

      doc.font('Helvetica-Bold').fontSize(8);
      doc.text('Total Units Sold', mixX, mixY + 4, { width: mixWidth * 0.6 });
      doc.text(String(totalUnitsSold), mixX + mixWidth * 0.6, mixY + 4, { width: mixWidth * 0.4, align: 'right' });
    }

    if (locationSummaryRows.length > 0) {
      doc.addPage(); // force Location Summary to start on the next page

      const locationSectionStartY = doc.page.margins.top + 20;
      const locationX = doc.page.margins.left;
      const locationWidth = availableWidth;

      const locationColWidth = locationWidth * 0.15;
      const customerColWidth = locationWidth * 0.10;
      const unitsColWidth = locationWidth * 0.25;

      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Location Summary', locationX, locationSectionStartY, { width: locationWidth });

      doc.font('Helvetica-Bold').fontSize(8);
      doc.text('Location', locationX, locationSectionStartY + 18, { width: locationColWidth });
      doc.text('Customers', locationX + locationColWidth, locationSectionStartY + 18, { width: customerColWidth, align: 'center' });
      doc.text('LPG Units Sold', locationX + locationColWidth + 5, locationSectionStartY + 18, { width: unitsColWidth, align: 'right' });

      doc.font('Helvetica').fontSize(8);
      let locationY = locationSectionStartY + 32;
      locationSummaryRows.forEach((item) => {
        const unitsSold = Number(item.unitsSold ?? 0);
        const customerCount = Number(item.customerCount ?? 0);
  
        doc.text(String(item.location), locationX, locationY, { width: locationColWidth });
        doc.text(String(customerCount), locationX + locationColWidth, locationY, { width: customerColWidth, align: 'center' });
        doc.text(String(unitsSold), locationX + locationColWidth + 5, locationY, { width: unitsColWidth, align: 'right' });
        locationY += 12;
      });

      doc.font('Helvetica-Bold').fontSize(8);
      doc.text('Total Customers', locationX, locationY + 4, { width: locationColWidth });
      doc.text(String(totalLocationCustomerCount), locationX + locationColWidth, locationY + 4, { width: customerColWidth, align: 'center' });
      doc.text(String(totalLocationUnitsSold), locationX + locationColWidth + 5, locationY + 4, { width: unitsColWidth, align: 'right' });
    }
  }

  doc.end();
  return endPromise;
}

export async function buildCreditLogPdfBuffer(rows, title, summary, generatedBy) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const endPromise = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fontSize(16).font('Helvetica-Bold').text('RCLPG Portal', { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(12).text(title);
  if (generatedBy) doc.fontSize(9).text(`Generated by: ${generatedBy}`);
  doc.moveDown();

  // Summary block
  doc.fontSize(11).font('Helvetica-Bold').text('Summary');
  doc.moveDown(0.2);
  doc.fontSize(10).font('Helvetica');
  const sums = [
    ['Total Outstanding Credit', summary.totalOutstanding || 0],
    ['Total Paid Amount', summary.totalPaid || 0],
    ['Total Remaining Balance', summary.totalRemaining || 0],
    ['Paid Accounts', summary.paidAccounts || 0],
    ['Unpaid Accounts', summary.unpaidAccounts || 0],
  ];
  sums.forEach(([k, v]) => doc.text(`${k}: ${typeof v === 'number' ? v : v}`));
  doc.moveDown();

  // Table: pick friendly columns and widths for readability
  const headers = ['date_created', 'customer_name', 'price_type', 'product_details', 'total_amount', 'total_paid', 'remaining_credit', 'credit_status'];
  const headerLabels = {
    date_created: 'Date',
    customer_name: 'Customer',
    price_type: 'Price Type',
    product_details: 'Product',
    total_amount: 'Total',
    total_paid: 'Paid',
    remaining_credit: 'Remaining',
    credit_status: 'Status',
  };

  const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rel = [0.12, 0.14, 0.12, 0.20, 0.12, 0.08, 0.10, 0.15];
  const colWidths = rel.map((r) => Math.floor(r * availableWidth));

  function renderCreditHeader() {
    doc.font('Helvetica-Bold').fontSize(9);
    let x = doc.page.margins.left;
    const y = doc.y;
    headers.forEach((h, i) => {
      doc.text(headerLabels[h] || h, x, y, { width: colWidths[i], align: 'left' });
      x += colWidths[i];
    });
    doc.moveDown(0.6);
    doc.font('Helvetica').fontSize(8);
  }

  renderCreditHeader();

  rows.forEach((r) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
      renderCreditHeader();
    }
    let x = doc.page.margins.left;
    const rowStartY = doc.y;
    const values = [
      new Date(r.date_created).toLocaleString('en-PH'),
      String(r.customer_name ?? ''),
      String(r.price_type ?? ''),
      String(r.product_details ?? ''),
      r.total_amount != null ? formatPhpCurrency(r.total_amount) : '',
      r.total_paid != null ? formatPhpCurrency(r.total_paid) : '',
      r.remaining_credit != null ? formatPhpCurrency(r.remaining_credit) : '',
      String(r.credit_status ?? ''),
    ];

    values.forEach((v, i) => {
      // truncate very long single-word values to avoid layout break
      const text = String(v || '');
      doc.text(text, x, rowStartY, { width: colWidths[i], align: 'left' });
      x += colWidths[i];
    });
    doc.y = rowStartY + 14;
  });

  doc.end();
  return endPromise;
}
