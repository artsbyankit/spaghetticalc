function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

function initTheme() {
    const stored = localStorage.getItem('theme');
    const theme = stored || systemTheme();
    document.documentElement.setAttribute('data-theme', theme);
    applyThemeColor(theme);

    if (!stored) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (localStorage.getItem('theme')) return;
            const next = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            applyThemeColor(next);
        });
    }
}

function applyThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0f0f0f' : '#ffffff';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    applyThemeColor(next);
}

initTheme();

const inrFmt = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const elCache = new Map();

function num(id) {
    let el = elCache.get(id);
    if (!el) {
        el = document.getElementById(id);
        if (el) elCache.set(id, el);
    }
    return el ? (parseFloat(el.value) || 0) : 0;
}

function initLocks(onChange) {
    document.querySelectorAll('[data-lock]').forEach(group => {
        const input = group.querySelector('input');
        const stored = localStorage.getItem('lock-' + input.id);
        const isLocked = stored != null ? stored === '1' : true;
        applyLock(group, input, isLocked, true);

        input.addEventListener('input', () => {
            localStorage.setItem('val-' + input.id, input.value);
            if (input.id === 'm6-price') return;
            if (onChange) onChange();
        });
    });
}

function applyLock(group, input, isLocked, applyStored) {
    input.disabled = isLocked;
    group.classList.toggle('locked', isLocked);
    group.classList.toggle('unlocked', !isLocked);
    group.querySelector('.lock-toggle').title = isLocked ? 'double-click to unlock' : 'double-click to lock';

    if (applyStored) {
        const storedVal = localStorage.getItem('val-' + input.id);
        if (storedVal != null) input.value = storedVal;
    }
}

function computeM1() {
    const totalCost = num('m1-total-cost');
    const units = num('m1-units');
    const perUnitG = num('m1-per-unit');
    const totalG = units * perUnitG;
    const totalKg = totalG / 1000;
    const costPerKg = totalKg > 0 ? totalCost / totalKg : 0;
    const costPerG = totalG > 0 ? totalCost / totalG : 0;
    return { totalCost, units, perUnitG, totalKg, costPerG, costPerKg };
}

function renderM1(m) {
    const kgText = Number.isInteger(m.totalKg) ? m.totalKg.toString() : m.totalKg.toFixed(3);
    document.getElementById('m1-total-filament').innerHTML = `${kgText} <span class="per">kg</span>`;
    document.getElementById('m1-cost-g').textContent = `${formatINR(m.costPerG)}/g`;

    const hint = document.getElementById('m1-per-unit-hint');
    if (hint) {
        hint.textContent = m.perUnitG > 0 ? `= ${formatKg(m.perUnitG)}` : '';
    }
}

function computeM2(costPerG) {
    const units = num('m2-units');
    const model = num('m2-model');
    const gramsPerUnit = num('m2-grams');
    const failedPct = num('m2-failed');

    const baseGrams = units * gramsPerUnit;
    const bufferedGrams = baseGrams * (1 + failedPct / 100);
    const bufferedKg = bufferedGrams / 1000;

    const filamentCostUnit = gramsPerUnit * costPerG;
    const filamentCostBatch = bufferedGrams * costPerG;
    const modelCostUnit = units > 0 ? model / units : 0;
    const modelCostBatch = units > 0 ? model : 0;

    return {
        units, model, gramsPerUnit, failedPct,
        baseGrams, bufferedGrams, bufferedKg,
        filamentCostUnit, filamentCostBatch,
        modelCostUnit, modelCostBatch
    };
}

function renderM2(m) {
    const kgText = Number.isInteger(m.bufferedKg) ? m.bufferedKg.toString() : m.bufferedKg.toFixed(3);
    document.getElementById('m2-total-filament').innerHTML = `${kgText} <span class="per">kg</span>`;
    document.getElementById('m2-filament-unit').textContent = `${formatINR(m.filamentCostUnit)}/unit`;
    document.getElementById('m2-filament-batch').textContent = `${formatINR(m.filamentCostBatch)} batch`;
    document.getElementById('m2-model-unit').textContent = `${formatINR(m.modelCostUnit)}/unit`;
    document.getElementById('m2-model-batch').textContent = `${formatINR(m.modelCostBatch)} batch`;
}

const stopwatchControls = new Map();

function computeM3() {
    const printH = stopwatchH();
    const laborMin = num('m3-support') + num('m3-sand') + num('m3-iron');
    const laborH = laborMin / 60;
    const prodH = printH + laborH;

    const ratePerDay = num('m3-rate');
    const dayHours = 12;
    const ratePerH = ratePerDay / dayHours;
    const machineCost = printH * ratePerH;
    const laborCost = laborH * ratePerH;
    const rateCost = machineCost + laborCost;
    const total = rateCost;

    return { printH, laborMin, laborH, prodH, ratePerDay, dayHours, ratePerH, machineCost, laborCost, rateCost, total };
}

function initStopwatch(rootId, onChange) {
    const root = document.getElementById(rootId);
    const hEl = root.querySelector('#m3-print-h');
    const mEl = root.querySelector('#m3-print-m');
    let h = parseInt(hEl.textContent, 10) || 0;
    let m = parseInt(mEl.textContent, 10) || 0;

    function paint() {
        hEl.textContent = String(h).padStart(2, '0');
        mEl.textContent = String(m).padStart(2, '0');
    }

    function step(unit, dir) {
        if (unit === 'h') {
            h = Math.max(0, Math.min(999, h + dir));
        } else {
            m = (m + dir * 15 + 60) % 60;
            if (m === 60) m = 0;
        }
        paint();
    }

    root.addEventListener('click', function (e) {
        const btn = e.target.closest('.sw-btn');
        if (!btn) return;
        step(btn.dataset.sw, btn.dataset.dir === 'up' ? 1 : -1);
        if (onChange) onChange();
    });

    stopwatchControls.set(rootId, { hEl, set(hv, mv) { h = hv; m = mv; paint(); } });

    paint();
}

function stopwatchH() {
    const hEl = document.getElementById('m3-print-h');
    const mEl = document.getElementById('m3-print-m');
    const h = parseInt(hEl ? hEl.textContent : '0', 10) || 0;
    const m = parseInt(mEl ? mEl.textContent : '0', 10) || 0;
    return h + m / 60;
}

function renderM3(m) {
    document.getElementById('m3-total').textContent = formatINR(m.total);
    document.getElementById('m3-prod-time').textContent = fmtDur(m.prodH);
    document.getElementById('m3-labor-time').textContent = `${m.laborMin} min`;
    document.getElementById('m3-rate-cost').textContent = `${formatINR(m.rateCost)}/unit`;

    const hint = document.getElementById('m3-rate-hint');
    if (hint) hint.textContent = `= ${formatINR(m.ratePerH)}/h · ${m.dayHours} h day`;
}

function fmtDur(h) {
    const totMin = Math.round(h * 60);
    const hh = Math.floor(totMin / 60);
    const mm = totMin % 60;
    return `${hh}h ${String(mm).padStart(2, '0')}m`;
}

function computeM4(prodH, units) {
    const powerW = num('m4-power');
    const dutyPct = num('m4-duty');
    const rate = num('m4-rate');

    const kW = powerW / 1000;
    const kwhUnit = kW * prodH;
    const kwhBatch = kwhUnit * units;
    const cf = rate * (1 + dutyPct / 100);
    const costUnit = kwhUnit * cf;
    const costBatch = kwhBatch * cf;

    return { powerW, dutyPct, rate, kW, kwhUnit, kwhBatch, costUnit, costBatch };
}

function renderM4(m) {
    document.getElementById('m4-total').textContent = formatINR(m.costUnit);
    document.getElementById('m4-kwh-unit').textContent = `${fmtNum2(m.kwhUnit)} kWh`;
    document.getElementById('m4-kwh-batch').textContent = `${fmtNum2(m.kwhBatch)} kWh`;
    document.getElementById('m4-unit').textContent = `${formatINR(m.costUnit)}/unit`;
    document.getElementById('m4-batch').textContent = `${formatINR(m.costBatch)} batch`;
}

function fmtNum2(n) {
    const r = Math.round(n * 100) / 100;
    return Number.isInteger(r) ? r.toString() : r.toFixed(2);
}

function computeM5(m1, m2, m3, m4) {
    const maintainPct = num('m2-maintain');
    const units = m2.units;

    const materialUnit = m2.filamentCostUnit;
    const modelUnit = m2.modelCostUnit;
    const machineUnit = m3.machineCost;
    const laborUnit = m3.laborCost;
    const elecUnit = m4.costUnit;

    const prodBaseUnit = materialUnit + machineUnit + laborUnit + elecUnit;
    const maintainUnit = prodBaseUnit * maintainPct / 100;
    const failUnit = prodBaseUnit * m2.failedPct / 100;
    const totalUnit = prodBaseUnit + modelUnit + maintainUnit + failUnit;

    const materialBatch = materialUnit * units;
    const modelBatch = m2.modelCostBatch;
    const machineBatch = machineUnit * units;
    const laborBatch = laborUnit * units;
    const elecBatch = m4.costBatch;
    const failBatch = failUnit * units;
    const maintainBatch = maintainUnit * units;
    const totalBatch = totalUnit * units;

    return {
        maintainPct, units,
        materialUnit, modelUnit, machineUnit, laborUnit, elecUnit, failUnit,
        maintainUnit, totalUnit,
        materialBatch, modelBatch, machineBatch, laborBatch, elecBatch, failBatch,
        maintainBatch, totalBatch
    };
}

function renderM5(m) {
    document.getElementById('m5-material-unit').textContent = `${formatINR(m.materialUnit)}/unit`;
    document.getElementById('m5-material-batch').textContent = `${formatINR(m.materialBatch)} batch`;
    document.getElementById('m5-model-unit').textContent = `${formatINR(m.modelUnit)}/unit`;
    document.getElementById('m5-model-batch').textContent = `${formatINR(m.modelBatch)} batch`;
    document.getElementById('m5-machine-unit').textContent = `${formatINR(m.machineUnit)}/unit`;
    document.getElementById('m5-machine-batch').textContent = `${formatINR(m.machineBatch)} batch`;
    document.getElementById('m5-labor-unit').textContent = `${formatINR(m.laborUnit)}/unit`;
    document.getElementById('m5-labor-batch').textContent = `${formatINR(m.laborBatch)} batch`;
    document.getElementById('m5-elec-unit').textContent = `${formatINR(m.elecUnit)}/unit`;
    document.getElementById('m5-elec-batch').textContent = `${formatINR(m.elecBatch)} batch`;
    document.getElementById('m5-maintain-unit').textContent = `${formatINR(m.maintainUnit)}/unit`;
    document.getElementById('m5-maintain-batch').textContent = `${formatINR(m.maintainBatch)} batch`;
    document.getElementById('m5-fail-unit').textContent = `${formatINR(m.failUnit)}/unit`;
    document.getElementById('m5-fail-batch').textContent = `${formatINR(m.failBatch)} batch`;
    document.getElementById('m5-maintain-lbl').textContent = `(${m.maintainPct}%)`;
    document.getElementById('m5-total-batch').textContent = `${formatINR(m.totalBatch)} batch`;
    document.getElementById('m5-total-unit').textContent = `${formatINR(m.totalUnit)}/unit`;
}

function computeM6(m5, m3) {
    const priceBatch = num('m6-price');
    const marginPct = num('m6-margin');
    const units = m5.units;

    const costUnit = m5.totalUnit;
    const costBatch = m5.totalBatch;
    const priceUnit = units > 0 ? priceBatch / units : 0;
    const targetProfitUnit = costUnit * (marginPct / 100);
    const targetProfitBatch = costBatch * (marginPct / 100);
    const coefficient = 1 + marginPct / 100;
    const suggestUnit = costUnit * coefficient;
    const suggestBatch = costBatch * coefficient;

    const yourProfitUnit = priceUnit - costUnit;
    const yourProfitBatch = priceBatch - costBatch;
    const yourMarkupPct = costUnit > 0 ? (yourProfitUnit / costUnit) * 100 : 0;

    const jobH = m3.prodH * units;
    const perH = jobH > 0 ? yourProfitBatch / jobH : 0;

    return {
        priceUnit, priceBatch, marginPct, units,
        costUnit, costBatch,
        targetProfitUnit, targetProfitBatch,
        suggestUnit, suggestBatch,
        yourProfitUnit, yourProfitBatch, yourMarkupPct,
        jobH, perH
    };
}

function renderM6(m) {
    document.getElementById('m6-cost-unit').textContent = `${formatINR(m.costUnit)}/unit`;
    document.getElementById('m6-cost-batch').textContent = `${formatINR(m.costBatch)} batch`;
    document.getElementById('m6-suggest-unit').textContent = `${formatINR(m.suggestUnit)}/unit`;
    document.getElementById('m6-suggest-batch').textContent = `${formatINR(m.suggestBatch)} batch`;
    document.getElementById('m6-profit-unit').textContent = `${formatINR(m.targetProfitUnit)}/unit`;
    document.getElementById('m6-profit-batch').textContent = `${formatINR(m.targetProfitBatch)} batch`;
    document.getElementById('m6-job-h').textContent = fmtDur(m.jobH);
    document.getElementById('m6-perhour').textContent = `${formatINR(m.perH)}/h`;
    document.getElementById('m6-price-batch').textContent = `${formatINR(m.priceBatch)} batch`;

    const isLoss = m.yourProfitBatch < 0;
    document.getElementById('m6-profit-per').textContent = `${formatINR(m.yourProfitUnit)}/unit`;
    document.getElementById('m6-profit-total').textContent = `${formatINR(m.yourProfitBatch)} batch`;
    document.getElementById('m6-perhour').classList.toggle('neg', isLoss);
    const printTotal = document.querySelector('.print-total');
    if (printTotal) printTotal.classList.toggle('neg', isLoss);
}

function renderAll() {
    const m1 = computeM1();
    renderM1(m1);
    const m2 = computeM2(m1.costPerG);
    renderM2(m2);
    const m3 = computeM3();
    renderM3(m3);
    const m4 = computeM4(m3.prodH, m2.units);
    renderM4(m4);
    const m5 = computeM5(m1, m2, m3, m4);
    renderM5(m5);
    renderM6(computeM6(m5, m3));
}

function formatKg(g) {
    const kg = g / 1000;
    return `${Number.isInteger(kg) ? kg.toString() : kg.toFixed(1)} kg`;
}

const inrFmt4 = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
});

function formatINR(amount) {
    if (amount !== 0 && Math.abs(amount) < 0.01) return inrFmt4.format(amount);
    return inrFmt.format(amount);
}

function applyInputRules(id, onChange) {
    const input = document.getElementById(id);
    input.setAttribute('min', '0');
    input.addEventListener('input', function () {
        const v = parseFloat(this.value);
        if (this.value !== '' && (v < 0 || isNaN(v))) {
            this.value = v < 0 ? '0' : '';
        }
        onChange();
    });
    input.addEventListener('focus', function () {
        this._prev = this.value;
        this.value = '';
    });
    input.addEventListener('blur', function () {
        if (this.value === '' || this.value == null) {
            this.value = this._prev != null ? this._prev : '';
            onChange();
        }
    });
}

['m1-total-cost', 'm1-units', 'm1-per-unit',
 'm2-units', 'm2-model', 'm2-grams', 'm2-failed',
 'm3-support', 'm3-sand', 'm3-iron', 'm3-rate',
 'm4-power', 'm4-duty', 'm4-rate'].forEach(id => applyInputRules(id, renderAllAndSync));

const priceInput = document.getElementById('m6-price');
priceInput.setAttribute('min', '0');
priceInput.addEventListener('input', function () {
    let v = parseFloat(this.value);
    if (this.value !== '' && (v < 0 || isNaN(v))) this.value = v < 0 ? '0' : '';
    if (this.disabled) return;
    const costBatch = parseFloat(document.getElementById('m6-cost-batch').textContent.replace(/[^0-9.-]/g, '')) || 0;
    const priceBatch = parseFloat(this.value) || 0;
    const margin = costBatch > 0 ? (priceBatch / costBatch - 1) * 100 : 0;
    document.getElementById('m6-margin').value = String(Math.min(500, Math.max(0, Math.round(margin * 10) / 10)));
    renderAll();
});
priceInput.addEventListener('focus', function () {
    this._prev = this.value;
    this.value = '';
});
priceInput.addEventListener('blur', function () {
    if (this.value === '' || this.value == null) {
        this.value = this._prev != null ? this._prev : '0';
        renderAll();
    }
});

const marginInput = document.getElementById('m6-margin');
marginInput.addEventListener('input', function () {
    const v = parseFloat(this.value);
    if (isNaN(v) && this.value !== '') this.value = '';
    if (!isNaN(v)) this.value = Math.min(500, Math.max(0, v)).toString();
    syncClientPriceWithTarget();
});
marginInput.addEventListener('focus', function () {
    this._prev = this.value;
    this.value = '';
});
marginInput.addEventListener('blur', function () {
    if (this.value === '' || this.value == null) {
        this.value = this._prev != null ? this._prev : '15';
        renderAll();
    }
});

function syncClientPriceWithTarget() {
    renderAll();
    const el = document.getElementById('m6-price');
    const v = parseFloat(document.getElementById('m6-suggest-batch').textContent.replace(/[^0-9.-]/g, ''));
    if (!isNaN(v) && el) {
        el.value = String(v);
        renderAll();
    }
}

function renderAllAndSync() {
    renderAll();
    syncClientPriceWithTarget();
}

document.querySelectorAll('select').forEach(select => {
    select.addEventListener('change', renderAllAndSync);
});

initStopwatch('sw-print', renderAllAndSync);

document.addEventListener('dblclick', function (e) {
    const toggle = e.target.closest('.lock-toggle');
    if (!toggle) return;
    const group = toggle.closest('[data-lock]');
    const input = group.querySelector('input');
    const nextLocked = !input.disabled;
    localStorage.setItem('lock-' + input.id, nextLocked ? '1' : '0');
    applyLock(group, input, nextLocked);
    renderAllAndSync();
}, true);

initLocks(renderAllAndSync);
renderAll();
syncClientPriceWithTarget();

function resetAll() {
    document.querySelectorAll('input[type="number"]').forEach(inp => {
        inp.value = inp.defaultValue;
    });
    document.querySelectorAll('select').forEach(sel => {
        const firstSelected = Array.from(sel.options).find(o => o.defaultSelected);
        sel.value = firstSelected ? firstSelected.value : sel.options[0].value;
    });
    document.querySelectorAll('[data-lock]').forEach(group => {
        const input = group.querySelector('input');
        applyLock(group, input, true);
    });
    stopwatchControls.forEach(c => c.set(0, 30));
    Object.keys(localStorage).forEach(k => {
        if (k.startsWith('lock-') || k.startsWith('val-')) localStorage.removeItem(k);
    });
    renderAll();
    syncClientPriceWithTarget();
}

document.getElementById('reset-btn').addEventListener('click', resetAll);