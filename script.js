let printHistory = JSON.parse(localStorage.getItem('printHistory') || '[]');
let filamentMode = localStorage.getItem('filamentMode') || 'perspool';
let marginPct = parseInt(localStorage.getItem('marginPct') || '40', 10);

function initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

function initLocks() {
    document.querySelectorAll('[data-lock]').forEach(group => {
        const input = group.querySelector('input');
        const stored = localStorage.getItem('lock-' + input.id);
        const isLocked = stored != null ? stored === '1' : true;
        applyLock(group, input, isLocked);

        input.addEventListener('input', () => {
            localStorage.setItem('val-' + input.id, input.value);
        });
    });
}

function applyLock(group, input, isLocked) {
    input.disabled = isLocked;
    group.classList.toggle('locked', isLocked);
    group.classList.toggle('unlocked', !isLocked);
    group.querySelector('.lock-toggle').title = isLocked ? 'double-click to unlock' : 'double-click to lock';

    const storedVal = localStorage.getItem('val-' + input.id);
    if (storedVal != null) input.value = storedVal;
}

document.addEventListener('dblclick', function (e) {
    const toggle = e.target.closest('.lock-toggle');
    if (!toggle) return;
    const group = toggle.closest('[data-lock]');
    const input = group.querySelector('input');
    const nextLocked = !input.disabled;
    localStorage.setItem('lock-' + input.id, nextLocked ? '1' : '0');
    applyLock(group, input, nextLocked);
});

function setFilamentMode(mode) {
    filamentMode = mode;
    localStorage.setItem('filamentMode', mode);

    const isBulk = mode === 'bulk';
    document.getElementById('mode-bulk').classList.toggle('active', isBulk);
    document.getElementById('mode-perspool').classList.toggle('active', !isBulk);
    document.getElementById('filament-amount-label').textContent = isBulk ? 'total paid for pack (₹)' : 'price per spool (₹)';
    document.getElementById('spools-label').textContent = isBulk ? 'spools in pack' : 'spools bought';

    if (isBulk) {
        document.getElementById('base-filament').value = 565;
        document.getElementById('spools').value = 1;
    } else {
        document.getElementById('base-filament').value = 565;
        document.getElementById('spools').value = 1;
    }

    renderToggleFormula();
    refreshLive();
}

function renderToggleFormula() {
    const el = document.getElementById('toggle-formula');
    if (filamentMode === 'bulk') {
        el.innerHTML = '';
        return;
    }

    const price = num('base-filament');
    const spools = num('spools') || 1;
    const total = price * spools;
    const fmt = v => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    el.innerHTML = `
        <span class="formula-num">₹${fmt(price)}</span>${price > 0 ? `<span class="formula-op">×</span><span class="formula-num">${spools} spools</span><span class="formula-op">=</span><span class="formula-result">₹${fmt(total)}</span>` : ''}
    `;
}

function formatINR(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function num(id) {
    const el = document.getElementById(id);
    return el ? (parseFloat(el.value) || 0) : 0;
}

function setText(id, value) {
    document.getElementById(id).textContent = formatINR(value);
}

function computeCosts() {
    // 1. FILAMENT
    const baseFilament = num('base-filament');
    const shippingPerSpool = num('shipping-per-spool');
    const spools = num('spools');
    const spoolWeight = num('spool-weight');
    const gramsUsed = num('grams-used');

    const baseSubtotal = filamentMode === 'bulk' ? baseFilament : baseFilament * spools;
    const shipping = shippingPerSpool * spools;
    const gstRate = num('gst-rate');
    const gst = (baseSubtotal + shipping) * (gstRate / 100);
    const sgst = gst / 2;
    const cgst = gst / 2;
    const totalInvoice = baseSubtotal + shipping + gst;
    const totalWeight = spools * spoolWeight;
    const costPerGram = totalInvoice / totalWeight;

    const filamentMaterial = (baseSubtotal / totalWeight) * gramsUsed;
    const shippingAlloc = (shipping / totalWeight) * gramsUsed;
    const gstAlloc = (gst / totalWeight) * gramsUsed;
    const filamentTotal = filamentMaterial + shippingAlloc + gstAlloc;

    // 2. ELECTRICITY
    const baseRate = num('base-rate');
    const fppas = num('fppas');
    const duty = num('duty');
    const watts = num('power');
    const hours = num('time');

    const powerKW = watts / 1000;
    const subtotalRate = baseRate + fppas;
    const effectiveRate = subtotalRate * (1 + duty / 100);

    const elecBase = powerKW * hours * baseRate;
    const elecFppas = powerKW * hours * fppas;
    const elecDuty = (elecBase + elecFppas) * (duty / 100);
    const elecTotal = powerKW * hours * effectiveRate;

    // 3. TIME
    const daily = num('daily');
    const rentCost = (hours / 24) * daily;

    // 4. JOB & BATCH
    const quantity = num('quantity');
    const modelCost = num('model-cost');
    const bufferPct = num('buffer');
    const sale = num('sale');

    const modelAmortized = modelCost / quantity;
    const bufferCost = (bufferPct / 100) * filamentTotal;

    const unitCost = filamentTotal + elecTotal + rentCost + modelAmortized + bufferCost;
    const unitProfit = sale - unitCost;
    const unitProfitPct = sale > 0 ? (unitProfit / sale) * 100 : 0;

    // 5. SELL IT
    const margin = marginPct;
    const marginPrice = margin >= 100 ? unitCost : unitCost / ((100 - margin) / 100);
    const marginProfit = marginPrice - unitCost;
    const soldProfit = sale - unitCost;
    const soldPct = sale > 0 ? (soldProfit / sale) * 100 : 0;

    // batch summary
    const totalFilamentUsed = gramsUsed * quantity;
    const totalRevenue = sale * quantity;
    const totalFilamentExpense = totalFilamentUsed * costPerGram;
    const totalElectricity = elecTotal * quantity;
    const totalRent = rentCost * quantity;
    const totalModel = modelCost;
    const totalBuffer = totalFilamentExpense * (bufferPct / 100);
    const totalExpenses = totalFilamentExpense + totalElectricity + totalRent + totalModel + totalBuffer;
    const netProfit = totalRevenue - totalExpenses;
    const unusedGrams = totalWeight - totalFilamentUsed;
    const unusedValue = unusedGrams > 0 ? unusedGrams * costPerGram : 0;

    return {
        filamentMaterial, shippingAlloc, gstAlloc, filamentTotal,
        sgst, cgst, gstTotal: gst,
        elecBase, elecFppas, elecDuty, elecTotal, rentCost,
        modelAmortized, bufferCost, unitCost, unitProfit, unitProfitPct,
        margin, marginPrice, marginProfit, soldProfit, soldPct,
        quantity, sale, gramsUsed, hours,
        totalFilamentUsed, totalRevenue, totalFilamentExpense, totalElectricity,
        totalRent, totalModel, totalBuffer, totalExpenses, netProfit,
        unusedGrams, unusedValue
    };
}

function renderSectionTotals(c) {
    const q = c.quantity;
    const unit = formatINR;
    document.getElementById('total-materials').innerHTML = `${unit(c.filamentTotal)} <span class="per">/ unit</span> <span class="batch-total">· ${unit(c.filamentTotal * q)} batch</span>`;
    document.getElementById('total-electricity').innerHTML = `${unit(c.elecTotal)} <span class="per">/ unit</span> <span class="batch-total">· ${unit(c.elecTotal * q)} batch</span>`;
    document.getElementById('total-time').innerHTML = `${unit(c.rentCost)} <span class="per">/ unit</span> <span class="batch-total">· ${unit(c.rentCost * q)} batch</span>`;
    document.getElementById('total-batch').innerHTML = `${unit(c.modelAmortized + c.bufferCost)} <span class="per">/ unit</span> <span class="batch-total">· ${unit(c.totalModel + c.totalBuffer)} batch</span>`;
}

function renderGstSplit(c) {
    document.getElementById('sgst-amount').textContent = formatINR(c.sgst);
    document.getElementById('cgst-amount').textContent = formatINR(c.cgst);
    document.getElementById('gst-total').textContent = formatINR(c.gstTotal);
}

function setMargin(pct) {
    marginPct = pct;
    localStorage.setItem('marginPct', String(pct));
    ['25', '50', '70', '40'].forEach(id => {
        document.getElementById('margin-' + id).classList.toggle('active', parseInt(id, 10) === pct);
    });
    refreshLive();
}

function renderMarginSuggestion(c) {
    const fmt = formatINR;
    document.getElementById('sell-cost').textContent = fmt(c.unitCost);
    document.getElementById('margin-lbl').textContent = c.margin;
    document.getElementById('margin-suggest').innerHTML = `${fmt(c.marginPrice)} <span class="per">/ unit</span>`;

    const div = (100 - c.margin) / 100;
    document.getElementById('margin-formula').innerHTML =
        `<span class="formula-num">${fmt(c.unitCost)}</span><span class="formula-op">÷ ${(div).toFixed(2)}</span><span class="formula-op">=</span><span class="formula-result">${fmt(c.marginPrice)}</span>`;

    const line = document.getElementById('sell-profit-line');
    if (c.sale > 0) {
        line.style.display = 'flex';
        const pct = c.soldPct >= 0 ? `+${c.soldPct.toFixed(1)}%` : `${c.soldPct.toFixed(1)}%`;
        document.getElementById('sold-price').textContent = fmt(c.sale);
        const el = document.getElementById('sell-profit');
        el.textContent = `${fmt(Math.abs(c.soldProfit))} (${pct})`;
        el.className = 'sell-value ' + (c.soldProfit >= 0 ? 'profit' : 'loss');
    } else {
        line.style.display = 'none';
    }
}

function refreshLive() {
    const c = computeCosts();
    renderSectionTotals(c);
    renderGstSplit(c);
    renderMarginSuggestion(c);
    document.getElementById('live-unit').innerHTML = formatINR(c.unitCost);
    document.getElementById('live-batch').innerHTML = formatINR(c.totalExpenses);
}

function calculate() {
    const c = computeCosts();

    // full breakdown · per unit vs batch
    const q = c.quantity;
    setText('sum-film-mat-unit', c.filamentMaterial);
    setText('sum-film-mat-batch', c.filamentMaterial * q);
    setText('sum-ship-unit', c.shippingAlloc);
    setText('sum-ship-batch', c.shippingAlloc * q);
    setText('sum-gst-unit', c.gstAlloc);
    setText('sum-gst-batch', c.gstAlloc * q);
    setText('sum-film-unit', c.filamentTotal);
    setText('sum-film-batch', c.filamentTotal * q);

    setText('sum-elec-base-unit', c.elecBase);
    setText('sum-elec-base-batch', c.elecBase * q);
    setText('sum-elec-fppas-unit', c.elecFppas);
    setText('sum-elec-fppas-batch', c.elecFppas * q);
    setText('sum-elec-duty-unit', c.elecDuty);
    setText('sum-elec-duty-batch', c.elecDuty * q);
    setText('sum-elec-unit', c.elecTotal);
    setText('sum-elec-batch', c.elecTotal * q);

    setText('sum-rent-unit', c.rentCost);
    setText('sum-rent-batch', c.totalRent);

    setText('sum-model-unit', c.modelAmortized);
    setText('sum-model-batch', c.totalModel);
    setText('sum-buffer-unit', c.bufferCost);
    setText('sum-buffer-batch', c.totalBuffer);

    setText('sum-cost-unit', c.unitCost);
    setText('sum-cost-batch', c.totalExpenses);
    setText('sum-rev-unit', c.sale);
    setText('sum-rev-batch', c.totalRevenue);
    setText('sum-profit-unit', c.unitProfit);
    setText('sum-profit-batch', c.netProfit);

    document.getElementById('sum-profit-unit').className = 'summary-cell bold-cell ' + (c.unitProfit >= 0 ? 'profit' : 'loss');
    document.getElementById('sum-profit-batch').className = 'summary-cell bold-cell ' + (c.netProfit >= 0 ? 'profit' : 'loss');

    document.getElementById('results').style.display = 'block';

    const historyItem = {
        weight: c.gramsUsed + 'g',
        time: c.hours + 'h',
        units: c.quantity + ' u',
        cost: formatINR(c.unitCost),
        date: new Date().toLocaleDateString()
    };
    printHistory.unshift(historyItem);
    if (printHistory.length > 10) printHistory.pop();
    localStorage.setItem('printHistory', JSON.stringify(printHistory));
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = printHistory.map(item => `
        <div class="history-item">
            <span class="history-item-name">${item.weight} · ${item.time} · ${item.units} · ${item.date}</span>
            <span class="history-item-cost">${item.cost}</span>
        </div>
    `).join('');
}

function clearHistory() {
    printHistory = [];
    localStorage.removeItem('printHistory');
    renderHistory();
}

setFilamentMode(filamentMode);
setMargin(marginPct);
initTheme();
document.getElementById('base-filament').addEventListener('input', renderToggleFormula);
document.getElementById('spools').addEventListener('input', renderToggleFormula);
initLocks();
document.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('input', refreshLive);
});
renderSectionTotals(computeCosts());
renderHistory();