const store = {
    get(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, value) {
        try { localStorage.setItem(key, value); } catch (e) {}
    },
    remove(key) {
        try { localStorage.removeItem(key); } catch (e) {}
    }
};

function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

function initTheme() {
    const stored = store.get('theme');
    const theme = stored || systemTheme();
    document.documentElement.setAttribute('data-theme', theme);
    applyThemeColor(theme);

    if (!stored && window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (store.get('theme')) return;
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
    store.set('theme', next);
    applyThemeColor(next);
}

initTheme();

const inrFmt = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

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

function fmtNum2(n) {
    const r = Math.round(n * 100) / 100;
    return Number.isInteger(r) ? r.toString() : r.toFixed(2);
}

function fmtPct(n) {
    return `${Math.round(n * 10) / 10}%`;
}

function fmtDur(h) {
    const totMin = Math.round(h * 60);
    const hh = Math.floor(totMin / 60);
    const mm = totMin % 60;
    return `${hh}h ${String(mm).padStart(2, '0')}m`;
}

function formatWeight(g) {
    return g < 1000 ? `${fmtNum2(g)} g` : `${fmtNum2(g / 1000)} kg`;
}

const elCache = new Map();

function el(id) {
    let node = elCache.get(id);
    if (!node) {
        node = document.getElementById(id);
        if (node) elCache.set(id, node);
    }
    return node;
}

function setText(id, text) {
    const node = el(id);
    if (node.textContent !== text) node.textContent = text;
}

function num(id) {
    return Math.max(0, parseFloat(el(id).value) || 0);
}

const FIELD_IDS = [
    'm1-total-cost', 'm1-units', 'm1-per-unit',
    'm2-units', 'm2-model', 'm2-grams', 'm2-failed', 'm2-maintain',
    'm3-print-h', 'm3-print-m', 'm3-support', 'm3-sand', 'm3-iron', 'm3-rate',
    'm4-power', 'm4-duty', 'm4-rate',
    'm6-margin', 'm6-round', 'm6-price'
];
const MAX_PRINT_HOURS = 999;
const lastValid = new Map();

function readState() {
    return {
        invoice: num('m1-total-cost'), spools: num('m1-units'), spoolGrams: num('m1-per-unit'),
        units: num('m2-units'), model: num('m2-model'), grams: num('m2-grams'),
        failedPct: num('m2-failed'), maintainPct: num('m2-maintain'),
        printH: num('m3-print-h'), printM: num('m3-print-m'),
        support: num('m3-support'), sand: num('m3-sand'), iron: num('m3-iron'), ratePerDay: num('m3-rate'),
        powerW: num('m4-power'), dutyPct: num('m4-duty'), elecRate: num('m4-rate'),
        markupPct: num('m6-margin'), roundTo: num('m6-round'),
        priceManual: !el('m6-price').disabled, price: num('m6-price')
    };
}

let current = null;

function renderAll() {
    const s = readState();
    const r = SpaghettiCalc.computeAll(s);
    current = r;
    if (!s.priceManual) el('m6-price').value = fmtNum2(r.m6.priceBatch);
    renderM1(r.m1);
    renderM2(r.m2);
    renderM3(r.m3);
    renderM4(r.m4);
    renderM5(r.m5, s.maintainPct);
    renderM6(r.m6);
    renderSummary(r, s.priceManual);
}

function renderM1(m) {
    setText('m1-total-filament', formatWeight(m.totalG));
    setText('m1-cost-g', `${formatINR(m.costPerG)}/g`);
    const grams = num('m1-per-unit');
    setText('m1-per-unit-hint', grams > 0 ? `= ${formatWeight(grams)}` : '');
}

function renderM2(m) {
    setText('m2-total-filament', formatWeight(m.bufferedGrams));
    setText('m2-filament-unit', `${formatINR(m.filamentCostUnit)}/unit`);
    setText('m2-filament-batch', `${formatINR(m.filamentCostBatch)} batch`);
    setText('m2-model-unit', `${formatINR(m.modelCostUnit)}/unit`);
    setText('m2-model-batch', `${formatINR(m.modelCostBatch)} batch`);
}

function renderM3(m) {
    setText('m3-total', formatINR(m.total));
    setText('m3-prod-time', fmtDur(m.prodH));
    setText('m3-labor-time', `${fmtNum2(m.laborMin)} min`);
    setText('m3-rate-cost', `${formatINR(m.total)}/unit`);
    setText('m3-rate-hint', `= ${formatINR(m.ratePerH)}/h · ${m.dayHours} h day`);
}

function renderM4(m) {
    setText('m4-total', formatINR(m.costUnit));
    setText('m4-kwh-unit', `${fmtNum2(m.kwhUnit)} kWh`);
    setText('m4-kwh-batch', `${fmtNum2(m.kwhBatch)} kWh`);
    setText('m4-unit', `${formatINR(m.costUnit)}/unit`);
    setText('m4-batch', `${formatINR(m.costBatch)} batch`);
}

function renderM5(m, maintainPct) {
    m.parts.forEach(p => {
        setText(`m5-${p.key}-unit`, formatINR(p.unit));
        setText(`m5-${p.key}-batch`, formatINR(p.batch));
    });
    setText('m5-maintain-lbl', `(${maintainPct}%)`);
    setText('m5-total-unit', formatINR(m.totalUnit));
    setText('m5-total-batch', formatINR(m.totalBatch));
    renderBreakdown(m);
}

function renderBreakdown(m) {
    let top = null;
    m.parts.forEach(p => {
        const seg = el(`bar-${p.key}`);
        seg.style.flexGrow = p.share;
        seg.hidden = p.share <= 0;
        seg.dataset.tip = `${p.label}: ${fmtPct(p.share * 100)} · ${formatINR(p.batch)} batch`;
        setText(`legend-${p.key}`, fmtPct(p.share * 100));
        if (!top || p.share > top.share) top = p;
    });
    setText('m5-driver', top && top.share > 0
        ? `biggest cost: ${top.label}, ${fmtPct(top.share * 100)} of the job`
        : 'nothing to break down yet');
}

function renderM6(m) {
    setText('m6-cost-unit', formatINR(current.m5.totalUnit));
    setText('m6-cost-batch', formatINR(current.m5.totalBatch));
    setText('m6-suggest-unit', formatINR(m.suggestUnit));
    setText('m6-suggest-batch', formatINR(m.suggestBatch));
    setText('m6-profit-unit', formatINR(m.targetProfitUnit));
    setText('m6-profit-batch', formatINR(m.targetProfitBatch));
    setText('m6-real-markup', fmtPct(m.markupPct));
    setText('m6-real-margin', fmtPct(m.marginPct));
    setText('m6-job-h', fmtDur(m.jobH));
    setText('m6-perhour', `${formatINR(m.perH)}/h`);
    setText('m6-price-batch', `${formatINR(m.priceBatch)} batch`);
    setText('m6-price-unit', `${formatINR(m.priceUnit)}/unit`);
    setText('m6-profit-per', `${formatINR(m.profitUnit)}/unit`);
    setText('m6-profit-total', `${formatINR(m.profitBatch)} batch`);

    const isLoss = m.profitBatch < 0;
    el('m6-perhour').classList.toggle('neg', isLoss);
    el('m6-print-total').classList.toggle('neg', isLoss);
    el('m6-round').disabled = !el('m6-price').disabled;
    el('quote-btn').disabled = m.units <= 0;
}

let warningsKey = '';

function renderSummary(r, priceManual) {
    const m = r.m6;
    setText('sum-cost', formatINR(r.m5.totalBatch));
    setText('sum-price', formatINR(m.priceBatch));
    setText('sum-price-label', priceManual ? 'your price' : 'price · auto');
    setText('sum-profit', formatINR(m.profitBatch));
    el('sum-profit').classList.toggle('neg', m.profitBatch < 0);
    setText('sum-meta', `${fmtPct(m.markupPct)} markup · ${fmtPct(m.marginPct)} margin · ${formatINR(m.perH)}/h`);

    const key = r.warnings.map(w => w.field).join();
    if (key === warningsKey) return;
    warningsKey = key;
    const box = el('sum-warnings');
    box.textContent = '';
    r.warnings.forEach(w => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sum-warning';
        btn.dataset.field = w.field;
        btn.textContent = `⚠ ${w.text}`;
        box.appendChild(btn);
    });
}

function persist(input) {
    store.set('val-' + input.id, input.value);
}

function normalizePrintTime() {
    const total = Math.min(
        MAX_PRINT_HOURS * 60 + 59,
        Math.round(num('m3-print-h') * 60 + num('m3-print-m'))
    );
    el('m3-print-h').value = Math.floor(total / 60);
    el('m3-print-m').value = total % 60;
    persist(el('m3-print-h'));
    persist(el('m3-print-m'));
    lastValid.set('m3-print-h', el('m3-print-h').value);
    lastValid.set('m3-print-m', el('m3-print-m').value);
}

function initFields() {
    FIELD_IDS.forEach(id => {
        const input = el(id);
        const stored = store.get('val-' + id);
        if (stored != null && stored !== '') input.value = stored;
        lastValid.set(id, input.value);
    });

    const calculator = document.querySelector('.calculator');

    calculator.addEventListener('input', e => {
        const input = e.target;
        if (!FIELD_IDS.includes(input.id)) return;
        // a blank field mid-edit keeps the last result until something is typed
        if (input.value === '') return;
        if (parseFloat(input.value) < 0) input.value = '0';
        if (input.id === 'm6-margin' && parseFloat(input.value) > SpaghettiCalc.MAX_MARKUP) {
            input.value = String(SpaghettiCalc.MAX_MARKUP);
        }
        lastValid.set(input.id, input.value);
        persist(input);
        renderAll();
    });

    calculator.addEventListener('focusin', e => {
        if (e.target.matches('input[type="number"]')) e.target.select();
    });

    calculator.addEventListener('focusout', e => {
        const input = e.target;
        if (!FIELD_IDS.includes(input.id)) return;
        if (input.value === '') input.value = lastValid.get(input.id);
        if (input.id === 'm2-units') {
            input.value = Math.floor(num('m2-units'));
            persist(input);
        }
        if (input.id === 'm3-print-h' || input.id === 'm3-print-m') normalizePrintTime();
        renderAll();
    });
}

function initStopwatch() {
    el('sw-print').addEventListener('click', e => {
        const btn = e.target.closest('.sw-btn');
        if (!btn) return;
        const delta = (btn.dataset.sw === 'h' ? 60 : 15) * (btn.dataset.dir === 'up' ? 1 : -1);
        el('m3-print-m').value = Math.max(0, num('m3-print-h') * 60 + num('m3-print-m') + delta);
        el('m3-print-h').value = 0;
        normalizePrintTime();
        renderAll();
    });
}

function applyLock(group, isLocked) {
    const input = group.querySelector('input');
    const toggle = group.querySelector('.lock-toggle');
    input.disabled = isLocked;
    group.classList.toggle('locked', isLocked);
    group.classList.toggle('unlocked', !isLocked);
    toggle.title = isLocked ? 'click to unlock' : 'click to lock';
    toggle.setAttribute('aria-label', toggle.title);
    toggle.setAttribute('aria-pressed', String(isLocked));
}

function initLocks() {
    document.querySelectorAll('[data-lock]').forEach(group => {
        const input = group.querySelector('input');
        applyLock(group, store.get('lock-' + input.id) !== '0');
    });

    document.querySelector('.calculator').addEventListener('click', e => {
        const toggle = e.target.closest('.lock-toggle');
        if (!toggle) return;
        // a toggle sits inside a label, which must not also fire
        e.preventDefault();
        const group = toggle.closest('[data-lock]');
        const input = group.querySelector('input');
        const nextLocked = !input.disabled;
        store.set('lock-' + input.id, nextLocked ? '1' : '0');
        applyLock(group, nextLocked);
        if (!nextLocked) input.focus();
        persist(input);
        renderAll();
    });
}

function initWarnings() {
    el('sum-warnings').addEventListener('click', e => {
        const btn = e.target.closest('.sum-warning');
        if (!btn) return;
        const input = el(btn.dataset.field);
        input.scrollIntoView({ block: 'center' });
        if (!input.disabled) input.focus({ preventScroll: true });
    });
}

function initBarTooltip() {
    const bar = el('m5-bar');
    const tip = el('m5-tip');
    bar.addEventListener('pointermove', e => {
        const seg = e.target.closest('.bar-seg');
        if (!seg) return;
        const box = bar.getBoundingClientRect();
        tip.textContent = seg.dataset.tip;
        tip.hidden = false;
        const half = tip.offsetWidth / 2;
        tip.style.left = `${Math.max(half, Math.min(box.width - half, e.clientX - box.left))}px`;
    });
    bar.addEventListener('pointerleave', () => { tip.hidden = true; });
}

let toastTimer = null;

function showToast(text, undo) {
    const toast = el('toast');
    setText('toast-text', text);
    const btn = el('toast-undo');
    btn.hidden = !undo;
    btn.onclick = () => {
        if (undo) undo();
        toast.hidden = true;
    };
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, undo ? 8000 : 2500);
}

function buildQuote() {
    const m = current.m6;
    return [
        '3D print quote',
        `quantity: ${m.units} pcs`,
        `price per piece: ${formatINR(m.priceUnit)}`,
        `total: ${formatINR(m.priceBatch)}`,
        `production time: ${fmtDur(m.jobH)}`
    ].join('\n');
}

async function copyQuote() {
    const text = buildQuote();
    try {
        await navigator.clipboard.writeText(text);
        showToast('quote copied, paste it to your client');
    } catch (e) {
        showToast('could not copy, your browser blocked the clipboard');
    }
}

function snapshot() {
    return FIELD_IDS.map(id => [id, el(id).value, el(id).disabled]);
}

function restore(snap) {
    snap.forEach(([id, value]) => {
        el(id).value = value;
        lastValid.set(id, value);
        persist(el(id));
    });
    document.querySelectorAll('[data-lock]').forEach(group => {
        const input = group.querySelector('input');
        const isLocked = snap.find(([id]) => id === input.id)[2];
        store.set('lock-' + input.id, isLocked ? '1' : '0');
        applyLock(group, isLocked);
    });
    renderAll();
}

function resetAll() {
    const before = snapshot();
    FIELD_IDS.forEach(id => {
        const input = el(id);
        if (input.tagName === 'SELECT') {
            const selected = Array.from(input.options).find(o => o.defaultSelected);
            input.value = selected ? selected.value : input.options[0].value;
        } else {
            input.value = input.defaultValue;
        }
        lastValid.set(id, input.value);
        store.remove('val-' + id);
        store.remove('lock-' + id);
    });
    document.querySelectorAll('[data-lock]').forEach(group => applyLock(group, true));
    renderAll();
    showToast('everything is back to defaults', () => restore(before));
}

initFields();
initLocks();
initStopwatch();
initWarnings();
initBarTooltip();
renderAll();

el('reset-btn').addEventListener('click', resetAll);
el('quote-btn').addEventListener('click', copyQuote);
