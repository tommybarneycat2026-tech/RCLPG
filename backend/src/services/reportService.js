import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

function mapRow(row) {
  return {
    saleId: row.sale_id,
    date: row.date_created,
    customerName: row.customer_name,
    fbName: row.fb_name || '',
    phoneNumber: row.phone_number || '',
    priceType: row.price_type,
    productSpec: `${row.brand} - ${row.weight_class}kg - ${row.product_status}`,
    quantity: row.sale_quantity,
    unitPrice: Number(row.unit_price),
    totalAmount: Number(row.total_amount),
    status: row.status,
  };
}

export async function buildExcelBuffer(rows, title) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sales Report');

  sheet.addRow([title]);
  sheet.addRow([]);
  sheet.addRow([
    'Sale ID',
    'Date',
    'Customer Name',
    'Facebook Name',
    'Phone',
    'Price Type',
    'Product',
    'Quantity',
    'Unit Price',
    'Total Amount',
    'Status',
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
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(title, { align: 'left' });
    doc.moveDown();

    const headers = ['Date', 'Customer', 'Product', 'Qty', 'Unit', 'Total', 'Type'];
    let y = doc.y;
    const colX = [40, 120, 250, 420, 460, 520, 600];

    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, colX[i], y, { width: 80 }));
    doc.moveDown(0.5);
    doc.font('Helvetica');

    rows.forEach((row) => {
      const mapped = mapRow(row);
      y = doc.y;
      if (y > 520) {
        doc.addPage();
        y = 40;
      }
      const dateStr = new Date(mapped.date).toLocaleDateString('en-PH');
      [
        dateStr,
        mapped.customerName,
        mapped.productSpec,
        String(mapped.quantity),
        mapped.unitPrice.toFixed(2),
        mapped.totalAmount.toFixed(2),
        mapped.priceType,
      ].forEach((val, i) => doc.fontSize(8).text(val, colX[i], y, { width: 90 }));
      doc.moveDown(0.8);
    });

    doc.end();
  });
}
