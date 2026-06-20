const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function getColor(n) {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

// Snapshot of the last N numbers seen in the DOM — used to detect any change,
// including repeated numbers (e.g. 7 then 7), which a single-value comparison misses.
let lastSnapshot = "";

// ── Stake.com selectors (ordered: most specific → most generic) ────────────
function tryStake() {
  const selectors = [
    // data-testid patterns
    '[data-testid="roulette-history"] span:first-child',
    '[data-testid*="roulette"] [data-testid*="number"]:first-child',
    '[data-cy*="roulette-number"]:first-child',
    // Known class fragments from Stake's live casino
    '[class*="previousNumbers"] [class*="number"]:first-child',
    '[class*="PreviousNumbers"] [class*="Number"]:first-child',
    '[class*="rouletteHistory"] span:first-child',
    '[class*="RouletteHistory"] span:first-child',
    '[class*="wheelHistory"] span:first-child',
    '[class*="WheelHistory"] span:first-child',
    '[class*="history"] [class*="ball"]:first-child',
    '[class*="history"] [class*="Ball"]:first-child',
    '[class*="lastResults"] span:first-child',
    '[class*="LastResults"] span:first-child',
    '[class*="last-results"] span:first-child',
    '[class*="resultNumber"]:first-child',
    '[class*="ResultNumber"]:first-child',
    '[class*="result-number"]:first-child',
    '[class*="Numbers"] [class*="Number"]:first-child',
    '[class*="liveCasino"] [class*="number"]:first-child',
    // Broad fallback — only reaches here if nothing above matched
    '.roulette-history span:first-child',
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const text = el.textContent.trim();
    if (text === "00") continue; // American roulette — skip
    const n = parseInt(text, 10);
    if (!isNaN(n) && n >= 0 && n <= 36) return n;
  }
  return null;
}

// ── bet365 selectors ──────────────────────────────────────────────────────────
function tryBet365() {
  const selectors = [
    // Most reliable bet365 Live Roulette class (observed in the wild)
    '.rcl-RouletteHistory_Number:first-child',
    '[class*="rcl-RouletteHistory_Number"]:first-child',
    '[class*="rcl-RouletteHistory-item"]:first-child',
    '[class*="rcl-RouletteHistory"] li:first-child',
    '[class*="rcl-RouletteHistory"] span:first-child',
    // Fallback patterns
    '[class*="rouletteResult"]:first-child',
    '[class*="RouletteResult"]:first-child',
    '[class*="croupierHistory"] span:first-child',
    '[class*="gameHistory"] [class*="number"]:first-child',
    '[class*="InPlayWidget"] [class*="number"]:first-child',
    '[class*="numberHistory"] span:first-child',
    '[class*="LastResults"] li:first-child',
    '[class*="roulette"] [class*="history"] li:first-child',
    '.gl-Pill_Number:first-child',
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const text = el.textContent.trim();
    if (text === "00") continue;
    const n = parseInt(text, 10);
    if (!isNaN(n) && n >= 0 && n <= 36) return n;
  }
  return null;
}

// Read the first 3 visible numbers to build a snapshot string.
// This detects repeated numbers: if the list was [7,3,5] and becomes [7,7,3],
// the snapshot changes even though the latest number (7) is the same as before.
function getSnapshot() {
  const hostname = window.location.hostname;

  let listSelector = null;
  if (hostname.includes("stake.com")) {
    listSelector = [
      '[class*="previousNumbers"] [class*="number"]',
      '[class*="PreviousNumbers"] [class*="Number"]',
      '[class*="rouletteHistory"] span',
      '[class*="RouletteHistory"] span',
      '[class*="wheelHistory"] span',
      '[class*="lastResults"] span',
      '[class*="Numbers"] [class*="Number"]',
      '[data-testid="roulette-history"] span',
    ];
  } else if (hostname.includes("bet365.com")) {
    listSelector = [
      '.rcl-RouletteHistory_Number',
      '[class*="rcl-RouletteHistory_Number"]',
      '[class*="rcl-RouletteHistory"] li',
      '[class*="rcl-RouletteHistory"] span',
      '[class*="LastResults"] li',
    ];
  }

  if (!listSelector) return "";

  for (const sel of listSelector) {
    const els = document.querySelectorAll(sel);
    if (els.length >= 1) {
      return Array.from(els)
        .slice(0, 3)
        .map(e => e.textContent.trim())
        .join(",");
    }
  }
  return "";
}

function detectNumber() {
  const hostname = window.location.hostname;
  let number = null;

  if (hostname.includes("stake.com")) {
    number = tryStake();
  } else if (hostname.includes("bet365.com")) {
    number = tryBet365();
  }

  if (number === null) return;

  // Compare snapshots — catches repeated numbers (7→7) that value-comparison misses
  const snapshot = getSnapshot();
  if (snapshot === lastSnapshot) return;
  lastSnapshot = snapshot;

  chrome.runtime.sendMessage({
    type: "NEW_NUMBER",
    number,
    color: getColor(number),
  });
}

// ── Debounced MutationObserver ────────────────────────────────────────────────
// characterData:true removed — it fires on every animation/timer text update
// site-wide and causes severe performance degradation on live casino pages.
let debounceTimer = null;

const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(detectNumber, 120);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  // characterData intentionally omitted
});

// Initial scan
detectNumber();
