let printHistory = JSON.parse(localStorage.getItem('printHistory') || '[]');

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

    const totalInvoice = baseFilament + shipping + gst;
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

    // 3. JOB & BATCH
    const quantity = num('quantity');
    const modelCost = num('model-cost');
    const bufferPct = num('buffer');
    const sale = num('sale');

    const modelAmortized = modelCost / quantity;
    const bufferCost = (bufferPct / 100) * filamentTotal;

    const unitCost = filamentTotal + elecTotal + modelAmortized + bufferCost;
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
    const totalModel = modelCost;
    const totalBuffer = totalFilamentExpense * (bufferPct / 100);
    const totalExpenses = totalFilamentExpense + totalElectricity + totalModel + totalBuffer;
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

renderHistory();