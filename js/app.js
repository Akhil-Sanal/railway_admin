// ===== STATE =====
const state = {
  page: 'dashboard',
  tx: { page: 1, limit: 15, dept: '', cat: '', search: '', total: 0 },
  charts: {},
  debounceTimer: null
};

// ===== UTILS =====
const $ = id => document.getElementById(id);
const fmt = n => '₹' + Number(n).toLocaleString('en-IN');
const fmtK = n => n >= 1e7 ? '₹' + (n/1e7).toFixed(1) + 'Cr' : n >= 1e5 ? '₹' + (n/1e5).toFixed(1) + 'L' : '₹' + Number(n).toLocaleString('en-IN');

async function api(path) {
  try {
    const r = await fetch('/api' + path);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  } catch (e) {
    console.error('API error:', path, e);
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
    const page = item.dataset.page;
    navigateTo(page);
    // close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
  });
});

$('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

function navigateTo(page) {
  state.page = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
  const titles = { dashboard: 'Dashboard', transactions: 'Transactions', analytics: 'Analytics', reports: 'Reports' };
  $('pageTitle').textContent = titles[page] || page;

  if (page === 'dashboard' && !state.dashLoaded) loadDashboard();
  if (page === 'transactions' && !state.txLoaded) loadTransactionMeta();
  if (page === 'analytics' && !state.analyticsLoaded) loadAnalytics();
  if (page === 'reports') loadReportFilters();
}

// ===== CHART HELPERS =====
const COLORS = ['#1a3a5c','#4f8ef7','#e8a020','#3ecf8e','#a855f7','#e74c3c','#06b6d4','#f59e0b','#10b981','#8b5cf6'];

function destroyChart(id) {
  if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
}

// ===== DASHBOARD =====
async function loadDashboard() {
  state.dashLoaded = true;
  const [summary, depts, cats, matrix] = await Promise.all([
    api('/analytics/summary'),
    api('/analytics/by-department'),
    api('/analytics/by-category'),
    api('/analytics/dept-category')
  ]);

  renderKPIs(summary);
  renderDeptChart(depts);
  renderCatChart(cats);
  renderMatrixChart(matrix);
}

function renderKPIs(d) {
  if (!d) return;
  const grid = $('kpiGrid');
  const cards = [
    { label: 'Total Transactions', value: d.total_transactions?.toLocaleString(), icon: '📋', cls: 'c1' },
    { label: 'Total Amount Spent', value: fmtK(d.total_amount || 0), icon: '💰', cls: 'c2' },
    { label: 'Active Employees', value: d.active_employees?.toLocaleString(), icon: '👥', cls: 'c3' },
    { label: 'Departments', value: d.total_departments?.toLocaleString(), icon: '🏢', cls: 'c4' }
  ];
  grid.innerHTML = cards.map(c => `
    <div class="kpi-card ${c.cls}">
      <div class="kpi-icon">${c.icon}</div>
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value ?? '—'}</div>
    </div>
  `).join('');
}

function renderDeptChart(depts) {
  if (!depts?.length) return;
  destroyChart('deptChart');
  const ctx = document.getElementById('deptChart').getContext('2d');
  state.charts['deptChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: depts.map(d => d.dept_name),
      datasets: [{
        label: 'Total Spend (₹)',
        data: depts.map(d => d.total_amount),
        backgroundColor: COLORS,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ' ' + fmt(c.raw) } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#f0f0f0' }, ticks: { callback: v => fmtK(v), font: { size: 11 } } }
      }
    }
  });
}

function renderCatChart(cats) {
  if (!cats?.length) return;
  destroyChart('catChart');
  const ctx = document.getElementById('catChart').getContext('2d');
  state.charts['catChart'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: cats.map(c => c.category_name),
      datasets: [{
        data: cats.map(c => c.total_amount),
        backgroundColor: COLORS,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 }, padding: 12 } },
        tooltip: { callbacks: { label: c => ' ' + c.label + ': ' + fmt(c.raw) } }
      }
    }
  });
}

function renderMatrixChart(data) {
  if (!data?.length) return;
  const depts = [...new Set(data.map(d => d.dept_name))];
  const cats = [...new Set(data.map(d => d.category_name))];

  const datasets = cats.map((cat, i) => ({
    label: cat,
    data: depts.map(dept => {
      const row = data.find(d => d.dept_name === dept && d.category_name === cat);
      return row ? row.total_amount : 0;
    }),
    backgroundColor: COLORS[i % COLORS.length] + 'cc',
    borderRadius: 4
  }));

  destroyChart('matrixChart');
  const ctx = document.getElementById('matrixChart').getContext('2d');
  state.charts['matrixChart'] = new Chart(ctx, {
    type: 'bar',
    data: { labels: depts, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 }, padding: 14 } },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + fmt(c.raw) } }
      },
      scales: {
        x: { stacked: false, grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#f0f0f0' }, ticks: { callback: v => fmtK(v), font: { size: 11 } } }
      }
    }
  });
}

// ===== TRANSACTIONS =====
async function loadTransactionMeta() {
  state.txLoaded = true;
  const [depts, cats] = await Promise.all([
    api('/transactions/meta/departments'),
    api('/transactions/meta/categories')
  ]);

  const deptSel = $('deptFilter');
  const catSel = $('catFilter');
  const pdfDept = $('pdfDept'); const xlsDept = $('xlsDept');
  const pdfCat = $('pdfCat'); const xlsCat = $('xlsCat');

  (depts || []).forEach(d => {
    const opt = `<option value="${d.deptid}">${d.Name}</option>`;
    deptSel.insertAdjacentHTML('beforeend', opt);
    pdfDept?.insertAdjacentHTML('beforeend', opt);
    xlsDept?.insertAdjacentHTML('beforeend', opt);
  });

  (cats || []).forEach(c => {
    const opt = `<option value="${c.cat_id}">${c.name}</option>`;
    catSel.insertAdjacentHTML('beforeend', opt);
    pdfCat?.insertAdjacentHTML('beforeend', opt);
    xlsCat?.insertAdjacentHTML('beforeend', opt);
  });

  loadTransactions();

  $('searchInput').addEventListener('input', () => {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      state.tx.search = $('searchInput').value;
      state.tx.page = 1;
      loadTransactions();
    }, 350);
  });

  $('deptFilter').addEventListener('change', () => { state.tx.dept = $('deptFilter').value; state.tx.page = 1; loadTransactions(); });
  $('catFilter').addEventListener('change', () => { state.tx.cat = $('catFilter').value; state.tx.page = 1; loadTransactions(); });
  $('clearFilters').addEventListener('click', () => {
    $('searchInput').value = ''; $('deptFilter').value = ''; $('catFilter').value = '';
    Object.assign(state.tx, { dept: '', cat: '', search: '', page: 1 });
    loadTransactions();
  });
}

async function loadTransactions() {
  const { page, limit, dept, cat, search } = state.tx;
  const params = new URLSearchParams({ page, limit });
  if (dept) params.append('dept', dept);
  if (cat) params.append('category', cat);
  if (search) params.append('search', search);

  $('txBody').innerHTML = '<tr><td colspan="6" class="loading-row">Loading…</td></tr>';

  const data = await api('/transactions?' + params);
  if (!data) { $('txBody').innerHTML = '<tr><td colspan="6" class="loading-row" style="color:#e74c3c">Failed to load. Check server connection.</td></tr>'; return; }

  state.tx.total = data.total;
  renderTransactionRows(data.data);
  renderTableMeta(data);
  renderPagination(data);
}

function renderTransactionRows(rows) {
  if (!rows.length) {
    $('txBody').innerHTML = '<tr><td colspan="6" class="loading-row">No transactions found.</td></tr>';
    return;
  }
  $('txBody').innerHTML = rows.map(r => `
    <tr onclick="openModal(${r.tid})">
      <td><span class="tid-badge">#${r.tid}</span></td>
      <td>${escHtml(r.employee_name)}</td>
      <td><span class="dept-tag">${escHtml(r.dept_name)}</span></td>
      <td><span class="cat-tag">${escHtml(r.category_name)}</span></td>
      <td><span class="items-text" title="${escHtml(r.items || '')}">${escHtml((r.items || '').substring(0, 50))}${r.items?.length > 50 ? '…' : ''}</span></td>
      <td class="amount-cell">${fmt(r.amount)}</td>
    </tr>
  `).join('');
}

function renderTableMeta(data) {
  const from = (data.page - 1) * data.limit + 1;
  const to = Math.min(data.page * data.limit, data.total);
  $('tableInfo').textContent = data.total > 0 ? `Showing ${from}–${to} of ${data.total} transactions` : 'No results';
}

function renderPagination(data) {
  const totalPages = Math.ceil(data.total / data.limit);
  const current = data.page;
  let html = `<button class="pg-btn" onclick="changePage(${current - 1})" ${current <= 1 ? 'disabled' : ''}>‹</button>`;

  const range = getPageRange(current, totalPages);
  range.forEach(p => {
    if (p === '…') html += `<span class="pg-btn" style="cursor:default">…</span>`;
    else html += `<button class="pg-btn ${p === current ? 'active' : ''}" onclick="changePage(${p})">${p}</button>`;
  });

  html += `<button class="pg-btn" onclick="changePage(${current + 1})" ${current >= totalPages ? 'disabled' : ''}>›</button>`;
  $('pagination').innerHTML = html;
}

function getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

function changePage(p) {
  const totalPages = Math.ceil(state.tx.total / state.tx.limit);
  if (p < 1 || p > totalPages) return;
  state.tx.page = p;
  loadTransactions();
}

// ===== MODAL =====
async function openModal(tid) {
  const data = await api('/transactions/' + tid);
  if (!data) return;
  $('modalBody').innerHTML = `
    <div class="modal-field"><label>Transaction ID</label><div class="val mono">#${data.tid}</div></div>
    <div class="modal-field"><label>Amount</label><div class="val amount">${fmt(data.amount)}</div></div>
    <div class="modal-field"><label>Employee</label><div class="val">${escHtml(data.employee_name)}</div></div>
    <div class="modal-field"><label>Department</label><div class="val">${escHtml(data.dept_name)}</div></div>
    <div class="modal-field"><label>Category</label><div class="val">${escHtml(data.category_name)}</div></div>
    <div class="modal-field"><label>Items / Description</label><div class="val" style="line-height:1.6;white-space:pre-wrap">${escHtml(data.items || '—')}</div></div>
  `;
  $('modalOverlay').classList.add('open');
}

$('modalClose').addEventListener('click', () => $('modalOverlay').classList.remove('open'));
$('modalOverlay').addEventListener('click', e => { if (e.target === $('modalOverlay')) $('modalOverlay').classList.remove('open'); });

// ===== ANALYTICS =====
async function loadAnalytics() {
  state.analyticsLoaded = true;
  const [depts, cats, employees, matrix] = await Promise.all([
    api('/analytics/by-department'),
    api('/analytics/by-category'),
    api('/analytics/top-employees'),
    api('/analytics/dept-category')
  ]);

  renderDeptBarH(depts);
  renderCatPie(cats);
  renderEmpList(employees);
  renderHeatmap(matrix);
}

function renderDeptBarH(depts) {
  if (!depts?.length) return;
  destroyChart('deptBarH');
  const h = Math.max(depts.length * 42 + 80, 200);
  document.querySelector('#page-analytics .chart-card:first-child .chart-wrap').style.height = h + 'px';
  const ctx = document.getElementById('deptBarH').getContext('2d');
  state.charts['deptBarH'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: depts.map(d => d.dept_name),
      datasets: [{
        data: depts.map(d => d.total_amount),
        backgroundColor: COLORS,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ' ' + fmt(c.raw) } }
      },
      scales: {
        x: { grid: { color: '#f0f0f0' }, ticks: { callback: v => fmtK(v), font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { font: { size: 12 } } }
      }
    }
  });
}

function renderCatPie(cats) {
  if (!cats?.length) return;
  destroyChart('catPie');
  const ctx = document.getElementById('catPie').getContext('2d');
  state.charts['catPie'] = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: cats.map(c => c.category_name),
      datasets: [{
        data: cats.map(c => c.total_amount),
        backgroundColor: COLORS,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } },
        tooltip: { callbacks: { label: c => ' ' + c.label + ': ' + fmt(c.raw) } }
      }
    }
  });
}

function renderEmpList(employees) {
  if (!employees?.length) { $('empList').innerHTML = '<p style="color:#8a99ad;padding:12px">No data</p>'; return; }
  const max = Math.max(...employees.map(e => Number(e.total_amount)));
  $('empList').innerHTML = employees.map((e, i) => {
    const pct = max > 0 ? Math.round(Number(e.total_amount) / max * 100) : 0;
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
    return `
      <div class="emp-row">
        <div class="emp-rank ${rankClass}">${i + 1}</div>
        <div class="emp-info">
          <div class="emp-name">${escHtml(e.employee_name)}</div>
          <div class="emp-dept">${escHtml(e.dept_name)}</div>
        </div>
        <div class="emp-bar-wrap">
          <div class="emp-bar-bg"><div class="emp-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="emp-amount">${fmt(e.total_amount)}</div>
      </div>
    `;
  }).join('');
}

function renderHeatmap(data) {
  if (!data?.length) { $('heatmapWrap').innerHTML = '<p style="color:#8a99ad;padding:16px">No data available</p>'; return; }
  const depts = [...new Set(data.map(d => d.dept_name))];
  const cats = [...new Set(data.map(d => d.category_name))];

  const maxVal = Math.max(...data.map(d => Number(d.total_amount)));

  let html = '<table class="heatmap-table"><thead><tr><th>Dept \\ Category</th>';
  cats.forEach(c => { html += `<th>${escHtml(c)}</th>`; });
  html += '</tr></thead><tbody>';

  depts.forEach(dept => {
    html += `<tr><td class="row-label">${escHtml(dept)}</td>`;
    cats.forEach(cat => {
      const row = data.find(d => d.dept_name === dept && d.category_name === cat);
      const val = row ? Number(row.total_amount) : 0;
      const intensity = maxVal > 0 ? val / maxVal : 0;
      const bg = heatColor(intensity);
      html += `<td style="background:${bg};color:${intensity > .5 ? '#fff' : '#333'}" title="${dept} × ${cat}: ${fmt(val)}">${val > 0 ? fmtK(val) : '—'}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  $('heatmapWrap').innerHTML = html;
}

function heatColor(t) {
  if (t === 0) return '#f8fafc';
  const r = Math.round(26 + (t * (230 - 26)));
  const g = Math.round(58 + (t * (58 - 58)));
  const b = Math.round(92 + (t * (92 - 92)));
  const r2 = Math.round(26 + t * 204);
  const g2 = Math.round(58 + t * 0);
  const b2 = Math.round(92 - t * 92);
  return `rgb(${r2},${g2},${b2})`;
}

// ===== REPORTS =====
function loadReportFilters() {
  if (state.reportFiltersLoaded) return;
  state.reportFiltersLoaded = true;
  if (state.txLoaded) return; // already loaded via transactions
  // Load meta if not already done
  api('/transactions/meta/departments').then(depts => {
    (depts || []).forEach(d => {
      const opt = `<option value="${d.deptid}">${d.Name}</option>`;
      $('pdfDept')?.insertAdjacentHTML('beforeend', opt);
      $('xlsDept')?.insertAdjacentHTML('beforeend', opt);
    });
  });
  api('/transactions/meta/categories').then(cats => {
    (cats || []).forEach(c => {
      const opt = `<option value="${c.cat_id}">${c.name}</option>`;
      $('pdfCat')?.insertAdjacentHTML('beforeend', opt);
      $('xlsCat')?.insertAdjacentHTML('beforeend', opt);
    });
  });
}

function buildReportParams(deptEl, catEl) {
  const p = new URLSearchParams();
  const d = $(deptEl)?.value; const c = $(catEl)?.value;
  if (d) p.append('dept', d);
  if (c) p.append('category', c);
  return p.toString() ? '?' + p.toString() : '';
}

$('downloadPdf').addEventListener('click', () => {
  $('downloadPdf').textContent = '⏳ Generating…';
  const url = '/api/reports/pdf' + buildReportParams('pdfDept', 'pdfCat');
  const a = document.createElement('a');
  a.href = url; a.download = 'railway-report.pdf'; a.click();
  setTimeout(() => { $('downloadPdf').innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download PDF`; }, 2000);
});

$('downloadExcel').addEventListener('click', () => {
  $('downloadExcel').textContent = '⏳ Generating…';
  const url = '/api/reports/excel' + buildReportParams('xlsDept', 'xlsCat');
  const a = document.createElement('a');
  a.href = url; a.download = 'railway-report.xlsx'; a.click();
  setTimeout(() => { $('downloadExcel').innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Excel`; }, 2000);
});

// ===== HELPERS =====
function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== INIT =====
navigateTo('dashboard');
