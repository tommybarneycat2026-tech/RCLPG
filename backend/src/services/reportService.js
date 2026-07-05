import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

function mapRow(row) {
  return {
    saleId: row.sale_id,
    date: row.date_created,
    customerName: row.customer_name,
    fbName: row.fb_name || "",
    phoneNumber: row.phone_number || "",
    priceType: row.price_type,
    productSpec: `${row.brand} - ${row.weight_class}kg - ${row.product_status}`,
    quantity: row.sale_quantity,
    unitPrice: Number(row.unit_price),
    totalAmount: Number(row.total_amount),
    status: row.status,
  };
}

function formatDateLabel(date) {
  return new Date(date).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
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
  summarySheet.addRow(["Gross Income", analytics.summary.grossIncome]);
  summarySheet.addRow([
    "Cost of Goods Sold",
    analytics.summary.costOfGoodsSold,
  ]);
  summarySheet.addRow(["Total Expenses", analytics.summary.totalExpenses]);
  summarySheet.addRow(["Net Income", analytics.summary.netIncome]);
  summarySheet.addRow([
    "Total Volume Sold (kg)",
    analytics.summary.totalVolumeKg,
  ]);
  summarySheet.addRow(["Total Orders", analytics.summary.totalOrders]);
  summarySheet.addRow([]);
  summarySheet.addRow([
    "Formula",
    "Net Income = Gross Income − Cost of Goods Sold − Total Expenses",
  ]);

  ["B5", "B6", "B7", "B8"].forEach((cell) => {
    summarySheet.getCell(cell).numFmt = '"₱"#,##0.00';
  });
  summarySheet.getCell("B9").numFmt = "#,##0.00";

  const chartMetrics =
    analytics.dailyMetrics.length > 0
      ? analytics.dailyMetrics
      : [
          {
            date: new Date().toISOString().slice(0, 10),
            orders: 0,
            grossIncome: analytics.summary.grossIncome,
            volumeKg: analytics.summary.totalVolumeKg,
            totalExpenses: analytics.summary.totalExpenses,
            netIncome: analytics.summary.netIncome,
          },
        ];

  const labels = chartMetrics.map((row) => formatDateLabel(row.date));

  const incomeChartConfig = buildLineChartConfig("Income Analysis", labels, [
    {
      label: "Revenue",
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
      label: "Net Income",
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
    { header: "Facebook Profile", key: "fbName", width: 20 },
    { header: "Phone Number", key: "phoneNumber", width: 16 },
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
      fbName: row.fb_name || "",
      phoneNumber: row.phone_number || "",
      priceType: row.price_type,
      productSpec: `${row.brand} - ${row.weight_class}kg - ${row.product_status}`,
      lpgTankVariant: row.lpg_tank_variant || "",
      quantity: row.sale_quantity,
      unitPrice: Number(row.unit_price),
      totalAmount: Number(row.total_amount),
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
    "Sale ID",
    "Date",
    "Customer Name",
    "Facebook Name",
    "Phone",
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
      mapped.saleId,
      mapped.date,
      mapped.customerName,
      mapped.fbName,
      mapped.phoneNumber,
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
