const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all transactions with joins
router.get('/', async (req, res) => {
  try {
    const { dept, category, search, page = 1, limit = 15 } = req.query;
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];

    if (dept) { where.push('d.deptid = ?'); params.push(dept); }
    if (category) { where.push('a.cat_id = ?'); params.push(category); }
    if (search) {
      where.push('(t.items LIKE ? OR e.Name LIKE ? OR d.Name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [rows] = await db.query(`
      SELECT 
        t.tid,
        t.items,
        t.amount,
        e.empid,
        e.Name AS employee_name,
        d.deptid,
        d.Name AS dept_name,
        a.cat_id,
        a.name AS category_name,
        a.balance AS category_balance
      FROM transaction t
      JOIN employee e ON t.empid = e.empid
      JOIN department d ON e.deptid = d.deptid
      JOIN account a ON t.cat_id = a.cat_id
      ${whereClause}
      ORDER BY t.tid DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const [[{ total }]] = await db.query(`
      SELECT COUNT(*) as total
      FROM transaction t
      JOIN employee e ON t.empid = e.empid
      JOIN department d ON e.deptid = d.deptid
      JOIN account a ON t.cat_id = a.cat_id
      ${whereClause}
    `, params);

    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET single transaction
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        t.*, e.Name AS employee_name, d.Name AS dept_name,
        a.name AS category_name
      FROM transaction t
      JOIN employee e ON t.empid = e.empid
      JOIN department d ON e.deptid = d.deptid
      JOIN account a ON t.cat_id = a.cat_id
      WHERE t.tid = ?
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET departments list
router.get('/meta/departments', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM department ORDER BY Name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET categories list
router.get('/meta/categories', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM account ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
