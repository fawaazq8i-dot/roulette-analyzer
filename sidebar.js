const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function getColor(n) {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

// ── State ────────────────────────────────────────────────────────────────────
let allNumbers = [];   // [{ n, t, dealer }]
let dealers    = [];   // ["Ahmed", "Sara", ...]
let currentDealer = "";

function saveState() {
  chrome.storage.local.set({ numbers: allNumbers, dealers, currentDealer });
}

// ── Stats computation ─────────────────────────────────────────────────────────
function computeStats(numbers) {
  const freq = {};
  for (let i = 0; i <= 36; i++) freq[i] = 0;
  let red = 0, black = 0, green = 0, odd = 0, even = 0;

  numbers.forEach(({ n }) => {
    freq[n]++;
    const c = getColor(n);
    if (c === "red") red++; else if (c === "black") black++; else green++;
    if (n !== 0) { if (n % 2 === 1) odd++; else even++; }
  });

  const total = numbers.length;
  const lastSeen = {};
  numbers.forEach(({ n }, idx) => { lastSeen[n] = idx; });

  const overdue = [];
  for (let i = 0; i <= 36; i++) {
    const last = lastSeen[i] !== undefined ? lastSeen[i] : -1;
    const gap = total - 1 - last;
    if (gap >= 37) overdue.push({ n: i, gap });
  }
  overdue.sort((a, b) => b.gap - a.gap);

  const sorted = Object.entries(freq)
    .map(([n, count]) => ({ n: parseInt(n), count }))
    .sort((a, b) => b.count - a.count);

  return { freq, red, black, green, odd, even, total, sorted, overdue };
}

// ── Chip factory ──────────────────────────────────────────────────────────────
function makeChip(n, extraClass = "") {
  const chip = document.createElement("div");
  chip.className = `chip ${getColor(n)} ${extraClass}`.trim();
  chip.textContent = n;
  return chip;
}

// ── Render general tab ────────────────────────────────────────────────────────
function renderGeneral(numbers) {
  const stats = computeStats(numbers);
  const { red, black, green, odd, even, total, sorted, overdue } = stats;

  document.getElementById("total-count").textContent = `${total} لفة`;

  const lastEl = document.getElementById("last-number");
  const dealerTag = document.getElementById("current-dealer-name");
  if (numbers.length > 0) {
    const last = numbers[numbers.length - 1];
    lastEl.textContent = last.n;
    lastEl.className = `last-number-display ${getColor(last.n)}`;
    if (last.dealer) {
      dealerTag.textContent = `الديلر: ${last.dealer}`;
      dealerTag.classList.remove("hidden");
    } else { dealerTag.classList.add("hidden"); }
  } else {
    lastEl.textContent = "—";
    lastEl.className = "last-number-display";
    dealerTag.classList.add("hidden");
  }

  const pctR = total ? Math.round((red / total) * 100) : 0;
  const pctB = total ? Math.round((black / total) * 100) : 0;
  const pctG = total ? Math.round((green / total) * 100) : 0;
  document.getElementById("bar-red").style.width   = pctR + "%";
  document.getElementById("bar-black").style.width = pctB + "%";
  document.getElementById("bar-green").style.width = pctG + "%";
  document.getElementById("pct-red").textContent   = pctR + "%";
  document.getElementById("pct-black").textContent = pctB + "%";
  document.getElementById("pct-green").textContent = pctG + "%";

  document.getElementById("odd-count").textContent  = odd;
  document.getElementById("even-count").textContent = even;

  const hotEl = document.getElementById("hot-numbers");
  hotEl.innerHTML = "";
  sorted.filter(x => x.count > 0).slice(0, 8).forEach((item, idx) => {
    const chip = makeChip(item.n, idx === 0 ? "hot-1" : idx <= 2 ? "hot-2" : "");
    chip.title = `ظهر ${item.count} مرة`;
    hotEl.appendChild(chip);
  });

  const coldEl = document.getElementById("cold-numbers");
  coldEl.innerHTML = "";
  sorted.slice().reverse().slice(0, 8).forEach(item => {
    const chip = makeChip(item.n, "cold");
    chip.title = `ظهر ${item.count} مرة`;
    coldEl.appendChild(chip);
  });

  const overdueEl = document.getElementById("overdue-numbers");
  overdueEl.innerHTML = "";
  overdue.slice(0, 10).forEach(item => {
    const chip = makeChip(item.n);
    chip.title = `لم يظهر منذ ${item.gap} لفة`;
    overdueEl.appendChild(chip);
  });

  const histEl = document.getElementById("history-chips");
  histEl.innerHTML = "";
  numbers.slice(-20).forEach(({ n }) => histEl.appendChild(makeChip(n)));
}

// ── Render dealers tab ────────────────────────────────────────────────────────
function renderDealers() {
  const container = document.getElementById("dealers-list");
  container.innerHTML = "";

  if (dealers.length === 0) {
    container.innerHTML = '<div class="empty-msg">لا يوجد ديلرات محفوظون بعد.<br/>اضغط ＋ لإضافة ديلر.</div>';
    return;
  }

  dealers.forEach(name => {
    const dealerNums = allNumbers.filter(x => x.dealer === name);
    if (dealerNums.length === 0) {
      // Show card with no data yet
      const card = document.createElement("div");
      card.className = "dealer-card";
      card.innerHTML = `
        <div class="dealer-card-header">
          <span class="dealer-card-name">👤 ${name}</span>
          <span class="dealer-card-spins">لا توجد بيانات بعد</span>
        </div>`;
      container.appendChild(card);
      return;
    }

    const stats = computeStats(dealerNums);
    const top5 = stats.sorted.filter(x => x.count > 0).slice(0, 5);
    const total = dealerNums.length;

    const pctR = Math.round((stats.red   / total) * 100);
    const pctB = Math.round((stats.black / total) * 100);
    const pctG = Math.round((stats.green / total) * 100);

    const card = document.createElement("div");
    card.className = "dealer-card";

    // Header
    const header = document.createElement("div");
    header.className = "dealer-card-header";
    header.innerHTML = `
      <span class="dealer-card-name">👤 ${name}</span>
      <span class="dealer-card-spins">${total} لفة</span>`;
    card.appendChild(header);

    // Favorite numbers
    const favLabel = document.createElement("div");
    favLabel.className = "dealer-fav-label";
    favLabel.textContent = "الأرقام المفضلة";
    card.appendChild(favLabel);

    const favChips = document.createElement("div");
    favChips.className = "dealer-fav-chips";
    top5.forEach((item, idx) => {
      const wrapper = document.createElement("div");
      wrapper.className = "dealer-fav-chip";
      const chip = makeChip(item.n);
      chip.title = `ظهر ${item.count} مرة`;
      const rank = document.createElement("div");
      rank.className = "fav-rank";
      rank.textContent = idx + 1;
      wrapper.appendChild(chip);
      wrapper.appendChild(rank);
      favChips.appendChild(wrapper);
    });
    card.appendChild(favChips);

    // Color distribution pills
    const colorRow = document.createElement("div");
    colorRow.className = "dealer-color-row";
    colorRow.innerHTML = `
      <div class="dealer-color-pill red-pill">
        <div class="pill-val">${pctR}%</div>
        <div class="pill-lbl">أحمر</div>
      </div>
      <div class="dealer-color-pill black-pill">
        <div class="pill-val">${pctB}%</div>
        <div class="pill-lbl">أسود</div>
      </div>
      <div class="dealer-color-pill green-pill">
        <div class="pill-val">${pctG}%</div>
        <div class="pill-lbl">أخضر</div>
      </div>`;
    card.appendChild(colorRow);
    container.appendChild(card);
  });
}

// ── Dealer select dropdown ────────────────────────────────────────────────────
function refreshDealerSelect() {
  const sel = document.getElementById("dealer-select");
  sel.innerHTML = '<option value="">— اختر ديلر —</option>';
  dealers.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (name === currentDealer) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ── Full render ───────────────────────────────────────────────────────────────
function render() {
  renderGeneral(allNumbers);
  renderDealers();
  refreshDealerSelect();
}

// ── Load from storage ─────────────────────────────────────────────────────────
chrome.storage.local.get(["numbers", "dealers", "currentDealer"], (result) => {
  allNumbers    = result.numbers       || [];
  dealers       = result.dealers       || [];
  currentDealer = result.currentDealer || "";
  render();
});

// ── Listen for new numbers from background ────────────────────────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "UPDATE_STATS") {
    allNumbers = message.numbers;
    render();
  }
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-general").classList.toggle("hidden", btn.dataset.tab !== "general");
    document.getElementById("tab-dealers").classList.toggle("hidden", btn.dataset.tab !== "dealers");
  });
});

// ── Dealer management ─────────────────────────────────────────────────────────
document.getElementById("dealer-select").addEventListener("change", (e) => {
  currentDealer = e.target.value;
  saveState();
});

document.getElementById("add-dealer-btn").addEventListener("click", () => {
  document.getElementById("add-dealer-form").classList.remove("hidden");
  document.getElementById("dealer-name-input").focus();
});

document.getElementById("cancel-dealer-btn").addEventListener("click", () => {
  document.getElementById("add-dealer-form").classList.add("hidden");
  document.getElementById("dealer-name-input").value = "";
});

document.getElementById("save-dealer-btn").addEventListener("click", saveNewDealer);
document.getElementById("dealer-name-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveNewDealer();
  if (e.key === "Escape") document.getElementById("cancel-dealer-btn").click();
});

function saveNewDealer() {
  const input = document.getElementById("dealer-name-input");
  const name = input.value.trim();
  if (!name) return;
  if (!dealers.includes(name)) {
    dealers.push(name);
  }
  input.value = "";
  document.getElementById("add-dealer-form").classList.add("hidden");
  currentDealer = name;
  saveState();
  refreshDealerSelect();
  renderDealers();
  document.getElementById("dealer-select").value = name;
}

document.getElementById("del-dealer-btn").addEventListener("click", () => {
  if (!currentDealer) return;
  if (!confirm(`حذف الديلر "${currentDealer}"؟\n(الأرقام المرتبطة به ستبقى في السجل)`)) return;
  dealers = dealers.filter(d => d !== currentDealer);
  currentDealer = "";
  saveState();
  refreshDealerSelect();
  renderDealers();
});

// ── Clear button ──────────────────────────────────────────────────────────────
document.getElementById("clear-btn").addEventListener("click", () => {
  if (!confirm("مسح جميع الأرقام المسجلة؟\n(الديلرات ستبقى)")) return;
  allNumbers = [];
  saveState();
  render();
});

// ── Manual input ──────────────────────────────────────────────────────────────
document.getElementById("manual-btn").addEventListener("click", addManual);
document.getElementById("manual-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addManual();
});

function addManual() {
  const input = document.getElementById("manual-input");
  const val = parseInt(input.value, 10);
  if (isNaN(val) || val < 0 || val > 36) {
    input.style.borderColor = "#fc4949";
    setTimeout(() => { input.style.borderColor = ""; }, 800);
    return;
  }
  input.value = "";
  addNumber(val);
}

function addNumber(n) {
  const entry = { n, t: Date.now(), dealer: currentDealer || null };
  allNumbers.push(entry);
  saveState();
  render();
}
