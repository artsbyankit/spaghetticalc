let printHistory = JSON.parse(localStorage.getItem('printHistory') || '[]');
let filamentMode = localStorage.getItem('filamentMode') || 'bulk';

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
        document.getElementById('base-filament').value = 1695;
        document.getElementById('spools').value = 3;
    } else {
        document.getElementById('base-filament').value = 600;
        document.getElementById('spools').value = 3;
    }

    renderToggleFormula();
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
    return parseFloat(document.getElementById(id).value) || 0;
}

function setText(id, value) {
    document.getElementById(id).textContent = formatINR(value);
}

function calculate() {
    // 1. FILAMENT
    const baseFilament = num('base-filament');
    const shipping = num('shipping');
    const gst = num('gst');
    const spools = num('spools');
    const spoolWeight = num('spool-weight');
    const gramsUsed = num('grams-used');

    const baseSubtotal = filamentMode === 'bulk' ? baseFilament : baseFilament * spools;
    const totalInvoice = baseSubtotal + shipping + gst;
    const totalWeight = spools * spoolWeight;
    const costPerGram = totalInvoice / totalWeight;

    const filamentMaterial = costPerGram * gramsUsed;
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

    // per-unit display
    setText('filament-material', filamentMaterial);
    setText('shipping-alloc', shippingAlloc);
    setText('gst-alloc', gstAlloc);
    setText('filament-total', filamentTotal);
    setText('elec-base', elecBase);
    setText('elec-fppas', elecFppas);
    setText('elec-duty', elecDuty);
    setText('elec-total', elecTotal);
    setText('model-amortized', modelAmortized);
    setText('buffer-cost', bufferCost);
    setText('unit-cost', unitCost);
    setText('unit-profit', unitProfit);

    const profitEl = document.getElementById('unit-profit');
    profitEl.className = 'result-number ' + (unitProfit >= 0 ? 'profit' : 'loss');

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

    setText('total-revenue', totalRevenue);
    setText('total-filament-expense', totalFilamentExpense);
    setText('total-electric', totalElectricity);
    setText('total-model', totalModel);
    setText('total-buffer', totalBuffer);
    setText('net-profit', netProfit);
    setText('unused-value', Math.max(0, unusedValue));

    document.getElementById('net-profit').className = 'result-number ' + (netProfit >= 0 ? 'profit' : 'loss');

    // pricing tiers
    setText('tier-breakeven', unitCost);
    setText('tier-budget', unitCost / 0.75);
    setText('tier-standard', unitCost / 0.60);
    setText('tier-commercial', unitCost / 0.50);

    // full breakdown · per unit vs batch
    setText('sum-film-mat-unit', filamentMaterial);
    setText('sum-film-mat-batch', filamentMaterial * quantity);
    setText('sum-ship-unit', shippingAlloc);
    setText('sum-ship-batch', shippingAlloc * quantity);
    setText('sum-gst-unit', gstAlloc);
    setText('sum-gst-batch', gstAlloc * quantity);
    setText('sum-film-unit', filamentTotal);
    setText('sum-film-batch', filamentTotal * quantity);

    setText('sum-elec-base-unit', elecBase);
    setText('sum-elec-base-batch', elecBase * quantity);
    setText('sum-elec-fppas-unit', elecFppas);
    setText('sum-elec-fppas-batch', elecFppas * quantity);
    setText('sum-elec-duty-unit', elecDuty);
    setText('sum-elec-duty-batch', elecDuty * quantity);
    setText('sum-elec-unit', elecTotal);
    setText('sum-elec-batch', elecTotal * quantity);

    setText('sum-rent-unit', rentCost);
    setText('sum-rent-batch', totalRent);

    setText('sum-model-unit', modelAmortized);
    setText('sum-model-batch', modelCost);
    setText('sum-buffer-unit', bufferCost);
    setText('sum-buffer-batch', totalBuffer);

    setText('sum-cost-unit', unitCost);
    setText('sum-cost-batch', totalExpenses);
    setText('sum-rev-unit', sale);
    setText('sum-rev-batch', totalRevenue);
    setText('sum-profit-unit', unitProfit);
    setText('sum-profit-batch', netProfit);

    document.getElementById('sum-profit-unit').className = 'summary-cell bold-cell ' + (unitProfit >= 0 ? 'profit' : 'loss');
    document.getElementById('sum-profit-batch').className = 'summary-cell bold-cell ' + (netProfit >= 0 ? 'profit' : 'loss');

    // fun facts
    const facts = [
        `that's ${Math.max(1, Math.floor(netProfit / 40))} cans of soda in profit`,
        `your printer just printed money... out of your bank account`,
        `at least the spaghetti is plastic`,
        `the real cost is the friends we lost along the way`,
        `your wallet just filed a police report`,
        `this is why we can't have nice things`,
        `imagine explaining this hobby to your grandparents`,
        `the printer goes brrr but your bank account goes crying`,
        `another print, another hole in your pocket`,
        `you could've bought a used car by now`,
        `margin: ${unitProfitPct.toFixed(1)}% · keep the lights on, champ`
    ];
    document.getElementById('fun-fact').textContent = facts[Math.floor(Math.random() * facts.length)];

    document.getElementById('results').style.display = 'block';

    const historyItem = {
        weight: gramsUsed + 'g',
        time: hours + 'h',
        units: quantity + ' u',
        cost: formatINR(unitCost),
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
document.getElementById('base-filament').addEventListener('input', renderToggleFormula);
document.getElementById('spools').addEventListener('input', renderToggleFormula);
initLocks();
renderHistory();