
const DEFAULT_PRODUCTS = [
  { id: "sunflower_salted", en: "Salted Sunflower", ar: "دوار الشمس مالح", salePrice: 4.90, procurementPrice: 3.40 },
  { id: "sunflower_lemon", en: "Lemon Sunflower", ar: "دوار الشمس ليمون", salePrice: 5.20, procurementPrice: 3.60 },
  { id: "pumpkin", en: "Pumpkin Seeds", ar: "بزر القرع", salePrice: 7.50, procurementPrice: 5.20 },
  { id: "watermelon", en: "Watermelon Seeds", ar: "بزر البطيخ", salePrice: 7.20, procurementPrice: 5.00 },
  { id: "peanuts", en: "Peanuts", ar: "فول سوداني", salePrice: 6.20, procurementPrice: 4.10 },
  { id: "almonds", en: "Almonds", ar: "لوز", salePrice: 13.90, procurementPrice: 10.80 },
  { id: "cashews", en: "Cashews", ar: "كاجو", salePrice: 15.50, procurementPrice: 12.40 },
  { id: "pistachio", en: "Pistachio", ar: "فستق", salePrice: 18.50, procurementPrice: 14.90 },
  { id: "hazelnut", en: "Hazelnut", ar: "بندق", salePrice: 14.50, procurementPrice: 11.20 },
  { id: "mix_salted", en: "Salted Mix", ar: "مكسرات مشكلة مالحة", salePrice: 14.20, procurementPrice: 10.70 },
  { id: "mix_sour", en: "Sour Mix", ar: "مكسرات مشكلة حامضة", salePrice: 14.20, procurementPrice: 10.70 }
];

const STORAGE_KEYS = {
  products: "taj_products_v12_restore",
  saleState: "taj_sale_state_v12_restore",
  dayHistory: "taj_day_history_v12_restore",
  appSettings: "taj_app_settings_v12_restore"
};

let deferredPrompt = null;
let state = loadState();

function loadState() {
  const products = JSON.parse(localStorage.getItem(STORAGE_KEYS.products) || "null") || DEFAULT_PRODUCTS;
  const sale = JSON.parse(localStorage.getItem(STORAGE_KEYS.saleState) || "{}");
  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.dayHistory) || "[]");
  const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.appSettings) || "null") || {
    hourlyRate: 10,
    dayDate: new Date().toISOString().slice(0, 10)
  };
  return { products, sale, history, settings };
}

function saveProducts() {
  localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(state.products));
}
function saveSale() {
  localStorage.setItem(STORAGE_KEYS.saleState, JSON.stringify(state.sale));
}
function saveHistory() {
  localStorage.setItem(STORAGE_KEYS.dayHistory, JSON.stringify(state.history));
}
function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.appSettings, JSON.stringify(state.settings));
}
function money(value) {
  return "€" + Number(value || 0).toFixed(2);
}
function qtyFor(id) {
  return Number(state.sale[id] || 0);
}
function procurementFor(product) {
  return Number(product.procurementPrice || 0);
}
function revenueFor(product) {
  return qtyFor(product.id) * Number(product.salePrice || 0);
}
function cogsFor(product) {
  return qtyFor(product.id) * procurementFor(product);
}
function totals() {
  let revenue = 0;
  let cogs = 0;
  let kg = 0;
  state.products.forEach(p => {
    const q = qtyFor(p.id);
    revenue += q * Number(p.salePrice || 0);
    cogs += q * procurementFor(p);
    kg += q;
  });
  return { revenue, cogs, gross: revenue - cogs, kg };
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";
  state.products.forEach(product => {
    const card = document.createElement("div");
    card.className = "product";
    card.innerHTML = `
      <h3>${escapeHtml(product.en)}</h3>
      <div class="ar">${escapeHtml(product.ar)}</div>
      <div class="price-line"><span>Sale price / kg</span><strong>${money(product.salePrice)}</strong></div>
      <div class="price-line"><span>Procurement / kg</span><strong>${money(procurementFor(product))}</strong></div>
      <div class="qty-row">
        <div>
          <div class="metric-label">Quantity</div>
          <div class="qty-badge">${qtyFor(product.id)} kg</div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn secondary" data-act="minus" data-id="${product.id}">−</button>
          <button class="qty-btn" data-act="plus" data-id="${product.id}">+1</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const current = qtyFor(id);
      state.sale[id] = act === "plus" ? current + 1 : Math.max(0, current - 1);
      if (state.sale[id] === 0) delete state.sale[id];
      saveSale();
      updateSalesSummary();
      renderProducts();
      updateAccountingPreview();
    });
  });
}

function updateSalesSummary() {
  const t = totals();
  document.getElementById("salesRevenue").textContent = money(t.revenue);
  document.getElementById("salesCogs").textContent = money(t.cogs);
  document.getElementById("salesGross").textContent = money(t.gross);
  document.getElementById("salesKg").textContent = `${t.kg} kg`;
}

function renderProcurement() {
  const wrap = document.getElementById("procurementList");
  wrap.innerHTML = "";
  state.products.forEach(product => {
    const row = document.createElement("div");
    row.className = "price-item";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(product.en)}</strong>
        <div class="metric-label">${escapeHtml(product.ar)}</div>
      </div>
      <div>
        <input type="number" step="0.01" min="0" value="${Number(product.procurementPrice || 0).toFixed(2)}" data-proc-id="${product.id}" />
      </div>
    `;
    wrap.appendChild(row);
  });
}

function saveProcurementPrices() {
  document.querySelectorAll("[data-proc-id]").forEach(input => {
    const product = state.products.find(p => p.id === input.dataset.procId);
    if (product) product.procurementPrice = Number(input.value || 0);
  });
  saveProducts();
  renderProducts();
  updateSalesSummary();
  updateAccountingPreview();
  alert("Procurement prices saved.");
}

function updateAccountingPreview() {
  const t = totals();
  const km = Number(document.getElementById("kmDriven").value || 0);
  const consumption = Number(document.getElementById("carConsumption").value || 0);
  const fuelPrice = Number(document.getElementById("fuelPrice").value || 0);
  const hours = Number(document.getElementById("hoursWorked").value || 0);
  const hourlyRate = Number(document.getElementById("hourlyRate").value || 0);

  const fuelCost = (km * consumption / 100) * fuelPrice;
  const labourCost = hours * hourlyRate;
  const netProfit = t.revenue - t.cogs - fuelCost - labourCost;

  document.getElementById("previewRevenue").textContent = money(t.revenue);
  document.getElementById("previewCogs").textContent = money(t.cogs);
  document.getElementById("previewFuel").textContent = money(fuelCost);
  document.getElementById("previewLabour").textContent = money(labourCost);
  document.getElementById("previewNet").textContent = money(netProfit);

  state.settings.hourlyRate = hourlyRate;
  state.settings.dayDate = document.getElementById("dayDate").value;
  saveSettings();

  return {
    date: document.getElementById("dayDate").value,
    km,
    consumption,
    fuelPrice,
    hours,
    hourlyRate,
    fuelCost,
    labourCost,
    revenue: t.revenue,
    cogs: t.cogs,
    grossProfit: t.gross,
    netProfit,
    totalKg: t.kg,
    saleBreakdown: state.products
      .filter(p => qtyFor(p.id) > 0)
      .map(p => ({
        id: p.id,
        en: p.en,
        ar: p.ar,
        qtyKg: qtyFor(p.id),
        salePrice: Number(p.salePrice || 0),
        procurementPrice: procurementFor(p)
      }))
  };
}

function renderHistory() {
  const wrap = document.getElementById("historyList");
  wrap.innerHTML = "";
  if (!state.history.length) {
    wrap.innerHTML = `<div class="history-item"><span class="metric-label">No saved days yet.</span></div>`;
    return;
  }
  [...state.history].reverse().forEach(day => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <strong>${escapeHtml(day.date || "")}</strong>
      <div class="metric-label">Revenue: ${money(day.revenue)} | COGS: ${money(day.cogs)} | Fuel: ${money(day.fuelCost)} | Labour: ${money(day.labourCost)} | Net: ${money(day.netProfit)}</div>
      <div class="metric-label">Km: ${day.km} | Hours: ${day.hours} | Total Kg: ${day.totalKg}</div>
    `;
    wrap.appendChild(div);
  });
}

function endDay() {
  const data = updateAccountingPreview();
  if (!data.date) {
    alert("Please choose the date first.");
    return;
  }
  state.history.push(data);
  saveHistory();
  state.sale = {};
  saveSale();
  renderProducts();
  updateSalesSummary();
  renderHistory();
  renderDashboard();
  alert("Day saved and sale reset for a new day.");
}

function renderDashboard() {
  const days = state.history.length;
  const totalRevenue = state.history.reduce((a, b) => a + Number(b.revenue || 0), 0);
  const totalNet = state.history.reduce((a, b) => a + Number(b.netProfit || 0), 0);
  const avgNet = days ? totalNet / days : 0;

  document.getElementById("dashDays").textContent = String(days);
  document.getElementById("dashRevenue").textContent = money(totalRevenue);
  document.getElementById("dashNet").textContent = money(totalNet);
  document.getElementById("dashAvg").textContent = money(avgNet);

  drawProfitChart(state.history);
}

function drawProfitChart(items) {
  const canvas = document.getElementById("profitChart");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const left = 60;
  const right = 20;
  const top = 20;
  const bottom = 40;
  const chartW = w - left - right;
  const chartH = h - top - bottom;

  ctx.strokeStyle = "#d0d7e2";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(w - right, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, h - bottom);
  ctx.lineTo(w - right, h - bottom);
  ctx.strokeStyle = "#7b8794";
  ctx.stroke();

  if (!items.length) {
    ctx.fillStyle = "#667085";
    ctx.font = "16px Arial";
    ctx.fillText("No saved days yet.", left + 20, top + 40);
    return;
  }

  const values = items.map(i => Number(i.netProfit || 0));
  const maxVal = Math.max(...values, 0);
  const minVal = Math.min(...values, 0);
  const range = Math.max(1, maxVal - minVal);

  ctx.fillStyle = "#667085";
  ctx.font = "12px Arial";
  ctx.fillText(money(maxVal), 8, top + 4);
  ctx.fillText(money(minVal), 8, h - bottom);

  const points = values.map((v, index) => {
    const x = left + (items.length === 1 ? chartW / 2 : (chartW * index) / (items.length - 1));
    const y = top + chartH - ((v - minVal) / range) * chartH;
    return { x, y, v, date: items[index].date };
  });

  ctx.strokeStyle = "#1f6feb";
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((p, idx) => {
    if (idx === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  ctx.fillStyle = "#1f6feb";
  points.forEach((p, idx) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#667085";
    ctx.font = "11px Arial";
    const label = String(p.date || "").slice(5);
    ctx.fillText(label, p.x - 16, h - 16);
    ctx.fillStyle = "#1f6feb";
  });
}

function backupData() {
  const data = {
    exportedAt: new Date().toISOString(),
    products: state.products,
    sale: state.sale,
    history: state.history,
    settings: state.settings
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "taj-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

function restoreData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.products || !data.history) throw new Error("Invalid backup file.");
      state.products = data.products;
      state.sale = data.sale || {};
      state.history = data.history || [];
      state.settings = data.settings || { hourlyRate: 10, dayDate: new Date().toISOString().slice(0, 10) };
      saveProducts();
      saveSale();
      saveHistory();
      saveSettings();
      initUI();
      alert("Backup restored.");
    } catch (e) {
      alert("Restore failed. Wrong file.");
    }
  };
  reader.readAsText(file);
}

function resetTodaySale() {
  state.sale = {};
  saveSale();
  renderProducts();
  updateSalesSummary();
  updateAccountingPreview();
}

function clearHistory() {
  if (!confirm("Clear all saved day history?")) return;
  state.history = [];
  saveHistory();
  renderHistory();
  renderDashboard();
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "dashboard") renderDashboard();
    });
  });
}

function initUI() {
  document.getElementById("dayDate").value = state.settings.dayDate || new Date().toISOString().slice(0, 10);
  document.getElementById("hourlyRate").value = Number(state.settings.hourlyRate || 10);
  renderProducts();
  updateSalesSummary();
  renderProcurement();
  renderHistory();
  updateAccountingPreview();
  renderDashboard();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById("installBtn").hidden = false;
});

document.getElementById("installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById("installBtn").hidden = true;
});

document.getElementById("backupBtn").addEventListener("click", backupData);
document.getElementById("restoreInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) restoreData(file);
});
document.getElementById("saveProcurementBtn").addEventListener("click", saveProcurementPrices);
document.getElementById("resetSaleBtn").addEventListener("click", resetTodaySale);
document.getElementById("clearHistoryBtn").addEventListener("click", clearHistory);
document.getElementById("endDayBtn").addEventListener("click", endDay);

["dayDate","kmDriven","carConsumption","fuelPrice","hoursWorked","hourlyRate"].forEach(id => {
  document.getElementById(id).addEventListener("input", updateAccountingPreview);
});

setupTabs();
initUI();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
