import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const hybridStateDir = fileURLToPath(new URL('./history/hybrid-control/', import.meta.url));

export async function selectHybridTickers(tickers, stateDir = hybridStateDir) {
  const attemptsDir = join(stateDir, 'tickers');
  await mkdir(attemptsDir, { recursive: true });
  const ages = await Promise.all([...new Set(tickers)].map(async ticker => {
    if (!/^[A-Z0-9.-]+$/.test(ticker)) throw new Error(`Invalid ticker: ${ticker}`);
    try {
      return { ticker, age: (await stat(join(attemptsDir, ticker))).mtimeMs };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { ticker, age: 0 };
    }
  }));
  const selected = ages.sort((a, b) => a.age - b.age || a.ticker.localeCompare(b.ticker)).slice(0, 4).map(row => row.ticker);
  for (const ticker of selected) await writeFile(join(attemptsDir, ticker), new Date().toISOString());
  return selected;
}

export async function guardedHybridRun(collect, { stateDir = hybridStateDir, now = Date.now } = {}) {
  await mkdir(stateDir, { recursive: true });
  const lock = join(stateDir, 'lock');
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Vanguard hybrid run already locked: ${lock}`);
    throw error;
  }
  let started = false;
  try {
    let last = 0;
    try {
      last = Number(await readFile(join(stateDir, 'last-attempt'), 'utf8'));
      if (!Number.isFinite(last)) throw new Error('Invalid Vanguard hybrid last-attempt timestamp');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const remaining = 900000 - (now() - last);
    if (remaining > 0) throw new Error(`Vanguard hybrid cooldown: wait ${Math.ceil(remaining / 1000)} seconds (15 minutes between runs)`);
    await writeFile(join(stateDir, 'last-attempt'), String(now()));
    started = true;
    return await collect();
  } finally {
    // Count from completion too, including failed provider attempts.
    try {
      if (started) await writeFile(join(stateDir, 'last-attempt'), String(now()));
    } finally {
      await rm(lock, { recursive: true });
    }
  }
}
