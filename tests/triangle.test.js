// Run: node tests/triangle.test.js   (no dependencies)
// Engine 6 (triangle balancer) acceptance tests T1–T6 from SPEC §6.
// The pure engine lives between marker comments in triangle/index.html;
// this harness extracts that block and evaluates it with no DOM present.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'triangle', 'index.html'), 'utf8');
const m = html.match(/\/\* === TRIANGLE ENGINE \(pure\) === \*\/([\s\S]*?)\/\* === END TRIANGLE ENGINE === \*\//);
assert.ok(m, 'engine marker block not found in triangle/index.html');
const { TCONST, bandForPAR, triangleBalance, trianglePoint } =
  new Function(m[1] + '\nreturn { TCONST, bandForPAR, triangleBalance, trianglePoint };')();

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL ' + name + '\n  ' + e.message); process.exitCode = 1; }
}
const near = (a, b, tol = 1e-6, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ` expected ${b}, got ${a}`);
function noNaN(x, where) {
  if (typeof x === 'number') assert.ok(!Number.isNaN(x), `NaN at ${where}`);
  else if (x && typeof x === 'object') for (const k in x) noNaN(x[k], where + '.' + k);
}
// Sensible defaults; each case overrides what it exercises.
const base = { par: null, parClass: null, hours: 8, co2Method: 'none', co2Target: 30,
  density: 'moderate', livestock: 'hardy', regime: 'ei', customNO3: NaN };
const run = over => triangleBalance({ ...base, ...over });

t('T1 — founding case: EI, high light, no CO2 → BBA setup', () => {
  const r = run({ par: 80 });
  assert.strictEqual(r.state, 'ok');
  assert.strictEqual(r.band.key, 'high');
  near(r.dli, 2.304, 1e-9, 'DLI');
  near(r.required.co2, 30, 1e-12);
  near(r.required.no3, 22.5, 1e-12);
  // Required band table = exact EI-ratio round-trip to SPEC §2's printed week.
  near(r.required.po4, 3.9, 1e-9, 'required PO4');
  near(r.required.k, 26, 1e-9, 'required K');
  near(r.required.fe, 0.30, 1e-9, 'required Fe');
  near(r.sCo2, 0.10, 1e-12, 's_co2');
  near(r.sNut, 1.0, 1e-12, 's_nut');
  assert.strictEqual(r.limiting, 'co2');
  assert.ok(r.verdict.includes('CO₂ is the limiting corner at 10%'), 'verdict names limiter + %');
  const r1 = r.flags.find(f => f.rule === 'R1');
  assert.ok(r1 && r1.level === 'high', 'R1 fires at High');
  assert.ok(r1.text.includes('classic BBA setup'), 'R1 prints its reason');
  assert.strictEqual(r.risk, 'high');
  assert.strictEqual(r.lever.kind, 'co2');
  assert.strictEqual(r.lever.parCeiling, 25, 'PAR ceiling for 3 ppm supply');
  near(r.weights.light, 0.42105, 1e-4); near(r.weights.co2, 0.05263, 1e-4); near(r.weights.nutrients, 0.52632, 1e-4);
  near(r.point.x, 0.73684, 1e-4, 'point x'); near(r.point.y, 0.36464, 1e-4, 'point y');
});

t('T2 — balanced low-tech: lean bottled under low light', () => {
  const r = run({ par: 20, hours: 7, regime: 'lean', livestock: 'shrimp' });
  assert.strictEqual(r.band.key, 'low');
  near(r.dli, 0.504, 1e-9, 'DLI');
  near(r.required.no3, 5, 1e-12);
  near(r.sCo2, 1.0, 1e-12); near(r.sNut, 1.0, 1e-12); // 7.5/5 capped at 1
  assert.strictEqual(r.inBalance, true);
  assert.ok(r.verdict.startsWith('In balance'), 'verdict');
  assert.strictEqual(r.flags.length, 0, 'no flags — oversupply ratio is exactly 1.5, R5 needs strictly greater');
  assert.strictEqual(r.lever.kind, 'none');
  near(r.point.x, 0.68421, 1e-4); near(r.point.y, 0.27348, 1e-4);
});

t('T3 — DIY at medium light: stability, not amount', () => {
  const r = run({ par: 40, hours: 9, co2Method: 'diy', regime: 'ppspro', density: 'dense' });
  assert.strictEqual(r.band.key, 'medium');
  near(r.dli, 1.296, 1e-9, 'DLI');
  near(r.required.no3, 15.6, 1e-9, 'required NO3 = 12 × 1.3');
  near(r.sCo2, 0.60, 1e-12, 's_co2 = min(1, 20/20) × 0.6');
  near(r.sNut, 0.8431, 1e-4, 's_nut = 13.153/15.6');
  assert.ok(!r.flags.some(f => f.rule === 'R1'), 'R1 must not fire below the High band');
  assert.ok(r.flags.some(f => f.rule === 'R4' && f.level === 'watch'), 'R4 fires (Watch)');
  assert.strictEqual(r.lever.kind, 'co2');
  assert.ok(/stability/i.test(r.lever.text), 'lever is worded as stability');
});

t('T4 — livestock cap reroutes the lever to light', () => {
  const r = run({ par: 60, co2Method: 'pressurized', co2Target: 35, livestock: 'shrimp' });
  near(r.supplied.co2, 25, 1e-12, 'supplied capped at 25');
  assert.strictEqual(r.supplied.capWarning, true, 'cap warning present');
  near(r.sCo2, 0.8333, 1e-4, 's_co2 = 25/30');
  near(r.sNut, 1.0, 1e-12);
  assert.strictEqual(r.lever.kind, 'light', 'lever is light, not CO2');
  assert.ok(r.lever.text.includes('50'), 'lever names the PAR 50 band boundary');
});

t('T5a — band edges', () => {
  assert.strictEqual(bandForPAR(25).key, 'medium');
  assert.strictEqual(bandForPAR(50).key, 'high');
  assert.strictEqual(bandForPAR(100).key, 'high');
  assert.strictEqual(bandForPAR(101).key, 'veryhigh');
  near(run({ par: 101 }).required.co2, 30, 1e-12, 'required CO2 still capped at 30');
});

t('T5b — custom regime derives the other ions by EI ratios', () => {
  const r = run({ par: 40, regime: 'custom', customNO3: 10 });
  near(r.sNut, 0.8333, 1e-4, 's_nut = 10/12');
  near(r.supplied.po4, 1.7333, 1e-4, 'derived PO4');
});

t('T5c — photoperiod 0 and 25 are input errors, no verdict, no NaN', () => {
  for (const hours of [0, 25]) {
    const r = run({ par: 60, hours });
    assert.strictEqual(r.state, 'error');
    assert.ok(!('verdict' in r), 'no verdict on error');
    noNaN(r, 'T5c');
  }
});

t('T5d — no PAR, no class, no CO2, no regime → insufficient, no point, no NaN', () => {
  const r = run({ regime: 'none' });
  assert.strictEqual(r.state, 'insufficient');
  assert.strictEqual(r.point, null);
  noNaN(r, 'T5d');
});

t('T6 — regime table integrity against SPEC §2 and §3', () => {
  const ei = TCONST.REGIMES.ei; // SPEC §2's printed week, exactly
  assert.strictEqual(ei.no3, 22.5); assert.strictEqual(ei.po4, 3.9);
  assert.strictEqual(ei.k, 26); assert.strictEqual(ei.fe, 0.3);
  const p = TCONST.REGIMES.ppspro; // SPEC §3 daily targets × 7, to 1e-9
  near(p.no3, 1.879 * 7, 1e-9); near(p.po4, 0.147 * 7, 1e-9);
  near(p.k, 1.246 * 7, 1e-9); near(p.fe, 0.0276 * 7, 1e-9);
  near(p.no3, 13.153, 1e-9); near(p.po4, 1.029, 1e-9); near(p.k, 8.722, 1e-9); near(p.fe, 0.1932, 1e-9);
});

t('trianglePoint — zero-sum intensities give no point', () => {
  assert.strictEqual(trianglePoint(0, 0, 0), null);
});

console.log(`${passed} tests passed`);
