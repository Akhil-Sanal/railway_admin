const express = require('express');
const router = express.Router();
const db = require('../db');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

async function getReportData(filters = {}) {
  const { dept, category } = filters;
  let where = [], params = [];
  if (dept) { where.push('d.deptid = ?'); params.push(dept); }
  if (category) { where.push('a.cat_id = ?'); params.push(category); }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const [transactions] = await db.query(`
    SELECT t.tid, t.items, t.amount,
      e.Name AS employee_name, d.Name AS dept_name, a.name AS category_name
    FROM transaction t
    JOIN employee e ON t.empid = e.empid
    JOIN department d ON e.deptid = d.deptid
    JOIN account a ON t.cat_id = a.cat_id
    ${whereClause}
    ORDER BY t.tid DESC
  `, params);

  const [deptSummary] = await db.query(`
    SELECT d.Name AS dept_name,
      COUNT(t.tid) AS count, COALESCE(SUM(t.amount),0) AS total
    FROM department d
    LEFT JOIN employee e ON d.deptid = e.deptid
    LEFT JOIN transaction t ON e.empid = t.empid
    GROUP BY d.Name ORDER BY total DESC
  `);

  const [catSummary] = await db.query(`
    SELECT a.name AS category_name,
      COUNT(t.tid) AS count, COALESCE(SUM(t.amount),0) AS total
    FROM account a
    LEFT JOIN transaction t ON a.cat_id = t.cat_id
    GROUP BY a.name ORDER BY total DESC
  `);

  return { transactions, deptSummary, catSummary };
}

// PDF Report
router.get('/pdf', async (req, res) => {
  try {
    const { transactions, deptSummary, catSummary } = await getReportData(req.query);
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="railway-report.pdf"');
    doc.pipe(res);

    // Header
    doc.rect(0, 0, doc.page.width, 80).fill('#1a3a5c');
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
       .text('🚂 RAILWAY ADMIN REPORT', 50, 25);
    doc.fontSize(10).font('Helvetica')
       .text(`Generated: ${new Date().toLocaleString()}`, 50, 55);
    doc.moveDown(3);

    const totalAmount = transactions.reduce((s, t) => s + Number(t.amount), 0);

    // Summary
    doc.fillColor('#1a3a5c').fontSize(14).font('Helvetica-Bold').text('Executive Summary', 50, 100);
    doc.moveTo(50, 118).lineTo(545, 118).stroke('#1a3a5c');
    doc.fontSize(11).font('Helvetica').fillColor('#333333');
    doc.text(`Total Transactions: ${transactions.length}`, 50, 125);
    doc.text(`Total Amount Spent: ₹${totalAmount.toLocaleString('en-IN')}`, 50, 142);
    doc.text(`Departments: ${deptSummary.length}`, 50, 159);
    doc.text(`Categories: ${catSummary.length}`, 50, 176);

    // Dept Summary Table
    doc.moveDown(2);
    doc.fillColor('#1a3a5c').fontSize(14).font('Helvetica-Bold').text('Spending by Department', 50, 210);
    doc.moveTo(50, 228).lineTo(545, 228).stroke('#1a3a5c');

    const deptHeaders = ['Department', 'Transactions', 'Total Amount'];
    const deptColWidths = [220, 120, 135];
    let y = 235;

    doc.rect(50, y, 495, 20).fill('#e8f0f7');
    doc.fillColor('#1a3a5c').fontSize(10).font('Helvetica-Bold');
    let x = 55;
    deptHeaders.forEach((h, i) => { doc.text(h, x, y + 4, { width: deptColWidths[i] }); x += deptColWidths[i]; });
    y += 22;

    deptSummary.forEach((row, idx) => {
      if (idx % 2 === 0) doc.rect(50, y, 495, 18).fill('#f8fafc');
      doc.fillColor('#333333').fontSize(9).font('Helvetica');
      x = 55;
      doc.text(row.dept_name, x, y + 3, { width: 220 }); x += 220;
      doc.text(String(row.count), x, y + 3, { width: 120 }); x += 120;
      doc.text(`₹${Number(row.total).toLocaleString('en-IN')}`, x, y + 3, { width: 135 });
      y += 20;
    });

    // Category Summary
    y += 15;
    if (y > 680) { doc.addPage(); y = 50; }
    doc.fillColor('#1a3a5c').fontSize(14).font('Helvetica-Bold').text('Spending by Category', 50, y);
    y += 18;
    doc.moveTo(50, y).lineTo(545, y).stroke('#1a3a5c');
    y += 7;

    doc.rect(50, y, 495, 20).fill('#e8f0f7');
    doc.fillColor('#1a3a5c').fontSize(10).font('Helvetica-Bold');
    x = 55;
    ['Category', 'Transactions', 'Total Amount'].forEach((h, i) => {
      doc.text(h, x, y + 4, { width: deptColWidths[i] }); x += deptColWidths[i];
    });
    y += 22;

    catSummary.forEach((row, idx) => {
      if (idx % 2 === 0) doc.rect(50, y, 495, 18).fill('#f8fafc');
      doc.fillColor('#333333').fontSize(9).font('Helvetica');
      x = 55;
      doc.text(row.category_name, x, y + 3, { width: 220 }); x += 220;
      doc.text(String(row.count), x, y + 3, { width: 120 }); x += 120;
      doc.text(`₹${Number(row.total).toLocaleString('en-IN')}`, x, y + 3, { width: 135 });
      y += 20;
      if (y > 750) { doc.addPage(); y = 50; }
    });

    // Transactions
    doc.addPage();
    doc.fillColor('#1a3a5c').fontSize(14).font('Helvetica-Bold').text('All Transactions', 50, 50);
    doc.moveTo(50, 68).lineTo(545, 68).stroke('#1a3a5c');

    const txCols = ['TID', 'Employee', 'Department', 'Category', 'Items', 'Amount'];
    const txWidths = [35, 80, 80, 70, 165, 65];
    y = 75;
    doc.rect(50, y, 495, 20).fill('#e8f0f7');
    doc.fillColor('#1a3a5c').fontSize(8).font('Helvetica-Bold');
    x = 55;
    txCols.forEach((h, i) => { doc.text(h, x, y + 5, { width: txWidths[i] }); x += txWidths[i]; });
    y += 22;

    transactions.forEach((t, idx) => {
      if (y > 760) { doc.addPage(); y = 50; }
      if (idx % 2 === 0) doc.rect(50, y, 495, 16).fill('#f8fafc');
      doc.fillColor('#333333').fontSize(7.5).font('Helvetica');
      x = 55;
      const cells = [t.tid, t.employee_name, t.dept_name, t.category_name,
                     (t.items || '').substring(0, 40) + (t.items?.length > 40 ? '…' : ''),
                     `₹${Number(t.amount).toLocaleString('en-IN')}`];
      cells.forEach((c, i) => { doc.text(String(c), x, y + 3, { width: txWidths[i] }); x += txWidths[i]; });
      y += 18;
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Excel Report
router.get('/excel', async (req, res) => {
  try {
    const { transactions, deptSummary, catSummary } = await getReportData(req.query);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Railway Admin';
    workbook.created = new Date();

    const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } }, alignment: { horizontal: 'center' } };
    const altRow = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0F7' } };

    // Sheet 1: Transactions
    const txSheet = workbook.addWorksheet('Transactions');
    txSheet.columns = [
      { header: 'TID', key: 'tid', width: 8 },
      { header: 'Employee', key: 'employee_name', width: 20 },
      { header: 'Department', key: 'dept_name', width: 20 },
      { header: 'Category', key: 'category_name', width: 18 },
      { header: 'Items', key: 'items', width: 40 },
      { header: 'Amount (₹)', key: 'amount', width: 15 }
    ];
    txSheet.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
    txSheet.getRow(1).height = 22;
    transactions.forEach((t, i) => {
      const row = txSheet.addRow(t);
      if (i % 2 === 0) row.eachCell(cell => { cell.fill = altRow; });
    });

    // Sheet 2: By Department
    const dSheet = workbook.addWorksheet('By Department');
    dSheet.columns = [
      { header: 'Department', key: 'dept_name', width: 25 },
      { header: 'Transactions', key: 'count', width: 15 },
      { header: 'Total Amount (₹)', key: 'total', width: 20 }
    ];
    dSheet.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
    deptSummary.forEach((r, i) => {
      const row = dSheet.addRow(r);
      if (i % 2 === 0) row.eachCell(cell => { cell.fill = altRow; });
    });

    // Sheet 3: By Category
    const cSheet = workbook.addWorksheet('By Category');
    cSheet.columns = [
      { header: 'Category', key: 'category_name', width: 25 },
      { header: 'Transactions', key: 'count', width: 15 },
      { header: 'Total Amount (₹)', key: 'total', width: 20 }
    ];
    cSheet.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
    catSummary.forEach((r, i) => {
      const row = cSheet.addRow(r);
      if (i % 2 === 0) row.eachCell(cell => { cell.fill = altRow; });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="railway-report.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
