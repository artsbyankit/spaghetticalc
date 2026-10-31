const test = require('node:test');
const assert = require('node:assert/strict');
const { computeAll, roundUpTo } = require('../calc.js');

const defaults = {
    invoice: 725.7, spools: 1, spoolGrams: 1000,
    units: 1, model: 0, grams: 10, failedPct: 10, maintainPct: 10,
    printH: 0, printM: 30, support: 0, sand: 0, iron: 0, ratePerDay: 500,
    powerW: 120, dutyPct: 15, elecRate: 6.96,
    markupPct: 15, roundTo: 0, priceManual: false, price: 0
};
const run = over => computeAll({ ...defaults, ...over });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('default job matches the hand-worked cost', () => {
    const { m5, m6 } = run();
    const base = 7.257 + 20.8333333 + 0.48024;
    close(m5.totalUnit, base * 1.2);
    close(m6.priceBatch, base * 1.2 * 1.15);
});

test('hand post-processing adds labor but no electricity', () => {
    const plain = run();
    const sanded = run({ sand: 600 });
    close(sanded.m4.costUnit, plain.m4.costUnit);
    close(sanded.m3.laborCost, 10 * 500 / 12);
});

test('zero print time means zero electricity', () => {
    close(run({ printM: 0, sand: 600 }).m4.costUnit, 0);
});

test('breakdown parts add up to the total, unit and batch', () => {
    const { m5 } = run({ units: 7, model: 350, sand: 12 });
    close(m5.parts.reduce((t, p) => t + p.unit, 0), m5.totalUnit);
    close(m5.parts.reduce((t, p) => t + p.batch, 0), m5.totalBatch);
    close(m5.parts.reduce((t, p) => t + p.share, 0), 1);
});

test('module 02 filament cost agrees with module 05 material line', () => {
    const { m2, m5 } = run({ units: 5 });
    close(m2.filamentCostBatch, m5.parts.find(p => p.key === 'material').batch);
});

test('3d model cost is shared across the batch and skips buffers', () => {
    const without = run({ units: 10 });
    const withModel = run({ units: 10, model: 100 });
    close(withModel.m5.totalBatch - without.m5.totalBatch, 100);
});

test('locked price follows target, manual price stays and reports real profit', () => {
    const auto = run({ markupPct: 50 });
    close(auto.m6.markupPct, 50);
    const manual = run({ priceManual: true, price: 10 });
    assert.equal(manual.m6.priceBatch, 10);
    assert.ok(manual.m6.profitBatch < 0);
    assert.ok(manual.warnings.some(w => w.field === 'm6-price'));
});

test('markup and margin are different numbers', () => {
    const { m6 } = run({ markupPct: 100 });
    close(m6.markupPct, 100);
    close(m6.marginPct, 50);
});

test('rounding only ever rounds up and never loses target profit', () => {
    assert.equal(roundUpTo(101, 5), 105);
    assert.equal(roundUpTo(100, 5), 100);
    assert.equal(roundUpTo(39.43, 0), 39.43);
    const { m6 } = run({ roundTo: 10 });
    assert.equal(m6.priceBatch % 10, 0);
    assert.ok(m6.priceBatch >= m6.suggestBatch);
});

test('empty and zero inputs never produce NaN or Infinity', () => {
    const zero = Object.fromEntries(Object.keys(defaults).map(k => [k, 0]));
    const { m1, m2, m3, m4, m5, m6, warnings } = computeAll({ ...zero, priceManual: false });
    for (const m of [m1, m2, m3, m4, m6]) {
        Object.values(m).forEach(v => assert.ok(Number.isFinite(v), String(v)));
    }
    assert.equal(m5.totalBatch, 0);
    assert.ok(warnings.some(w => w.field === 'm2-units'));
});

test('warns when filament is free or the job outgrows the spools', () => {
    assert.ok(run({ invoice: 0 }).warnings.some(w => w.field === 'm1-total-cost'));
    assert.ok(run({ units: 200, grams: 10 }).warnings.some(w => w.field === 'm1-units'));
    assert.equal(run().warnings.length, 0);
});
