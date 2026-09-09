let printHistory = JSON.parse(localStorage.getItem('printHistory') || '[]');

function formatINR(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

function calculate() {
    const filament = parseFloat(document.getElementById('filament').value) || 0;
    const weight = parseFloat(document.getElementById('weight').value) || 0;
    const time = parseFloat(document.getElementById('time').value) || 0;
    const electricity = parseFloat(document.getElementById('electricity').value) || 0;
    const power = parseFloat(document.getElementById('power').value) || 0;
    const daily = parseFloat(document.getElementById('daily').value) || 0;
    const failure = parseFloat(document.getElementById('failure').value) || 0;

    const materialCost = (weight / 1000) * filament;
    const electricCost = (power / 1000) * time * electricity;
    const rentCost = (time / 24) * daily;
    const failureCost = (materialCost + electricCost + rentCost) * (failure / 100);
    const total = materialCost + electricCost + rentCost + failureCost;

    document.getElementById('material-cost').textContent = formatINR(materialCost);
    document.getElementById('electric-cost').textContent = formatINR(electricCost);
    document.getElementById('rent-cost').textContent = formatINR(rentCost);
    document.getElementById('failure-cost').textContent = formatINR(failureCost);
    document.getElementById('total-cost').textContent = formatINR(total);

    const facts = [
        `that's ${Math.floor(total / 40)} cans of soda you could've bought`,
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

    const historyItem = {
        weight: weight + 'g',
        time: time + 'h',
        cost: formatINR(total),
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

renderHistory();