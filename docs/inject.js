/* Roulette Analyzer — Live Overlay
   Injected via bookmarklet on Stake.com / bet365.com
   Detects numbers automatically via MutationObserver
   localStorage keys: ra_nums, ra_dealers, ra_dealer
*/
(function() {
'use strict';

// ── Prevent double-injection ──────────────────────────────────────────────────
if (window._RA) { window._RA.show(); return; }

// ── Constants ─────────────────────────────────────────────────────────────────
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const CLR = n => n===0 ? 'green' : RED.has(n) ? 'red' : 'black';
const CLR_HEX = { red:'#fc4949', black:'#a0aec0', green:'#38a169' };

// ── State ─────────────────────────────────────────────────────────────────────
let nums=[], dealers=[], curDealer='', lastSnap='', debounceT=null;

function load() {
  try {
    nums      = JSON.parse(localStorage.getItem('ra_nums')    || '[]');
    dealers   = JSON.parse(localStorage.getItem('ra_dealers') || '[]');
    curDealer = localStorage.getItem('ra_dealer') || '';
  } catch(e) { nums=[]; dealers=[]; curDealer=''; }
}

function save() {
  localStorage.setItem('ra_nums',    JSON.stringify(nums));
  localStorage.setItem('ra_dealers', JSON.stringify(dealers));
  localStorage.setItem('ra_dealer',  curDealer);
}

function addNumber(n) {
  nums.push({ n, t: Date.now(), dealer: curDealer || null });
  save();
  updateUI();
  flashBadge(n);
}

// ── Statistics ────────────────────────────────────────────────────────────────
function stats(arr) {
  const freq = {}; for (let i=0; i<=36; i++) freq[i]=0;
  let r=0, b=0, g=0, odd=0, even=0;
  arr.forEach(({n}) => {
    freq[n]++;
    const c = CLR(n);
    if (c==='red') r++; else if (c==='black') b++; else g++;
    if (n !== 0) { n%2===1 ? odd++ : even++; }
  });
  const total = arr.length, lastSeen = {};
  arr.forEach(({n}, i) => { lastSeen[n] = i; });
  const overdue = [];
  for (let i=0; i<=36; i++) {
    const last = lastSeen[i] !== undefined ? lastSeen[i] : -1;
    const gap = total - 1 - last;
    if (gap >= 37) overdue.push({ n:i, gap });
  }
  overdue.sort((a,b) => b.gap - a.gap);
  const sorted = Object.entries(freq)
    .map(([n,c]) => ({ n:parseInt(n), count:c }))
    .sort((a,b) => b.count - a.count);
  return { r, b, g, odd, even, total, sorted, overdue };
}

// ── DOM Detection ─────────────────────────────────────────────────────────────
const STAKE_SELECTORS = [
  '[data-testid="roulette-history"] span:first-child',
  '[data-testid*="roulette"] [data-testid*="number"]:first-child',
  '[class*="previousNumbers"] [class*="number"]:first-child',
  '[class*="PreviousNumbers"] [class*="Number"]:first-child',
  '[class*="rouletteHistory"] span:first-child',
  '[class*="RouletteHistory"] span:first-child',
  '[class*="wheelHistory"] span:first-child',
  '[class*="lastResults"] span:first-child',
  '[class*="LastResults"] span:first-child',
  '[class*="Numbers"] [class*="Number"]:first-child',
];

const BET365_SELECTORS = [
  '.rcl-RouletteHistory_Number:first-child',
  '[class*="rcl-RouletteHistory_Number"]:first-child',
  '[class*="rcl-RouletteHistory"] li:first-child',
  '[class*="rcl-RouletteHistory"] span:first-child',
  '[class*="RouletteResult"]:first-child',
  '[class*="croupierHistory"] span:first-child',
  '[class*="LastResults"] li:first-child',
];

const SNAP_STAKE  = ['[class*="previousNumbers"] [class*="number"]','[class*="rouletteHistory"] span','[class*="RouletteHistory"] span','[data-testid="roulette-history"] span'];
const SNAP_BET365 = ['.rcl-RouletteHistory_Number','[class*="rcl-RouletteHistory_Number"]','[class*="rcl-RouletteHistory"] li'];

function getSnapshot() {
  const host = location.hostname;
  const sels = host.includes('stake') ? SNAP_STAKE : SNAP_BET365;
  for (const sel of sels) {
    const els = document.querySelectorAll(sel);
    if (els.length >= 1) return Array.from(els).slice(0,3).map(e=>e.textContent.trim()).join(',');
  }
  return '';
}

function tryDetect() {
  const host = location.hostname;
  const sels = host.includes('stake') ? STAKE_SELECTORS : BET365_SELECTORS;
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const txt = el.textContent.trim();
    if (txt === '00') continue;
    const n = parseInt(txt, 10);
    if (!isNaN(n) && n >= 0 && n <= 36) return n;
  }
  return null;
}

function detect() {
  const n = tryDetect();
  if (n === null) return;
  const snap = getSnapshot();
  if (snap === lastSnap) return;
  lastSnap = snap;
  addNumber(n);
}

const observer = new MutationObserver(() => {
  clearTimeout(debounceT);
  debounceT = setTimeout(detect, 120);
});

observer.observe(document.body, { childList:true, subtree:true });

// ── UI Build ──────────────────────────────────────────────────────────────────
function buildUI() {
  const shadow = document.createElement('div');
  shadow.id = '_ra_host';
  Object.assign(shadow.style, {
    position:'fixed', bottom:'16px', left:'16px',
    zIndex:'2147483647', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',
    userSelect:'none', touchAction:'none'
  });
  document.body.appendChild(shadow);

  const S = (el, styles) => Object.assign(el.style, styles);
  const D = (cls, tag='div') => { const e=document.createElement(tag); e.className=cls; return e; };

  // Panel
  const panel = D('panel');
  S(panel, {
    background:'#0d0f14', border:'1px solid #2d3748', borderRadius:'14px',
    width:'200px', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,.7)'
  });

  // Top bar
  const topbar = D('topbar');
  S(topbar, {
    background:'#161923', padding:'8px 10px', display:'flex',
    alignItems:'center', justifyContent:'space-between', cursor:'grab'
  });
  const titleEl = D('title', 'span');
  titleEl.textContent = '🎰 روليت';
  S(titleEl, { color:'#e2e8f0', fontWeight:'700', fontSize:'13px' });

  const btns = D('btns');
  S(btns, { display:'flex', gap:'6px' });

  const minBtn = makeBtn('—', '#2d3748', '#a0aec0');
  const closeBtn = makeBtn('✕', '#2d3748', '#fc8181');
  btns.appendChild(minBtn);
  btns.appendChild(closeBtn);
  topbar.appendChild(titleEl);
  topbar.appendChild(btns);
  panel.appendChild(topbar);

  // Body
  const body = D('body');
  S(body, { padding:'10px' });

  // Last number
  const lastBox = D('lastbox');
  S(lastBox, { textAlign:'center', marginBottom:'8px' });
  const lastNum = D('lastnum', 'div');
  S(lastNum, { fontSize:'48px', fontWeight:'900', lineHeight:'1', color:'#4a5568', minHeight:'52px' });
  lastNum.textContent = '—';
  const lastDlr = D('lastdlr', 'div');
  S(lastDlr, { fontSize:'11px', color:'#f6ad55', minHeight:'16px', marginTop:'2px' });
  lastBox.appendChild(lastNum);
  lastBox.appendChild(lastDlr);
  body.appendChild(lastBox);

  // Dealer row
  const dlrRow = D('dlrrow');
  S(dlrRow, { display:'flex', gap:'4px', marginBottom:'8px' });
  const dlrSel = document.createElement('select');
  dlrSel.id = '_ra_dlr';
  S(dlrSel, {
    flex:'1', background:'#1a202c', border:'1px solid #2d3748', borderRadius:'6px',
    color:'#e2e8f0', padding:'4px 6px', fontSize:'12px', outline:'none'
  });
  const addDlrBtn = makeBtn('＋', '#1a202c', '#68d391');
  S(addDlrBtn, { minWidth:'28px', height:'28px', fontSize:'16px' });
  dlrRow.appendChild(dlrSel);
  dlrRow.appendChild(addDlrBtn);
  body.appendChild(dlrRow);

  // Stats rows
  const statsDiv = D('stats');
  S(statsDiv, { display:'flex', flexDirection:'column', gap:'5px' });

  // Color bars
  const colorBars = makeColorBars();
  statsDiv.appendChild(colorBars);

  // Odd/Even
  const oeRow = D('oerow');
  S(oeRow, { display:'flex', gap:'5px' });
  const oddBox  = makeStatBox('0','فردي','_ra_odd');
  const evenBox = makeStatBox('0','زوجي','_ra_even');
  oeRow.appendChild(oddBox);
  oeRow.appendChild(evenBox);
  statsDiv.appendChild(oeRow);

  // Hot numbers
  const hotLbl = makeLabel('🔥 ساخنة');
  statsDiv.appendChild(hotLbl);
  const hotRow = D('hotrow');
  S(hotRow, { display:'flex', flexWrap:'wrap', gap:'3px' });
  hotRow.id = '_ra_hot';
  statsDiv.appendChild(hotRow);

  // Overdue
  const odLbl = makeLabel('⏳ متأخرة');
  statsDiv.appendChild(odLbl);
  const odRow = D('odrow');
  S(odRow, { display:'flex', flexWrap:'wrap', gap:'3px' });
  odRow.id = '_ra_od';
  statsDiv.appendChild(odRow);

  // Count
  const countLbl = D('count', 'div');
  S(countLbl, { textAlign:'center', marginTop:'6px', fontSize:'11px', color:'#4a5568' });
  countLbl.id = '_ra_count';
  statsDiv.appendChild(countLbl);

  // Clear btn
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'مسح الجلسة 🗑️';
  S(clearBtn, {
    width:'100%', marginTop:'8px', background:'#1a202c', border:'1px solid #2d3748',
    borderRadius:'6px', color:'#718096', padding:'6px', fontSize:'11px', cursor:'pointer'
  });

  statsDiv.appendChild(clearBtn);
  body.appendChild(statsDiv);
  panel.appendChild(body);
  shadow.appendChild(panel);

  // ── Minimized view ────────────────────────────────────────────────────────
  const mini = D('mini');
  S(mini, {
    background:'#161923', border:'1px solid #2d3748', borderRadius:'12px',
    padding:'8px 14px', display:'none', alignItems:'center', gap:'8px',
    cursor:'pointer', boxShadow:'0 8px 32px rgba(0,0,0,.7)'
  });
  const miniNum = D('miniNum', 'span');
  S(miniNum, { fontSize:'22px', fontWeight:'900' });
  miniNum.id = '_ra_mini_num';
  miniNum.textContent = '—';
  const miniLbl = D('miniLbl', 'span');
  S(miniLbl, { color:'#718096', fontSize:'11px' });
  miniLbl.textContent = '0 لفة';
  miniLbl.id = '_ra_mini_count';
  mini.appendChild(miniNum);
  mini.appendChild(miniLbl);
  shadow.appendChild(mini);

  // ── Refs ──────────────────────────────────────────────────────────────────
  window._RA = {
    shadow, panel, body, mini,
    lastNum, lastDlr, dlrSel,
    show() { shadow.style.display = 'block'; }
  };

  // ── Events ────────────────────────────────────────────────────────────────
  minBtn.addEventListener('click', () => {
    panel.style.display = 'none';
    mini.style.display = 'flex';
  });
  closeBtn.addEventListener('click', () => { shadow.remove(); delete window._RA; });
  mini.addEventListener('click', () => {
    mini.style.display = 'none';
    panel.style.display = '';
  });

  dlrSel.addEventListener('change', e => { curDealer = e.target.value; save(); });

  addDlrBtn.addEventListener('click', () => {
    const name = prompt('اسم الديلر:','');
    if (!name || !name.trim()) return;
    const n = name.trim();
    if (!dealers.includes(n)) { dealers.push(n); save(); }
    curDealer = n; save();
    refreshSelect();
    dlrSel.value = n;
  });

  clearBtn.addEventListener('click', () => {
    if (!confirm('مسح جميع الأرقام؟')) return;
    nums = []; lastSnap = ''; save(); updateUI();
  });

  // Drag
  makeDraggable(shadow, topbar);
  makeDraggable(shadow, mini);
}

// ── Update UI ─────────────────────────────────────────────────────────────────
function updateUI() {
  if (!window._RA) return;
  const { lastNum, lastDlr, dlrSel } = window._RA;
  const s = stats(nums);

  // Last number
  if (nums.length) {
    const last = nums[nums.length-1];
    lastNum.textContent = last.n;
    lastNum.style.color = CLR_HEX[CLR(last.n)];
    lastDlr.textContent = last.dealer ? `الديلر: ${last.dealer}` : '';
    const mini = document.getElementById('_ra_mini_num');
    if (mini) { mini.textContent = last.n; mini.style.color = CLR_HEX[CLR(last.n)]; }
  } else {
    lastNum.textContent = '—';
    lastNum.style.color = '#4a5568';
    lastDlr.textContent = '';
  }

  // Count
  const cnt = document.getElementById('_ra_count');
  if (cnt) cnt.textContent = s.total + ' لفة مسجلة';
  const mc = document.getElementById('_ra_mini_count');
  if (mc) mc.textContent = s.total + ' لفة';

  // Color bars
  const t = s.total;
  updateBar('_ra_br', t ? s.r/t : 0, '_ra_pr', s.r, t);
  updateBar('_ra_bb', t ? s.b/t : 0, '_ra_pb', s.b, t);
  updateBar('_ra_bg', t ? s.g/t : 0, '_ra_pg', s.g, t);

  // Odd/Even
  const oddEl = document.getElementById('_ra_odd');
  const evEl  = document.getElementById('_ra_even');
  if (oddEl) oddEl.textContent = s.odd;
  if (evEl)  evEl.textContent  = s.even;

  // Hot
  const hotEl = document.getElementById('_ra_hot');
  if (hotEl) {
    hotEl.innerHTML = '';
    s.sorted.filter(x=>x.count>0).slice(0,6).forEach((x,i) => {
      hotEl.appendChild(miniChip(x.n, i===0?'#f6ad55':null));
    });
  }

  // Overdue
  const odEl = document.getElementById('_ra_od');
  if (odEl) {
    odEl.innerHTML = '';
    s.overdue.slice(0,6).forEach(x => {
      odEl.appendChild(miniChip(x.n, null, 0.6));
    });
  }

  // Dealer select
  refreshSelect();
}

function refreshSelect() {
  const sel = document.getElementById('_ra_dlr');
  if (!sel) return;
  sel.innerHTML = '<option value="">— ديلر —</option>';
  dealers.forEach(n => {
    const o = document.createElement('option');
    o.value = n; o.textContent = n;
    if (n === curDealer) o.selected = true;
    sel.appendChild(o);
  });
}

// ── Flash effect on new number ────────────────────────────────────────────────
function flashBadge(n) {
  if (!window._RA) return;
  const { panel } = window._RA;
  const orig = panel.style.border;
  panel.style.border = `2px solid ${CLR_HEX[CLR(n)]}`;
  panel.style.boxShadow = `0 0 20px ${CLR_HEX[CLR(n)]}60`;
  setTimeout(() => {
    panel.style.border = '1px solid #2d3748';
    panel.style.boxShadow = '0 8px 32px rgba(0,0,0,.7)';
  }, 600);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeBtn(txt, bg, clr) {
  const b = document.createElement('button');
  b.textContent = txt;
  Object.assign(b.style, {
    background: bg, border:'none', borderRadius:'6px',
    color: clr, width:'26px', height:'26px',
    fontSize:'12px', cursor:'pointer', lineHeight:'1'
  });
  return b;
}

function makeLabel(txt) {
  const l = document.createElement('div');
  l.textContent = txt;
  Object.assign(l.style, { color:'#718096', fontSize:'10px', marginTop:'6px', marginBottom:'2px' });
  return l;
}

function makeStatBox(val, lbl, id) {
  const box = document.createElement('div');
  Object.assign(box.style, {
    flex:'1', background:'#161923', borderRadius:'6px',
    padding:'6px', textAlign:'center'
  });
  const v = document.createElement('div');
  v.id = id; v.textContent = val;
  Object.assign(v.style, { fontSize:'20px', fontWeight:'700', color:'#63b3ed' });
  const l = document.createElement('div');
  l.textContent = lbl;
  Object.assign(l.style, { fontSize:'10px', color:'#718096' });
  box.appendChild(v); box.appendChild(l);
  return box;
}

function makeColorBars() {
  const wrap = document.createElement('div');
  [['red','#fc4949','أحمر','_ra_br','_ra_pr'],
   ['black','#718096','أسود','_ra_bb','_ra_pb'],
   ['green','#38a169','أخضر','_ra_bg','_ra_pg']].forEach(([,clr,lbl,bid,pid]) => {
    const row = document.createElement('div');
    Object.assign(row.style, { display:'flex', alignItems:'center', gap:'5px', marginBottom:'3px' });
    const dot = document.createElement('div');
    Object.assign(dot.style, { width:'7px', height:'7px', borderRadius:'50%', background:clr, flexShrink:'0' });
    const track = document.createElement('div');
    Object.assign(track.style, { flex:'1', height:'5px', background:'#2d3748', borderRadius:'3px', overflow:'hidden' });
    const fill = document.createElement('div');
    fill.id = bid;
    Object.assign(fill.style, { height:'100%', background:clr, width:'0%', borderRadius:'3px', transition:'width .3s' });
    track.appendChild(fill);
    const pct = document.createElement('span');
    pct.id = pid; pct.textContent = '0%';
    Object.assign(pct.style, { fontSize:'10px', color:'#718096', width:'26px', textAlign:'left' });
    row.appendChild(dot); row.appendChild(track); row.appendChild(pct);
    wrap.appendChild(row);
  });
  return wrap;
}

function updateBar(fillId, ratio, pctId, count, total) {
  const f = document.getElementById(fillId);
  const p = document.getElementById(pctId);
  if (f) f.style.width = Math.round(ratio*100) + '%';
  if (p) p.textContent = (total ? Math.round(ratio*100) : 0) + '%';
}

function miniChip(n, borderClr, opacity) {
  const d = document.createElement('div');
  const c = CLR(n);
  const bg = c==='red'?'#7c1d1d':c==='black'?'#1a202c':'#1c3a2b';
  Object.assign(d.style, {
    width:'26px', height:'26px', borderRadius:'50%',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:'10px', fontWeight:'700', color: CLR_HEX[c],
    background: bg, border:`1px solid ${borderClr || CLR_HEX[c]}`,
    opacity: opacity || '1',
    boxShadow: borderClr ? `0 0 6px ${borderClr}` : 'none'
  });
  d.textContent = n;
  return d;
}

function makeDraggable(el, handle) {
  let startX, startY, origX, origY;
  const getPos = () => {
    const s = el.style;
    return { x: parseInt(s.left||0), y: parseInt(s.bottom||0) };
  };
  handle.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
    const pos = getPos();
    origX = pos.x; origY = pos.y;
    handle.style.cursor = 'grabbing';
    e.preventDefault();
  }, { passive:false });
  handle.addEventListener('touchmove', e => {
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = startY - t.clientY;
    el.style.left   = Math.max(0, origX + dx) + 'px';
    el.style.bottom = Math.max(0, origY + dy) + 'px';
    e.preventDefault();
  }, { passive:false });
  handle.addEventListener('touchend', () => { handle.style.cursor = 'grab'; });
  // Mouse drag (desktop testing)
  handle.addEventListener('mousedown', e => {
    startX=e.clientX; startY=e.clientY;
    const pos=getPos(); origX=pos.x; origY=pos.y;
    const mm = mv => {
      el.style.left   = Math.max(0, origX+(mv.clientX-startX)) + 'px';
      el.style.bottom = Math.max(0, origY-(mv.clientY-startY)) + 'px';
    };
    const mu = () => { removeEventListener('mousemove',mm); removeEventListener('mouseup',mu); };
    addEventListener('mousemove',mm); addEventListener('mouseup',mu);
    e.preventDefault();
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
load();
buildUI();
updateUI();
detect(); // immediate scan on inject

})();
