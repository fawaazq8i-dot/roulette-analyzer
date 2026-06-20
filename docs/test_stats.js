// Node.js test — verifies the stats engine with known inputs
// Run: node test_stats.js

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
function color(n){ return n===0?"green":RED.has(n)?"red":"black"; }

function stats(arr){
  const freq={};for(let i=0;i<=36;i++)freq[i]=0;
  let r=0,b=0,g=0,odd=0,even=0;
  arr.forEach(({n})=>{freq[n]++;const c=color(n);if(c==="red")r++;else if(c==="black")b++;else g++;if(n!==0){n%2===1?odd++:even++;}});
  const total=arr.length,lastSeen={};
  arr.forEach(({n},i)=>{lastSeen[n]=i;});
  const overdue=[];
  for(let i=0;i<=36;i++){const last=lastSeen[i]!==undefined?lastSeen[i]:-1;const gap=total-1-last;if(gap>=37)overdue.push({n:i,gap});}
  overdue.sort((a,b)=>b.gap-a.gap);
  const sorted=Object.entries(freq).map(([n,c])=>({n:parseInt(n),count:c})).sort((a,b)=>b.count-a.count);
  return{r,b,g,odd,even,total,sorted,overdue};
}

let pass=0, fail=0;
function test(name, got, expected){
  const ok = JSON.stringify(got)===JSON.stringify(expected);
  if(ok){ console.log(`  ✅ ${name}`); pass++; }
  else  { console.log(`  ❌ ${name}\n     got:      ${JSON.stringify(got)}\n     expected: ${JSON.stringify(expected)}`); fail++; }
}

// ── 1. Red numbers set (18 reds) ─────────────────────────────────────────────
console.log("\n[1] Red numbers correctness");
test("total red count", RED.size, 18);
test("0 is green",  color(0),  "green");
test("1 is red",    color(1),  "red");
test("2 is black",  color(2),  "black");
test("36 is red",   color(36), "red");
test("35 is black", color(35), "black");
test("18 is red",   color(18), "red");
test("19 is red",   color(19), "red");

// ── 2. Empty array ───────────────────────────────────────────────────────────
console.log("\n[2] Empty array");
const empty = stats([]);
test("total=0",   empty.total, 0);
test("r=0",       empty.r,     0);
test("overdue=0", empty.overdue.length, 0);

// ── 3. Single spin: red 7 ────────────────────────────────────────────────────
console.log("\n[3] Single spin: 7 (red, odd)");
const s1 = stats([{n:7}]);
test("total=1",  s1.total, 1);
test("r=1",      s1.r,     1);
test("b=0",      s1.b,     0);
test("g=0",      s1.g,     0);
test("odd=1",    s1.odd,   1);
test("even=0",   s1.even,  0);
test("hot top",  s1.sorted[0].n, 7);
test("hot count",s1.sorted[0].count, 1);

// ── 4. Single spin: 0 (green) ────────────────────────────────────────────────
console.log("\n[4] Single spin: 0 (green, not odd/even)");
const s0 = stats([{n:0}]);
test("g=1",    s0.g,    1);
test("r=0",    s0.r,    0);
test("odd=0",  s0.odd,  0);
test("even=0", s0.even, 0);

// ── 5. Known sequence: 1,2,3,0 ──────────────────────────────────────────────
console.log("\n[5] Sequence: 1(red/odd), 2(black/even), 3(red/odd), 0(green)");
const s5 = stats([{n:1},{n:2},{n:3},{n:0}]);
test("total=4", s5.total, 4);
test("r=2",     s5.r,     2);
test("b=1",     s5.b,     1);
test("g=1",     s5.g,     1);
test("odd=2",   s5.odd,   2);
test("even=1",  s5.even,  1);

// ── 6. Hot numbers: 7 appears 5×, others 1× ──────────────────────────────────
console.log("\n[6] Hot numbers: 7×5, 1×1, 2×1");
const seq6 = [{n:7},{n:7},{n:7},{n:7},{n:7},{n:1},{n:2}];
const s6 = stats(seq6);
test("hot #1 = 7",     s6.sorted[0].n,     7);
test("hot #1 count=5", s6.sorted[0].count, 5);

// ── 7. Cold numbers: filter must exclude count=0 ──────────────────────────────
console.log("\n[7] Cold filter: only numbers that appeared at least once");
const s7 = stats([{n:1},{n:2},{n:3}]);
const appeared = s7.sorted.filter(x=>x.count>0);
test("only 3 appeared",        appeared.length, 3);
test("cold filter count>0",    appeared.every(x=>x.count>0), true);
// cold = appeared sorted ascending
const cold7 = appeared.slice().reverse();
test("all cold have count>=1", cold7.every(x=>x.count>=1), true);

// ── 8. Overdue: number not seen for 37+ spins ────────────────────────────────
console.log("\n[8] Overdue detection");
// Spin 37 times, never 0 → 0 should be overdue after spin #37
const seq8 = Array.from({length:37}, (_,i)=>({n:(i%9)+1})); // 1-9 cycling, never 0
const s8 = stats(seq8);
const overdue0 = s8.overdue.find(x=>x.n===0);
test("0 is overdue after 37 spins without it", !!overdue0, true);
test("0 gap = 37",  overdue0 ? overdue0.gap : null, 37);

// Spin 36 times without 0 → NOT yet overdue
const seq8b = Array.from({length:36}, (_,i)=>({n:(i%9)+1}));
const s8b = stats(seq8b);
const overdue0b = s8b.overdue.find(x=>x.n===0);
test("0 is NOT overdue after only 36 spins", !!overdue0b, false);

// ── 9. Overdue: after number appears, gap resets ──────────────────────────────
console.log("\n[9] Overdue gap resets after appearance");
const seq9 = [
  ...Array.from({length:40}, ()=>({n:1})), // 40 spins without 7
  {n:7},                                    // 7 appears at index 40
  ...Array.from({length:10}, ()=>({n:1})), // 10 more spins
];
const s9 = stats(seq9);
const od7 = s9.overdue.find(x=>x.n===7);
test("7 NOT overdue after appearing 10 spins ago", !!od7, false);

// ── 10. lastSeen tracks LAST occurrence ───────────────────────────────────────
console.log("\n[10] lastSeen uses last occurrence, not first");
// 7 appears at index 0 and 50; after 60 total spins, gap should be 60-1-50=9
const seq10 = [{n:7}, ...Array.from({length:49},()=>({n:1})), {n:7}, ...Array.from({length:9},()=>({n:1}))];
const s10 = stats(seq10); // total=60
const od7_10 = s10.overdue.find(x=>x.n===7);
test("7 NOT overdue (last seen 9 spins ago)", !!od7_10, false);

// ── 11. Percentage calculation ─────────────────────────────────────────────────
console.log("\n[11] Percentage calculation");
// 18 red + 18 black + 1 green = 37 spins → exactly expected distribution
const allNums = Array.from({length:37}, (_,i)=>({n:i}));
const s11 = stats(allNums);
test("total=37",     s11.total,   37);
test("red=18",       s11.r,       18);
test("black=18",     s11.b,       18);
test("green=1",      s11.g,       1);
const pctR = Math.round(s11.r/s11.total*100);
const pctB = Math.round(s11.b/s11.total*100);
const pctG = Math.round(s11.g/s11.total*100);
test("red% ≈ 49%",   pctR, 49);
test("black% ≈ 49%", pctB, 49);
test("green% ≈ 3%",  pctG, 3);

// ── Results ────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`النتيجة: ${pass} نجح ✅  |  ${fail} فشل ❌`);
if(fail===0) console.log("✅ جميع الاختبارات نجحت — المحلل يعمل بشكل صحيح");
else         console.log("❌ يوجد أخطاء في منطق الحساب");
process.exit(fail>0?1:0);
