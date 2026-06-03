const express = require('express');
const router = express.Router();
const db = require('../db');

// Summary KPIs
router.get('/summary', async (req, res) => {
  try {
    const [[totals]] = await db.query(`
      SELECT 
        COUNT(*) AS total_transactions,
        COALESCE(SUM(amount), 0) AS total_amount,
        COUNT(DISTINCT empid) AS active_employees,
        COUNT(DISTINCT cat_id) AS categories_used
      FROM transaction
    `);
    const [[deptCount]] = await db.query('SELECT COUNT(*) AS total FROM department');
    res.json({ ...totals, total_departments: deptCount.total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Spending by department
router.get('/by-department', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        d.deptid,
        d.Name AS dept_name,
        COUNT(t.tid) AS transaction_count,
        COALESCE(SUM(t.amount), 0) AS total_amount
      FROM department d
      LEFT JOIN employee e ON d.deptid = e.deptid
      LEFT JOIN transaction t ON e.empid = t.empid
      GROUP BY d.deptid, d.Name
      ORDER BY total_amount DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Spending by category
router.get('/by-category', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        a.cat_id,
        a.name AS category_name,
        a.balance,
        COUNT(t.tid) AS transaction_count,
        COALESCE(SUM(t.amount), 0) AS total_amount
      FROM account a
      LEFT JOIN transaction t ON a.cat_id = t.cat_id
      GROUP BY a.cat_id, a.name, a.balance
      ORDER BY total_amount DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dept vs Category heatmap data
router.get('/dept-category', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        d.Name AS dept_name,
        a.name AS category_name,
        COUNT(t.tid) AS transaction_count,
        COALESCE(SUM(t.amount), 0) AS total_amount
      FROM department d
      JOIN employee e ON d.deptid = e.deptid
      JOIN transaction t ON e.empid = t.empid
      JOIN account a ON t.cat_id = a.cat_id
      GROUP BY d.Name, a.name
      ORDER BY total_amount DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Top spending employees
router.get('/top-employees', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        e.empid,
        e.Name AS employee_name,
        d.Name AS dept_name,
        COUNT(t.tid) AS transaction_count,
        COALESCE(SUM(t.amount), 0) AS total_amount
      FROM employee e
      JOIN department d ON e.deptid = d.deptid
      LEFT JOIN transaction t ON e.empid = t.empid
      GROUP BY e.empid, e.Name, d.Name
      ORDER BY total_amount DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
