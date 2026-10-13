export function extractSsgaFacts(sections, ticker) {
    const normalize = text => text.replace(/\s+/g, ' ').trim();
    const section = name => sections.find(item => normalize(item.heading).startsWith(`${name} as of `));
    const yields = section('Yields');
    const characteristics = section('Fund Characteristics');
    const value = (table, label) => table?.rows.find(row =>
        normalize(row[0].split(/\r?\n/)[0]) === label
    )?.[1];
    const number = (raw, percent = false) => {
        if (!raw) return undefined;
        const text = raw.trim().replace(/(?:%|years|yrs)$/, '').trim();
        if (!/^-?\d+(?:\.\d+)?$/.test(text)) return undefined;
        const result = Number(text) / (percent ? 100 : 1);
        return Number.isFinite(result) ? result : undefined;
    };

    const thirtyDayYield = number(value(yields, '30 Day SEC Yield'), true);
    if (thirtyDayYield === undefined) throw new Error(`No valid thirtyDayYield found for ticker '${ticker}'`);
    const dateText = yields.heading.match(/as of (.+)$/)?.[1];
    const date = new Date(dateText);
    if (!dateText || !Number.isFinite(date.getTime())) throw new Error(`No valid yield asOfDate found for ticker '${ticker}'`);

    const facts = {
        thirtyDayYield: Number(thirtyDayYield.toFixed(4)),
        asOfDate: date.toISOString().split('T')[0]
    };
    for (const [field, table, label, percent, digits] of [
        ['weightedAverageCoupon', characteristics, 'Average Coupon', true, 4],
        ['durationYears', characteristics, 'Option Adjusted Duration', false, 2],
        ['maturityYears', characteristics, 'Average Maturity in Years', false, 2],
        ['yieldToWorst', characteristics, 'Average Yield To Worst', true, 4],
        ['yieldToMaturity', characteristics, 'Yield to Maturity', true, 4],
        ['distributionYield', yields, 'Fund Distribution Yield', true, 4]
    ]) {
        const parsed = number(value(table, label), percent);
        if (parsed === undefined) {
            console.error(`No valid ${field} found for ticker '${ticker}'`);
        } else {
            facts[field] = Number(parsed.toFixed(digits));
        }
    }
    return facts;
}
