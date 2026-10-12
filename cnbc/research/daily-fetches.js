// compareDailyVsIntraday.js — investigation (read-only, no writes).
// For one symbol, compares CNBC's DAILY-feed close value (midnight-stamped, as used to
// build the long-range history files) against the intraday feeds' close prints:
//   - 1D feed: the 17:05 ET consolidation print
//   - 5D feed: the post-17:00 grid bar (~17:02-17:04)
//   - last continuous bar before 17:00
// Goal: determine which intraday value CNBC's daily close actually equals.
//
// Usage: node scripts/compareDailyVsIntraday.js US10YTIPS

const ET_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});

function parseT(s) {
  const y = +s.slice(0, 4), mo = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
  const h = +s.slice(8, 10) || 0, mi = +s.slice(10, 12) || 0, se = +s.slice(12, 14) || 0;
  let dt = new Date(Date.UTC(y, mo, d, h, mi, se));
  for (let i = 0; i < 2; i++) {
    const p = ET_FMT.formatToParts(dt).reduce((a, x) => ({ ...a, [x.type]: x.value }), {});
    const diff = Date.UTC(y, mo, d, h, mi, se) - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    if (diff === 0) break;
    dt = new Date(dt.getTime() + diff);
  }
  return dt;
}

function etInfo(raw) {
  const f = ET_FMT.format(parseT(raw));
  const m = f.match(/(\d\d)\/(\d\d)\/(\d{4}), (\d\d):(\d\d)/);
  return { day: `${m[3]}-${m[1]}-${m[2]}`, mins: +m[4] * 60 + +m[5], hhmm: `${m[4]}:${m[5]}`, rawHHMMSS: raw.slice(8) };
}

function buildUrl(symbol, timeRange) {
  const params = {
    operationName: 'getQuoteChartData',
    variables: JSON.stringify({ symbol, timeRange }),
    extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: '9e1670c29a10707c417a1efd327d4b2b1d456b77f1426e7e84fb7d399416bb6b' } })
  };
  return 'https://webql-redesign.cnbcfm.com/graphql?' + Object.entries(params).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
}

async function fetchBars(symbol, range) {
  const r = await fetch(buildUrl(symbol, range));
  if (!r.ok) return [];
  const j = await r.json();
  return (j?.data?.chartData?.priceBars || []).map(b => ({ raw: b.tradeTime, close: parseFloat(String(b.close).replace('%', '')), ...etInfo(b.tradeTime) }));
}

// daily close map: midnight-stamped bars -> {day: close}
function dailyMap(bars) {
  const m = {};
  for (const b of bars) if (b.rawHHMMSS === '000000') m[b.day] = b.close;
  return m;
}

// per-day close print from an intraday feed: last bar before the post-17:00 session gap (>20min)
function intradayClose(bars, wantExact1705) {
  const byDay = {};
  for (const b of bars) (byDay[b.day] = byDay[b.day] || []).push(b);
  const out = {};
  for (const day of Object.keys(byDay)) {
    const arr = byDay[day].sort((a, b) => a.mins - b.mins);
    const exact = arr.find(b => b.hhmm === '17:05');
    const post = arr.filter(b => b.mins >= 17 * 60);
    let closePrint = null;
    if (post.length) {
      closePrint = post[0];
      for (let i = 1; i < post.length; i++) { if (post[i].mins - post[i - 1].mins > 20) { closePrint = post[i - 1]; break; } closePrint = post[i]; }
    }
    const lastPre = [...arr].reverse().find(b => b.mins < 17 * 60);
    out[day] = { close: closePrint, exact1705: exact, lastPre };
  }
  return out;
}

// nearest bar to a target ET minute, per day (within 8 min)
function nearestByDay(bars, targetMins) {
  const byDay = {};
  for (const b of bars) (byDay[b.day] = byDay[b.day] || []).push(b);
  const out = {};
  for (const day of Object.keys(byDay)) {
    let best = null;
    for (const b of byDay[day]) {
      const d = Math.abs(b.mins - targetMins);
      if (d <= 8 && (!best || d < Math.abs(best.mins - targetMins))) best = b;
    }
    out[day] = best;
  }
  return out;
}

async function main() {
  const sym = process.argv[2] || 'US10YTIPS';
  const [d1m, d3m, b5d, b1d] = await Promise.all([
    fetchBars(sym, '1M'), fetchBars(sym, '3M'), fetchBars(sym, '5D'), fetchBars(sym, '1D')
  ]);
  console.log(`${sym}  daily-feed bar counts: 1M=${d1m.length}  3M=${d3m.length}   intraday: 5D=${b5d.length}  1D=${b1d.length}`);

  const daily = { ...dailyMap(d3m), ...dailyMap(d1m) }; // 1M (recent) wins
  const ic5 = intradayClose(b5d);
  const ic1 = intradayClose(b1d);
  const at15 = nearestByDay(b5d, 15 * 60);   // 3pm ET
  const at16 = nearestByDay(b5d, 16 * 60);   // 4pm ET

  const days = Object.keys(daily).sort().slice(-12);
  console.log('\nDate        daily    @15:00   @16:00   16:59    17:05    | best match');
  const f = v => v == null ? '  —   ' : v.toFixed(4);
  for (const day of days) {
    const dv = daily[day];
    const v15 = at15[day]?.close, v16 = at16[day]?.close;
    const pre = ic1[day]?.lastPre?.close ?? ic5[day]?.lastPre?.close;
    const v1705 = ic1[day]?.exact1705?.close ?? ic1[day]?.close?.close;
    // which candidate is closest to daily?
    let best = '—';
    if (dv != null) {
      const cands = { '15:00': v15, '16:00': v16, '16:59': pre, '17:05': v1705 };
      let bd = Infinity;
      for (const [k, v] of Object.entries(cands)) if (v != null && Math.abs(v - dv) < bd) { bd = Math.abs(v - dv); best = `${k} (Δ${(dv - v).toFixed(4)})`; }
    }
    console.log(`${day}  ${f(dv)}  ${f(v15)}  ${f(v16)}  ${f(pre)}  ${f(v1705)}  | ${best}`);
  }
  console.log('\nWhich intraday time does CNBC\'s daily close match best? (5D feed for @15/@16; 1D for 17:05)');
}

main().catch(e => { console.error(e); process.exit(1); });