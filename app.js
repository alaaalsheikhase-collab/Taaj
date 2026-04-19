const STORAGE_KEY = 'family_market_delivery_system_v1';

const defaultProducts = [
  { id: uid(), en: 'Sunflower Seeds', ar: 'بزر دوار الشمس', salePriceKg: 3.8, procurementPriceKg: 0, bagKg: 5, stockBags: 0 },
  { id: uid(), en: 'Pumpkin Seeds', ar: 'بزر القرع', salePriceKg: 5.5, procurementPriceKg: 0, bagKg: 5, stockBags: 0 },
  { id: uid(), en: 'Watermelon Seeds', ar: 'بزر البطيخ', salePriceKg: 5.0, procurementPriceKg: 0, bagKg: 5, stockBags: 0 },
  { id: uid(), en: 'Peanuts', ar: 'فول سوداني', salePriceKg: 4.6, procurementPriceKg: 0, bagKg: 5, stockBags: 0 },
  { id: uid(), en: 'Almonds', ar: 'لوز', salePriceKg: 10.5, procurementPriceKg: 0, bagKg: 5, stockBags: 0 },
  { id: uid(), en: 'Cashews', ar: 'كاجو', salePriceKg: 11.5, procurementPriceKg: 0, bagKg: 5, stockBags: 0 },
  { id: uid(), en: 'Pistachios', ar: 'فستق حلبي', salePriceKg: 13.5, procurementPriceKg: 0, bagKg: 5, stockBags: 0 },
  { id: uid(), en: 'Sour Mix Nuts', ar: 'مكسرات مشكلة حامضة', salePriceKg: 8.2, procurementPriceKg: 0, bagKg: 7, stockBags: 0 },
  { id: uid(), en: 'Salted Mix Nuts', ar: 'مكسرات مشكلة مالحة', salePriceKg: 8.2, procurementPriceKg: 0, bagKg: 7, stockBags: 0 }
];

const state = loadState();
let route = 'home';
let currentDraft = emptyDraft();

const view = document.getElementById('view');
const homeActions = document.getElementById('homeActions');

window.addEventListener('load', () => {
  renderNav();
  render();
  registerSW();
});

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDraft() {
  return { date: todayKey(), customer: '', note: '', items: {} };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    parsed.products = parsed.products?.length ? parsed.products : structuredClone(defaultProducts);
    parsed.days = parsed.days || {};
    parsed.history = parsed.history || [];
    ensureToday(parsed);
    return parsed;
  }
  const fresh = { products: structuredClone(defaultProducts), days: {}, history: [] };
  ensureToday(fresh);
  saveState(fresh);
  return fresh;
}

function ensureToday(s) {
  const key = todayKey();
  if (!s.days[key]) s.days[key] = { fuel: { km: 0, litersPer100: 0, fuelPrice: 0 }, deliveries: [], ended: false };
}

function saveState(s = state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function money(n) { return `€${Number(n || 0).toFixed(2)}`; }
function num(n) { return Number(n || 0); }

function renderNav() {
  homeActions.innerHTML = `
    <button class="nav-btn" data-route="home">Home</button>
    <button class="nav-btn secondary" data-route="new-delivery">New Lieferschein</button>
    <button class="nav-btn secondary" data-route="dashboard">Dashboard</button>
  `;
  homeActions.querySelectorAll('[data-route]').forEach(btn => btn.onclick = () => navigate(btn.dataset.route));
}

function navigate(next) {
  route = next;
  render();
}

function render() {
  ensureToday(state);
  switch (route) {
    case 'home': renderHome(); break;
    case 'new-delivery': renderNewDelivery(); break;
    case 'edit-products': renderEditProducts(); break;
    case 'stock': renderStock(); break;
    case 'procurement': renderProcurement(); break;
    case 'fuel': renderFuel(); break;
    case 'dashboard': renderDashboard(); break;
    case 'backup': renderBackup(); break;
    default: renderHome();
  }
}

function renderHome() {
  view.innerHTML = document.getElementById('home-template').innerHTML;
  view.querySelectorAll('[data-route]').forEach(btn => btn.onclick = () => navigate(btn.dataset.route));
}

function renderNewDelivery() {
  const products = state.products;
  const today = getToday();
  const itemCards = products.map(p => {
    const bags = currentDraft.items[p.id] || 0;
    const kilos = bags * p.bagKg;
    const line = kilos * p.salePriceKg;
    return `
      <div class="product-card">
        <div class="product-head">
          <div>
            <h3>${escapeHtml(p.en)}</h3>
            <div class="product-meta">${escapeHtml(p.ar)} · ${p.bagKg} kg per bag · Sale: ${money(p.salePriceKg)}/kg</div>
          </div>
          <div class="qty-pill">${bags} bag(s) · ${kilos} kg</div>
        </div>
        <div class="qty-controls">
          <button class="small-btn secondary" onclick="changeQty('${p.id}', -1)">-1 bag</button>
          <button class="small-btn" onclick="changeQty('${p.id}', 1)">+1 bag</button>
          <span class="product-meta">Amount: ${money(line)}</span>
        </div>
      </div>`;
  }).join('');

  const totals = calcDraftTotals();
  view.innerHTML = `
    <section class="panel">
      <h2>New Lieferschein</h2>
      <div class="row" style="margin-top:14px">
        <div class="col-4"><label>Date</label><input id="draftDate" type="date" value="${currentDraft.date}" /></div>
        <div class="col-4"><label>Customer / Store</label><input id="draftCustomer" placeholder="Customer name" value="${escapeAttr(currentDraft.customer)}" /></div>
        <div class="col-4"><label>Note</label><input id="draftNote" placeholder="Optional note" value="${escapeAttr(currentDraft.note)}" /></div>
      </div>
      <div class="list">${itemCards}</div>
      <div class="summary">
        <div class="summary-box"><h4>Total bags</h4><div class="value">${totals.bags}</div></div>
        <div class="summary-box"><h4>Total kilos</h4><div class="value">${totals.kilos}</div></div>
        <div class="summary-box"><h4>Sales amount</h4><div class="value">${money(totals.sales)}</div></div>
        <div class="summary-box"><h4>Cost of goods</h4><div class="value">${money(totals.cogs)}</div></div>
      </div>
      <div class="inline-actions" style="margin-top:16px">
        <button class="small-btn success" id="saveDeliveryBtn">Save Lieferschein</button>
        <button class="small-btn secondary" id="clearDraftBtn">Clear</button>
      </div>
      <div class="notice">Each press adds 1 bag. Amount is calculated by kilograms. Standard bag weight is 5 kg. Mix nuts can be 7 kg.</div>
    </section>`;

  document.getElementById('draftDate').onchange = e => currentDraft.date = e.target.value;
  document.getElementById('draftCustomer').oninput = e => currentDraft.customer = e.target.value;
  document.getElementById('draftNote').oninput = e => currentDraft.note = e.target.value;
  document.getElementById('saveDeliveryBtn').onclick = saveDelivery;
  document.getElementById('clearDraftBtn').onclick = () => { currentDraft = emptyDraft(); render(); };
}

window.changeQty = function (id, delta) {
  const next = Math.max(0, (currentDraft.items[id] || 0) + delta);
  currentDraft.items[id] = next;
  if (next === 0) delete currentDraft.items[id];
  renderNewDelivery();
};

function calcDraftTotals() {
  let bags = 0, kilos = 0, sales = 0, cogs = 0;
  for (const p of state.products) {
    const bagCount = currentDraft.items[p.id] || 0;
    const kg = bagCount * p.bagKg;
    bags += bagCount;
    kilos += kg;
    sales += kg * p.salePriceKg;
    cogs += kg * (p.procurementPriceKg || 0);
  }
  return { bags, kilos, sales, cogs };
}

function saveDelivery() {
  const totals = calcDraftTotals();
  if (!totals.bags) return alert('Please add at least one bag.');
  const key = currentDraft.date || todayKey();
  if (!state.days[key]) state.days[key] = { fuel: { km: 0, litersPer100: 0, fuelPrice: 0 }, deliveries: [], ended: false };

  const items = state.products
    .filter(p => currentDraft.items[p.id])
    .map(p => ({
      productId: p.id,
      en: p.en,
      ar: p.ar,
      bags: currentDraft.items[p.id],
      kg: currentDraft.items[p.id] * p.bagKg,
      salePriceKg: p.salePriceKg,
      procurementPriceKg: p.procurementPriceKg || 0,
      amount: currentDraft.items[p.id] * p.bagKg * p.salePriceKg,
      cogs: currentDraft.items[p.id] * p.bagKg * (p.procurementPriceKg || 0)
    }));

  state.days[key].deliveries.push({
    id: uid(),
    date: key,
    customer: currentDraft.customer,
    note: currentDraft.note,
    items,
    totals
  });

  for (const item of items) {
    const p = state.products.find(x => x.id === item.productId);
    if (p) p.stockBags = Math.max(0, num(p.stockBags) - num(item.bags));
  }

  saveState();
  currentDraft = emptyDraft();
  alert('Lieferschein saved.');
  navigate('dashboard');
}

function renderEditProducts() {
  const rows = state.products.map((p, i) => `
    <div class="item-line">
      <input value="${escapeAttr(p.en)}" data-field="en" data-id="${p.id}" placeholder="English name" />
      <input value="${escapeAttr(p.ar)}" data-field="ar" data-id="${p.id}" placeholder="Arabic name" />
      <input type="number" step="0.01" value="${num(p.salePriceKg)}" data-field="salePriceKg" data-id="${p.id}" placeholder="Sale €/kg" />
      <input type="number" step="1" value="${num(p.bagKg)}" data-field="bagKg" data-id="${p.id}" placeholder="Kg per bag" />
      <button class="small-btn danger" onclick="removeProduct('${p.id}')">Delete</button>
    </div>`).join('');

  view.innerHTML = `
    <section class="panel">
      <h2>Edit Product List</h2>
      <div class="table-like">${rows}</div>
      <div class="inline-actions" style="margin-top:16px">
        <button class="small-btn" id="addProductBtn">Add Product</button>
        <button class="small-btn success" id="saveProductsBtn">Save Changes</button>
      </div>
    </section>`;

  document.getElementById('addProductBtn').onclick = () => {
    state.products.push({ id: uid(), en: '', ar: '', salePriceKg: 0, procurementPriceKg: 0, bagKg: 5, stockBags: 0 });
    saveState();
    renderEditProducts();
  };
  document.getElementById('saveProductsBtn').onclick = () => {
    view.querySelectorAll('[data-field]').forEach(input => {
      const p = state.products.find(x => x.id === input.dataset.id);
      if (!p) return;
      const field = input.dataset.field;
      p[field] = ['salePriceKg', 'bagKg'].includes(field) ? num(input.value) : input.value;
    });
    saveState();
    alert('Products saved.');
    renderEditProducts();
  };
}

window.removeProduct = function(id) {
  if (!confirm('Delete this product?')) return;
  state.products = state.products.filter(p => p.id !== id);
  saveState();
  renderEditProducts();
};

function renderStock() {
  const rows = state.products.map(p => `
    <div class="item-line">
      <div><strong>${escapeHtml(p.en)}</strong><div class="product-meta">${escapeHtml(p.ar)}</div></div>
      <div>${num(p.bagKg)} kg/bag</div>
      <input type="number" step="1" value="${num(p.stockBags)}" data-stock-id="${p.id}" />
      <div>${num(p.stockBags) * num(p.bagKg)} kg</div>
      <span></span>
    </div>`).join('');

  view.innerHTML = `
    <section class="panel">
      <h2>Stock Values</h2>
      <div class="table-like">${rows}</div>
      <div class="inline-actions" style="margin-top:16px">
        <button class="small-btn success" id="saveStockBtn">Save Stock</button>
      </div>
    </section>`;

  document.getElementById('saveStockBtn').onclick = () => {
    view.querySelectorAll('[data-stock-id]').forEach(input => {
      const p = state.products.find(x => x.id === input.dataset.stockId);
      if (p) p.stockBags = Math.max(0, num(input.value));
    });
    saveState();
    alert('Stock saved.');
    renderStock();
  };
}

function renderProcurement() {
  const rows = state.products.map(p => `
    <div class="item-line">
      <div><strong>${escapeHtml(p.en)}</strong><div class="product-meta">${escapeHtml(p.ar)}</div></div>
      <div>${num(p.bagKg)} kg/bag</div>
      <input type="number" step="0.01" value="${num(p.procurementPriceKg)}" data-proc-id="${p.id}" placeholder="€/kg" />
      <div>${money(num(p.procurementPriceKg) * num(p.bagKg))}/bag</div>
      <span></span>
    </div>`).join('');

  view.innerHTML = `
    <section class="panel">
      <h2>Procurement Prices</h2>
      <div class="table-like">${rows}</div>
      <div class="inline-actions" style="margin-top:16px">
        <button class="small-btn success" id="saveProcBtn">Save Prices</button>
      </div>
    </section>`;

  document.getElementById('saveProcBtn').onclick = () => {
    view.querySelectorAll('[data-proc-id]').forEach(input => {
      const p = state.products.find(x => x.id === input.dataset.procId);
      if (p) p.procurementPriceKg = Math.max(0, num(input.value));
    });
    saveState();
    alert('Procurement prices saved.');
    renderProcurement();
  };
}

function getToday() {
  ensureToday(state);
  return state.days[todayKey()];
}

function renderFuel() {
  const fuel = getToday().fuel || { km: 0, litersPer100: 0, fuelPrice: 0 };
  const cost = fuelCost(fuel);
  view.innerHTML = `
    <section class="panel">
      <h2>Fuel Data for Today</h2>
      <div class="row" style="margin-top:14px">
        <div class="col-4"><label>Kilometers driven today</label><input id="fuelKm" type="number" step="0.1" value="${num(fuel.km)}"></div>
        <div class="col-4"><label>Consumption (liters / 100 km)</label><input id="fuelCons" type="number" step="0.1" value="${num(fuel.litersPer100)}"></div>
        <div class="col-4"><label>Fuel price (€/liter)</label><input id="fuelPrice" type="number" step="0.01" value="${num(fuel.fuelPrice)}"></div>
      </div>
      <div class="summary">
        <div class="summary-box"><h4>Fuel cost today</h4><div class="value">${money(cost)}</div></div>
      </div>
      <div class="inline-actions" style="margin-top:16px"><button class="small-btn success" id="saveFuelBtn">Save Fuel Data</button></div>
    </section>`;

  document.getElementById('saveFuelBtn').onclick = () => {
    getToday().fuel = {
      km: num(document.getElementById('fuelKm').value),
      litersPer100: num(document.getElementById('fuelCons').value),
      fuelPrice: num(document.getElementById('fuelPrice').value)
    };
    saveState();
    alert('Fuel data saved.');
    renderFuel();
  };
}

function fuelCost(fuel) {
  return (num(fuel.km) / 100) * num(fuel.litersPer100) * num(fuel.fuelPrice);
}

function renderDashboard() {
  const key = todayKey();
  const day = getToday();
  const totals = dayTotals(day);
  view.innerHTML = `
    <section class="panel">
      <h2>End Day / Dashboard</h2>
      <div class="summary">
        <div class="summary-box"><h4>Sales today</h4><div class="value">${money(totals.sales)}</div></div>
        <div class="summary-box"><h4>Cost of goods today</h4><div class="value">${money(totals.cogs)}</div></div>
        <div class="summary-box"><h4>Fuel cost today</h4><div class="value">${money(totals.fuel)}</div></div>
        <div class="summary-box"><h4>Gross profit</h4><div class="value">${money(totals.gross)}</div></div>
        <div class="summary-box"><h4>Net profit</h4><div class="value">${money(totals.net)}</div></div>
      </div>
      <canvas id="trendChart" width="1000" height="280"></canvas>
      <div class="inline-actions" style="margin-top:16px">
        <button class="small-btn success" id="endDayBtn">End Day</button>
      </div>
      <div class="list" style="margin-top:16px">
        ${(day.deliveries || []).map(d => `
          <div class="product-card">
            <div class="product-head"><div><h3>${escapeHtml(d.customer || 'Customer')}</h3><div class="product-meta">${d.date}${d.note ? ' · ' + escapeHtml(d.note) : ''}</div></div><div class="qty-pill">${money(d.totals.sales)}</div></div>
            <div class="product-meta" style="margin-top:8px">${d.items.map(i => `${i.en}: ${i.bags} bag(s) / ${i.kg} kg`).join(' · ')}</div>
          </div>`).join('') || '<div class="notice">No deliveries saved today yet.</div>'}
      </div>
    </section>`;

  document.getElementById('endDayBtn').onclick = () => {
    const summary = { date: key, ...totals };
    state.history = state.history.filter(x => x.date !== key);
    state.history.push(summary);
    state.days[key].ended = true;
    saveState();
    alert('Day saved to history.');
    drawTrend();
  };
  drawTrend();
}

function dayTotals(day) {
  const sales = (day.deliveries || []).reduce((a, d) => a + num(d.totals.sales), 0);
  const cogs = (day.deliveries || []).reduce((a, d) => a + num(d.totals.cogs), 0);
  const fuel = fuelCost(day.fuel || {});
  const gross = sales - cogs;
  const net = gross - fuel;
  return { sales, cogs, fuel, gross, net };
}

function drawTrend() {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const points = [...state.history].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  if (!points.length) {
    ctx.font = '20px Arial';
    ctx.fillText('No saved daily history yet.', 30, 60);
    return;
  }
  const values = points.map(p => p.net);
  const max = Math.max(...values, 10);
  const min = Math.min(...values, 0);
  const pad = 40;
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, canvas.height - pad);
  ctx.lineTo(canvas.width - pad, canvas.height - pad);
  ctx.stroke();
  ctx.strokeStyle = '#1d4ed8';
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = pad + (i * (canvas.width - pad * 2) / Math.max(points.length - 1, 1));
    const y = canvas.height - pad - ((p.net - min) / Math.max(max - min, 1)) * (canvas.height - pad * 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = '#111827';
  ctx.font = '14px Arial';
  points.forEach((p, i) => {
    const x = pad + (i * (canvas.width - pad * 2) / Math.max(points.length - 1, 1));
    const y = canvas.height - pad - ((p.net - min) / Math.max(max - min, 1)) * (canvas.height - pad * 2);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(p.date.slice(5), x - 18, canvas.height - 14);
  });
}

function renderBackup() {
  view.innerHTML = `
    <section class="panel">
      <h2>Backup / Restore</h2>
      <div class="inline-actions">
        <button class="small-btn" id="exportBtn">Export Backup</button>
      </div>
      <div style="margin-top:16px">
        <label>Restore from backup file</label>
        <input type="file" id="importFile" accept="application/json" />
      </div>
      <pre id="backupPreview"></pre>
    </section>`;

  document.getElementById('exportBtn').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-market-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    document.getElementById('backupPreview').textContent = JSON.stringify(state, null, 2).slice(0, 4000);
  };
  document.getElementById('importFile').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    location.reload();
  };
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function escapeAttr(str = '') { return escapeHtml(str); }
