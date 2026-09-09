let printHistory = JSON.parse(localStorage.getItem('printHistory') || '[]');

const DEFAULTS = {
    tax: 18,
    overhead: 50,
    electricity: 7.88,
    power: 80,
    filament: 2000,
    weight: 50,
    time: 4,
    daily: 300,
    consumables: 10,
    failure: 10
};

function loadDefaults() {
    Object.keys(DEFAULTS).forEach(key => {
        const el = document.getElementById(key);
        if (el) el.value = DEFAULTS[key];
    });
}

function formatINR(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function getCosts() {
    const taxRate = parseFloat(document.getElementById('tax').value) || 0;
    const overhead = parseFloat(document.getElementById('overhead').value) || 0;
    const electricity = parseFloat(document.getElementById('electricity').value) || 0;
    const power = parseFloat(document.getElementById('power').value) || 0;
    const filament = parseFloat(document.getElementById('filament').value) || 0;
    const weight = parseFloat(document.getElementById('weight').value) || 0;
    const time = parseFloat(document.getElementById('time').value) || 0;
    const daily = parseFloat(document.getElementById('daily').value) || 0;
    const consumables = parseFloat(document.getElementById('consumables').value) || 0;
    const failure = parseFloat(document.getElementById('failure').value) || 0;

    const materialCost = (weight / 1000) * filament;
    const electricCost = (power / 1000) * time * electricity;
    const rentCost = (time / 24) * daily;
    const failureCost = (materialCost + electricCost + rentCost + consumables + overhead) * (failure / 100);
    const base = materialCost + electricCost + rentCost + consumables + overhead;
    const effectiveBase = base + failureCost;
    const taxAmount = effectiveBase * (taxRate / 100);
    const total = effectiveBase + taxAmount;

    return { materialCost, electricCost, rentCost, consumables, overhead, failureCost, taxRate, taxAmount, total };
}

function calculate() {
    const c = getCosts();

    document.getElementById('material-cost').textContent = formatINR(c.materialCost);
    document.getElementById('electric-cost').textContent = formatINR(c.electricCost);
    document.getElementById('rent-cost').textContent = formatINR(c.rentCost);
    document.getElementById('consumables-cost').textContent = formatINR(c.consumables);
    document.getElementById('overhead-cost').textContent = formatINR(c.overhead);
    document.getElementById('failure-cost').textContent = formatINR(c.failureCost);
    document.getElementById('tax-amount').textContent = formatINR(c.taxAmount);
    document.getElementById('tax-label').textContent = c.taxRate;
    document.getElementById('total-cost').textContent = formatINR(c.total);

    const facts = [
        `that's ${Math.max(1, Math.floor(c.total / 40))} cans of soda you could've bought`,
        `your printer just printed money... out of your bank account`,
        `at least the spaghetti is plastic`,
        `the real cost is the friends we lost along the way`,
        `your wallet just filed a police report`,
        `this is why we can't have nice things`,
        `imagine explaining this hobby to your grandparents`,
        `the printer goes brrr but your bank account goes crying`,
        `another print, another hole in your pocket`,
        `you could've bought a used car by now`
    ];
    document.getElementById('fun-fact').textContent = facts[Math.floor(Math.random() * facts.length)];

    document.getElementById('results').style.display = 'block';
    calculateMargin();

    const historyItem = {
        weight: c.materialCost >= 0 ? document.getElementById('weight').value + 'g' : '0g',
        time: document.getElementById('time').value + 'h',
        cost: formatINR(c.total),
        date: new Date().toLocaleDateString()
    };
    printHistory.unshift(historyItem);
    if (printHistory.length > 10) printHistory.pop();
    localStorage.setItem('printHistory', JSON.stringify(printHistory));
    renderHistory();
}

function calculateMargin() {
    const c = getCosts();
    const sale = parseFloat(document.getElementById('sale').value) || 0;
    const margin = sale - c.total;
    const pct = sale > 0 ? (margin / sale) * 100 : 0;

    const amtEl = document.getElementById('margin-amount');
    const pctEl = document.getElementById('margin-percent');

    if (sale <= 0) {
        amtEl.textContent = '—';
        pctEl.textContent = '—';
        amtEl.className = 'result-number';
        pctEl.className = 'result-number';
        return;
    }

    amtEl.textContent = formatINR(margin);
    pctEl.textContent = pct.toFixed(1) + '%';
    amtEl.className = 'result-number ' + (margin >= 0 ? 'profit' : 'loss');
    pctEl.className = 'result-number ' + (margin >= 0 ? 'profit' : 'loss');
}

function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = printHistory.map(item => `
        <div class="history-item">
            <span class="history-item-name">${item.weight} · ${item.time} · ${item.date}</span>
            <span class="history-item-cost">${item.cost}</span>
        </div>
    `).join('');
}

function clearHistory() {
    printHistory = [];
    localStorage.removeItem('printHistory');
    renderHistory();
}

loadDefaults();
renderHistory();