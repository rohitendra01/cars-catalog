function calculateCroPricing(car, apr = 9) {
    const currentPrice = Math.max(0, Number(car && car.price) || 0);
    const marketValue = Math.max(0, Number(car && car.market_value) || 0);
    const annualRate = Number.isFinite(Number(apr)) ? Math.min(30, Math.max(0, Number(apr))) : 9;
    const termMonths = 60;
    const monthlyRate = annualRate / 100 / 12;
    const monthlyEstimate = currentPrice === 0 ? 0 : monthlyRate === 0
        ? Math.round(currentPrice / termMonths)
        : Math.round(currentPrice * monthlyRate * Math.pow(1 + monthlyRate, termMonths) /
            (Math.pow(1 + monthlyRate, termMonths) - 1));

    return {
        base_price: currentPrice,
        current_price: currentPrice,
        anchor_price: marketValue > currentPrice ? marketValue : currentPrice,
        anchor_label: marketValue > currentPrice ? 'Market Value' : 'Original Price',
        savings_amount: marketValue > currentPrice ? marketValue - currentPrice : 0,
        monthly_estimate: monthlyEstimate,
        apr: annualRate,
        term_months: termMonths
    };
}

module.exports = { calculateCroPricing };
