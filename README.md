# 🚂 Railway Admin Dashboard

A full-stack admin dashboard for managing and visualizing Railway database transactions.

## Tech Stack
- **Backend**: Node.js + Express.js
- **Database**: MySQL (your existing `railway` database)
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Charts**: Chart.js
- **Reports**: PDFKit (PDF) + ExcelJS (Excel)

## Setup Instructions

### 1. Prerequisites
- Node.js v16+ installed
- MySQL running with the `railway` database
- Your schema tables: `department`, `employee`, `account`, `transaction`

### 2. Install dependencies
```bash
cd railway-admin
npm install
```

### 3. Configure database
Edit `.env` with your MySQL credentials:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=railway
DB_PORT=3306
PORT=3000
```

### 4. Start the server
```bash
# Production
npm start

# Development (auto-restart)
npm run dev
```

### 5. Open in browser
Visit: http://localhost:3000

---

## Features

### 📊 Dashboard
- KPI cards: total transactions, amount spent, employees, departments
- Bar chart: spending by department
- Doughnut chart: category breakdown
- Grouped bar chart: department vs category matrix

### 📋 Transactions
- Full transaction table with pagination (15 per page)
- Filter by department, category, or search text
- Click any row for full transaction detail modal

### 📈 Analytics
- Horizontal bar: top spending departments
- Pie chart: category share
- Top 10 employees by spend with visual bars
- Department × Category heatmap

### 📄 Reports
- **PDF**: Multi-page formatted report with all summaries + transactions
- **Excel**: 3-sheet workbook (Transactions, By Department, By Category)
- Filter by department/category before downloading

---

## Project Structure
```
railway-admin/
├── server.js           # Express entry point
├── db.js               # MySQL connection pool
├── .env                # DB credentials (edit this!)
├── package.json
├── routes/
│   ├── transactions.js # /api/transactions
│   ├── analytics.js    # /api/analytics
│   └── reports.js      # /api/reports (PDF + Excel)
└── public/
    ├── index.html
    ├── css/style.css
    └── js/app.js
```
