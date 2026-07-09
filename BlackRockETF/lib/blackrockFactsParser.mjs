function normalizeText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function parseNumeric(text) {
  if (!text) return null;
  const match = text.match(/[-+]?[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?/);
  return match ? Number(match[0].replace(/,/g, '')) : null;
}

function parsePercent(text) {
  if (!text) return null;
  if (/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(text)) return null;
  const hasPercent = /%/.test(text);
  const raw = text.replace(/%/g, '').trim();
  const value = parseNumeric(raw);
  if (value === null) return null;
  if (hasPercent) return Number((value / 100).toFixed(6));
  if (value < 1) return Number(value.toFixed(6));
  return null;
}

function extractFundFactsFromText(text, { ticker, pageTitle } = {}) {
  const normalized = normalizeText(text);
  const pageTitleText = normalizeText(pageTitle || '');
  const facts = {
    ticker,
    source: 'BlackRock'
  };

  const titleMatch = pageTitleText.match(/(.+?)\s*\|\s*([A-Z0-9.-]+)/i);
  if (titleMatch && titleMatch[1]) {
    facts.fundName = titleMatch[1].trim();
  }

  const navLabelIndex = normalized.indexOf('NAV as of');
  if (navLabelIndex >= 0) {
    const navSnippet = normalized.slice(navLabelIndex, navLabelIndex + 200);
    const dollarNavMatch = navSnippet.match(/\$([0-9,]+(?:\.\d+)?)/);
    if (dollarNavMatch) {
      facts.nav = Number(dollarNavMatch[1].replace(/,/g, ''));
    } else {
      const navMatch = navSnippet.match(/([0-9,]+(?:\.\d+)?)(?![^\s]*%)/);
      if (navMatch) {
        facts.nav = Number(navMatch[1].replace(/,/g, ''));
      }
    }
  }

  const expenseMatch = normalized.match(/Expense Ratio[^\n]*?([0-9,]+(?:\.\d+)?)%/i);
  if (expenseMatch) {
    facts.expenseRatio = parsePercent(`${expenseMatch[1]}%`);
  }

  const couponMatch = normalized.match(/Weighted Avg(?:erage)? Coupon[^\n]*?([0-9,]+(?:\.\d+)?)(?:\s|%|$)/i);
  if (couponMatch) {
    facts.weightedAverageCoupon = parseNumeric(couponMatch[1]);
  }

  const durationMatch = normalized.match(/(?:Effective\s+)?Duration[^\n]*?([0-9,]+(?:\.\d+)?)(?:\s*yrs?)?/i);
  if (durationMatch) {
    facts.durationYears = parseNumeric(durationMatch[1]);
  }

  const ytmMatch = normalized.match(/(?:Weighted Avg YTM|Average Yield to Maturity)[^\n]*?([0-9,]+(?:\.\d+)?)(?:%|\s|$)/i);
  if (ytmMatch) {
    facts.yieldToWorst = parsePercent(`${ytmMatch[1]}%`);
  }

  const maturityMatch = normalized.match(/Weighted Avg(?:erage)? Maturity[^\n]*?([0-9,]+(?:\.\d+)?)(?:\s*yrs?)?/i);
  if (maturityMatch) {
    facts.maturityYears = parseNumeric(maturityMatch[1]);
  }

  const trailingYieldMatch = normalized.match(/12m Trailing Yield[^\n]*?([0-9,]+(?:\.\d+)?)%/i);
  if (trailingYieldMatch) {
    facts.twelveMonTrlYield = parsePercent(`${trailingYieldMatch[1]}%`);
  }

  const aumMatch = normalized.match(/(?:Assets Under Management|Total Net Assets|Net Assets|AUM)[^\n]*?\$?([0-9,]+(?:\.\d+)?)(?:\s*[BM])?/i);
  if (aumMatch) {
    facts.aum = Number(aumMatch[1].replace(/,/g, ''));
  }

  return facts;
}

export { extractFundFactsFromText };
