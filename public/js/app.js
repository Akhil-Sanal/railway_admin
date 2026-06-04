// ===== STATE =====
const state = {
  page: 'dashboard',
  tx: { page: 1, limit: 15, dept: '', cat: '', search: '', total: 0 }
};

// ===== UTILS =====
const $ = id => document.getElementById(id);
const fmt = n => '₹' + Number(n).toLocaleString('en-IN');
const fmtK = n => n >= 1e7 ? '₹' + (n/1e7).toFixed(1) + 'Cr' : n >= 1e5 ? '₹' + (n/1e5).toFixed(1) + 'L' : '₹' + Number(n).toLocaleString('en-IN');

async function api(path) {
  try {
    const r = await fetch('/api' + path);
    if (!r.ok) throw new Error(await r.text());
    return await r.json();
  } catch (e) {
    console.error('API Error:', path, e);
    return null;
  }
}

// ===== CLOCK =====
function updateClock() {
  const now = new Date();
  $('clock').textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ===== NAVIGATION =====
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(item.dataset.page);
  });
});

$('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

function navigateTo(page) {
  state.page = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
  
  const titles = {
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    balances: 'Balances',
    analytics: 'Analytics',
    reports: 'Reports'
  };
  $('pageTitle').textContent = titles[page] || page;

  if (page === 'transactions') loadTransactionsPage();
  if (page === 'balances') loadBalances();
}

// ===== BALANCES =====
async function loadBalances() {
  const data = await api('/balances');
  const tbody = $('balanceBody');

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="loading-row">No balance records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(b => `
    <tr>
      <td><strong>${b.cat_id}</strong></td>
      <td>${escHtml(b.name)}</td>
      <td class="amount-cell">${fmt(b.balance)}</td>
      <td>
        <span class="dept-tag" style="background:${b.balance > 50000 ? '#e6f4ea' : '#fee2e2'}; color:${b.balance > 50000 ? '#1a6b3a' : '#c53030'}">
          ${b.balance > 50000 ? 'Healthy' : 'Low'}
        </span>
      </td>
    </tr>
  `).join('');
}

// ===== TRANSACTIONS =====
async function loadTransactionsPage() {
  const [depts, cats] = await Promise.all([
    api('/transactions/meta/departments'),
    api('/transactions/meta/categories')
  ]);

  // Populate filters
  const deptSel = $('deptFilter');
  const catSel = $('catFilter');
  depts?.forEach(d => deptSel.insertAdjacentHTML('beforeend', `<option value="${d.deptid}">${d.Name}</option>`));
  cats?.forEach(c => catSel.insertAdjacentHTML('beforeend', `<option value="${c.cat_id}">${c.name}</option>`));

  loadTransactions();
}

async function loadTransactions() {
  const { page, limit, dept, cat, search } = state.tx;
  const params = new URLSearchParams({ page, limit });
  if (dept) params.append('dept', dept);
  if (cat) params.append('category', cat);
  if (search) params.append('search', search);

  $('txBody').innerHTML = '<tr><td colspan="7" class="loading-row">Loading transactions...</td></tr>';

  const data = await api('/transactions?' + params.toString());
  if (!data) {
    $('txBody').innerHTML = '<tr><td colspan="7" class="loading-row" style="color:red">Failed to load data</td></tr>';
    return;
  }

  renderTransactionRows(data.data || []);
  $('tableInfo').textContent = `Showing ${data.data?.length || 0} transactions`;
}

function renderTransactionRows(rows) {
  if (!rows.length) {
    $('txBody').innerHTML = '<tr><td colspan="7" class="loading-row">No transactions found.</td></tr>';
    return;
  }

  $('txBody').innerHTML = rows.map(r => `
    <tr>
      <td><span class="tid-badge">#${r.tid}</span></td>
      <td><strong>${r.empid}</strong></td>
      <td>${escHtml(r.employee_name)}</td>
      <td><span class="dept-tag">${escHtml(r.dept_name)}</span></td>
      <td><span class="cat-tag">${escHtml(r.category_name)}</span></td>
      <td><span class="items-text" title="${escHtml(r.items)}">${escHtml(r.items?.substring(0,60))}${r.items?.length > 60 ? '...' : ''}</span></td>
      <td class="amount-cell">${fmt(r.amount)}</td>
    </tr>
  `).join('');
}

function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== INIT =====
navigateTo('dashboard');