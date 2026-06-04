// GET Category Balances
app.get('/api/balances', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT cat_id, name, balance FROM account ORDER BY cat_id");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Transactions (with Emp ID)
app.get('/api/transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(`
      SELECT 
        t.tid, t.items, t.amount, t.empid,
        e.Name as employee_name,
        d.Name as dept_name,
        a.name as category_name
      FROM transaction t
      JOIN employee e ON t.empid = e.empid
      JOIN department d ON e.deptid = d.deptid
      JOIN account a ON t.cat_id = a.cat_id
      ORDER BY t.tid DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const [[{ total }]] = await pool.query("SELECT COUNT(*) as total FROM transaction");

    res.json({ data: rows, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Meta data for filters
app.get('/api/transactions/meta/departments', async (req, res) => {
  const [rows] = await pool.query("SELECT deptid, Name FROM department ORDER BY Name");
  res.json(rows);
});

app.get('/api/transactions/meta/categories', async (req, res) => {
  const [rows] = await pool.query("SELECT cat_id, name FROM account ORDER BY name");
  res.json(rows);
});