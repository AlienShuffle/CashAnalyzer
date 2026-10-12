const fundamentalLabels = [
  ["Average duration", "durationYears", false, 2],
  ["Yield to maturity", "yieldToMaturity", true, 4],
  ["Yield to worst", "yieldToWorst", true, 4],
  ["Average effective maturity", "maturityYears", false, 2],
  ["Average coupon", "weightedAverageCoupon", true, 5]
];

export function parsePercent(text) {
  const match = (text || "").match(/^\s*(\d+(?:\.\d+)?)\s*%\s*$/);
  return match ? Number.parseFloat(match[1]) / 100 : null;
}

export function parseFundamentals(text) {
  const normalized = (text || "")
    .replace(/\s+/g, " ")
    .replace(
      /\b(Yield to maturity|Yield to worst|Average duration|Average effective maturity|Average coupon)(?=\s|[-+0-9.]|$)/gi,
      "\n$1"
    )
    .trim();
  const lines = normalized.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const values = {};
  const missing = [];

  for (const [label, key, isPercent, precision] of fundamentalLabels) {
    const line = lines.find(candidate => candidate.toLowerCase().includes(label.toLowerCase()));
    if (!line) {
      missing.push(label);
      continue;
    }

    const valueStart = line.toLowerCase().indexOf(label.toLowerCase()) + label.length;
    const match = line.slice(valueStart).match(/[-+]?\d*\.?\d+/);
    if (!match) {
      missing.push(label);
      continue;
    }

    const value = Number.parseFloat(match[0]) / (isPercent ? 100 : 1);
    if (!Number.isFinite(value)) {
      missing.push(label);
      continue;
    }
    values[key] = Number(value.toFixed(precision));
  }

  return { values, missing };
}
