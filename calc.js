// Pure cost and pricing math. No DOM here, so it can be tested with `node --test`.
(function (root) {
    const DAY_HOURS = 12;
    const MAX_MARKUP = 500;

    function roundUpTo(value, step) {
        if (!(step > 0)) return value;
        return Math.ceil((value - 1e-9) / step) * step;
    }

    function computeM1(s) {
        const totalG = s.spools * s.spoolGrams;
        const costPerG = totalG > 0 ? s.invoice / totalG : 0;
        return { totalG, costPerG };
    }

    function computeM2(s, costPerG) {
        const units = Math.floor(s.units);
        const baseGrams = units * s.grams;
        const bufferedGrams = baseGrams * (1 + s.failedPct / 100);
        const filamentCostUnit = s.grams * costPerG;
        return {
            units, baseGrams, bufferedGrams, filamentCostUnit,
            // both exclude the failed print buffer, which module 05 adds as its own line
            filamentCostBatch: filamentCostUnit * units,
            modelCostUnit: units > 0 ? s.model / units : 0,
            modelCostBatch: units > 0 ? s.model : 0
        };
    }

    function computeM3(s) {
        const printH = s.printH + s.printM / 60;
        const laborMin = s.support + s.sand + s.iron;
        const laborH = laborMin / 60;
        const ratePerH = s.ratePerDay / DAY_HOURS;
        const machineCost = printH * ratePerH;
        const laborCost = laborH * ratePerH;
        return {
            printH, laborMin, laborH, prodH: printH + laborH,
            dayHours: DAY_HOURS, ratePerH, machineCost, laborCost,
            total: machineCost + laborCost
        };
    }

    // the printer only draws power while printing, not during hand post-processing
    function computeM4(s, printH, units) {
        const kwhUnit = (s.powerW / 1000) * printH;
        const costPerKwh = s.elecRate * (1 + s.dutyPct / 100);
        return {
            kwhUnit,
            kwhBatch: kwhUnit * units,
            costUnit: kwhUnit * costPerKwh,
            costBatch: kwhUnit * units * costPerKwh
        };
    }

    function computeM5(s, m2, m3, m4) {
        const units = m2.units;
        const base = m2.filamentCostUnit + m3.machineCost + m3.laborCost + m4.costUnit;
        const maintainUnit = base * s.maintainPct / 100;
        const failUnit = base * s.failedPct / 100;
        const parts = [
            { key: 'material', label: 'material', unit: m2.filamentCostUnit },
            { key: 'model', label: '3d model', unit: m2.modelCostUnit },
            { key: 'machine', label: 'machine', unit: m3.machineCost },
            { key: 'labor', label: 'labor', unit: m3.laborCost },
            { key: 'elec', label: 'electricity', unit: m4.costUnit },
            { key: 'maintain', label: 'maintenance', unit: maintainUnit },
            { key: 'fail', label: 'failed prints', unit: failUnit }
        ];
        const totalUnit = base + m2.modelCostUnit + maintainUnit + failUnit;
        parts.forEach(p => {
            p.batch = p.unit * units;
            p.share = totalUnit > 0 ? p.unit / totalUnit : 0;
        });
        return { units, parts, totalUnit, totalBatch: totalUnit * units };
    }

    function computeM6(s, m5, m3) {
        const units = m5.units;
        const coefficient = 1 + s.markupPct / 100;
        const suggestBatch = m5.totalBatch * coefficient;
        // locked price follows the target, unlocked price is whatever was agreed with the client
        const priceBatch = s.priceManual ? s.price : roundUpTo(suggestBatch, s.roundTo);
        const profitBatch = priceBatch - m5.totalBatch;
        const jobH = m3.prodH * units;
        return {
            units, priceBatch, profitBatch, jobH,
            priceUnit: units > 0 ? priceBatch / units : 0,
            profitUnit: units > 0 ? profitBatch / units : 0,
            suggestUnit: m5.totalUnit * coefficient,
            suggestBatch,
            targetProfitUnit: m5.totalUnit * (s.markupPct / 100),
            targetProfitBatch: m5.totalBatch * (s.markupPct / 100),
            markupPct: m5.totalBatch > 0 ? (profitBatch / m5.totalBatch) * 100 : 0,
            marginPct: priceBatch > 0 ? (profitBatch / priceBatch) * 100 : 0,
            perH: jobH > 0 ? profitBatch / jobH : 0
        };
    }

    function buildWarnings(s, m1, m2, m3, m6) {
        const warnings = [];
        if (m2.units <= 0) warnings.push({ field: 'm2-units', text: 'set the number of units, the job is empty' });
        if (s.grams > 0 && m1.costPerG <= 0) warnings.push({ field: 'm1-total-cost', text: 'filament is costing ₹0, check invoice, spools and spool weight' });
        if (s.grams <= 0 && m2.units > 0) warnings.push({ field: 'm2-grams', text: 'filament per unit is 0, material cost is missing' });
        if (m3.printH <= 0 && m2.units > 0) warnings.push({ field: 'm3-print-h', text: 'print time is 0, machine and electricity cost are missing' });
        if (m1.totalG > 0 && m2.bufferedGrams > m1.totalG) warnings.push({ field: 'm1-units', text: 'job needs more filament than the spools you listed' });
        if (m2.units > 0 && m6.profitBatch < 0) warnings.push({ field: 'm6-price', text: 'this price is below your production cost' });
        return warnings;
    }

    function computeAll(s) {
        const m1 = computeM1(s);
        const m2 = computeM2(s, m1.costPerG);
        const m3 = computeM3(s);
        const m4 = computeM4(s, m3.printH, m2.units);
        const m5 = computeM5(s, m2, m3, m4);
        const m6 = computeM6(s, m5, m3);
        return { m1, m2, m3, m4, m5, m6, warnings: buildWarnings(s, m1, m2, m3, m6) };
    }

    const api = { computeAll, roundUpTo, MAX_MARKUP };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SpaghettiCalc = api;
})(this);
