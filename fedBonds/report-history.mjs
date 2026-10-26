// Run the shared pipeline in an isolated tree, then publish only the requested daily snapshot.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { toPublishedRows } from "./node-fedBonds-update.mjs";
import { localDaily, copyDailyFile, syncDailyArchive } from "./lib/daily-archive.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

export function parseOptions(args) {
    const [date, ...flags] = args;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))
        || new Date(date).toISOString().slice(0, 10) !== date) {
        throw new Error("Usage: node fedBonds/report-history.mjs YYYY-MM-DD [--input=<processed JSON>] [--fetch]");
    }
    const options = { date, input: null, fetch: false };
    for (const flag of flags) {
        if (flag === "--fetch") options.fetch = true;
        else if (flag.startsWith("--input=") && flag.slice(8)) options.input = path.resolve(flag.slice(8));
        else throw new Error(`Unknown option: ${flag}`);
    }
    if (options.input && options.fetch) throw new Error("--input and --fetch cannot be combined");
    return options;
}

function validateQuotes(file, date) {
    const records = JSON.parse(fs.readFileSync(file, "utf8"));
    toPublishedRows(records);
    if (records.some(row => row.asOfDate !== date)) throw new Error(`${file} does not contain quotes for ${date}`);
}

export function buildHistoricalReport({ date, input, fetch: forceFetch }) {
    const cloud = path.join(os.homedir(), "cloudflare/public/Treasuries");
    if (!input && !forceFetch) {
        const candidates = [
            path.join(root, `FedInvest/history/${date}-rate.json`),
            path.join(root, `FedInvest/daily/${date}-rate.json`),
            path.join(cloud, `FedInvest/daily/${date}-rate.json`),
            path.join(root, "FedInvest/history/FedInvest-rate-new.json"),
        ];
        input = candidates.find(file => {
            if (!fs.existsSync(file)) return false;
            if (file.endsWith("FedInvest-rate-new.json")) {
                const rows = JSON.parse(fs.readFileSync(file, "utf8"));
                return Array.isArray(rows) && rows.length > 0 && rows.every(row => row.asOfDate === date);
            }
            return true;
        });
    }
    if (input) validateQuotes(input, date);
    const meta = path.join(cloud, "TIPSmeta.csv");
    if (!fs.existsSync(meta)) throw new Error(`Missing published TIPS metadata: ${meta}`);
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), "fedBonds-history-"));
    const repo = path.join(staging, "CashAnalyzer");
    const cwd = path.join(repo, "fedBonds");
    const stagedCloud = path.join(staging, "cloudflare/public/Treasuries");
    const env = { ...process.env, HOME: staging, errFile: path.join(staging, "errors.log"), BOND_DAILY_ONLY: "true" };
    const run = (command, args, options = {}) => execFileSync(command, args, {
        cwd, env, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, ...options,
    });
    try {
        fs.mkdirSync(cwd, { recursive: true });
        fs.mkdirSync(path.join(repo, "FedInvest/history"), { recursive: true });
        fs.mkdirSync(stagedCloud, { recursive: true });
        for (const name of ["bin", "lib"]) fs.symlinkSync(path.join(root, name), path.join(repo, name));
        fs.mkdirSync(path.join(repo, "mktBonds"));
        fs.symlinkSync(path.join(root, "mktBonds/lib"), path.join(repo, "mktBonds/lib"));
        for (const name of fs.readdirSync(path.join(root, "mktBonds")).filter(name => /\.(sh|mjs)$/.test(name))) {
            fs.copyFileSync(path.join(root, "mktBonds", name), path.join(repo, "mktBonds", name));
        }
        for (const name of ["job-fedBonds-update.sh", "collect-fedBonds.sh", "node-fedBonds-update.mjs"]) {
            fs.copyFileSync(path.join(root, "fedBonds", name), path.join(cwd, name));
        }
        fs.copyFileSync(path.join(root, "meta.common.sh"), path.join(repo, "meta.common.sh"));
        fs.copyFileSync(meta, path.join(stagedCloud, "TIPSmeta.csv"));
        const refCpi = path.join(cloud, "REFCPI.csv");
        if (fs.existsSync(refCpi)) {
            env.BOND_REFCPI_FILE = path.join(stagedCloud, "REFCPI.csv");
            fs.copyFileSync(refCpi, env.BOND_REFCPI_FILE);
        }
        const quotes = path.join(repo, "FedInvest/history/FedInvest-rate-new.json");
        if (input) {
            console.log(`Using saved FedInvest quotes: ${input}`);
            fs.copyFileSync(input, quotes);
        } else {
            console.log(`Fetching FedInvest quotes for ${date}`);
            const csv = path.join(staging, "quotes.csv");
            fs.writeFileSync(csv, run("bash", [path.join(root, "FedInvest/collect-FedInvest.sh"), date]));
            run(process.execPath, [path.join(root, "lib/node-FedInvest-update.js"), "--input", csv, "--output", quotes]);
            validateQuotes(quotes, date);
        }
        const output = run("bash", ["./job-fedBonds-update.sh", "-f", "--runWeekends", `--asOfDate=${date}`]);
        process.stdout.write(output);
        if (fs.existsSync(env.errFile)) process.stderr.write(fs.readFileSync(env.errFile, "utf8"));
        const stagedDaily = path.join(stagedCloud, "fedBonds/daily");
        const files = fs.readdirSync(stagedDaily).filter(name => name.startsWith(`${date}-`) && /\.(csv|json)$/.test(name));
        if (files.length !== 66) throw new Error(`Expected 66 daily report files, produced ${files.length}`);
        syncDailyArchive({ published: path.join(cloud, "fedBonds/daily") });
        const daily = localDaily;
        fs.mkdirSync(daily, { recursive: true });
        for (const file of files) copyDailyFile(path.join(stagedDaily, file), path.join(daily, file));
        syncDailyArchive({ published: path.join(cloud, "fedBonds/daily") });
        if (!input) {
            const saved = path.join(cloud, "FedInvest/daily", `${date}-rate.json`);
            fs.mkdirSync(path.dirname(saved), { recursive: true });
            copyDailyFile(quotes, saved);
        }
        console.log(`Archived 66 daily report files for ${date} in ${daily}; only the last three months are published. Latest reports were not changed.`);
    } catch (error) {
        const errors = env.errFile;
        if (fs.existsSync(errors)) process.stderr.write(fs.readFileSync(errors, "utf8"));
        throw error;
    } finally {
        fs.rmSync(staging, { recursive: true, force: true });
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        buildHistoricalReport(parseOptions(process.argv.slice(2)));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
