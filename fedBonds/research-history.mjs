import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { buildResearchPlan } from "./lib/research-calendar.mjs";
import { parseResearchOptions } from "./lib/research-options.mjs";
import { dailyReportDirectory } from "./lib/daily-archive.mjs";
import { parseCsvToMatrix } from "../lib/parseCsv.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const digest = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

export function verifyDaily(cloud, date) {
    const directory = dailyReportDirectory(cloud);
    const stems = ["rate"];
    for (const side of ["ask", "bid"]) {
        stems.push(`fedNominal-${side}`, `fedTips-${side}`);
        for (const qualifier of ["", "fwd-"]) stems.push(`fedNominal-grid-${qualifier}${side}`);
        for (const qualifier of ["", "sa-", "sa-decay-", "fwd-", "fwd-sa-", "fwd-sa-decay-"]) {
            stems.push(`fedTips-curve-${qualifier}${side}`, `fedBei-grid-${qualifier}${side}`);
        }
    }
    for (const stem of stems) {
        const json = JSON.parse(fs.readFileSync(path.join(directory, `${date}-${stem}.json`), "utf8"));
        const rows = Array.isArray(json) ? json : json.rows ?? json.points;
        if (!rows?.length || (Array.isArray(json) ? json.some(row => row.asOfDate !== date) : json.asOfDate !== date)) {
            throw new Error(`Empty or incorrectly dated JSON: ${date}-${stem}`);
        }
        const [header, ...csv] = parseCsvToMatrix(fs.readFileSync(path.join(directory, `${date}-${stem}.csv`), "utf8"));
        const column = header.map(value => value.trim()).indexOf("asOfDate");
        const records = csv.filter(row => row.some(value => value.trim()));
        if (column < 0 || records.length !== rows.length || records.some(row => row[column] !== date)) {
            throw new Error(`CSV/JSON mismatch: ${date}-${stem}`);
        }
    }
    return 66;
}

export function runResearch(options) {
    const releases = JSON.parse(fs.readFileSync(path.join(options.cloud, "CPI-dates.json"), "utf8"));
    const plan = buildResearchPlan(releases, options);
    fs.mkdirSync(options.output, { recursive: true });
    fs.writeFileSync(path.join(options.output, "research-plan.json"), JSON.stringify(plan, null, 2));
    const dates = [...new Set(plan.filter(row => row.included).flatMap(row => [row.pre, row.post]))].sort();
    console.log(`Selected ${plan.filter(row => row.included).length} CPI releases, ${dates.length} dates; excluded ${plan.filter(row => row.exclusion).length} episodes.`);
    if (!options.run) {
        console.log(`Plan saved to ${options.output}; use --run to generate reports.`);
        return;
    }
    if (path.resolve(options.cloud) !== path.join(os.homedir(), "cloudflare/public/Treasuries")) {
        throw new Error("Report publication uses HOME/cloudflare/public/Treasuries; --cloud must match that directory for --run");
    }
    const sourceFiles = ["TIPSmeta.csv", "REFCPI.csv"].map(name => path.join(options.cloud, name));
    const codeFiles = ["fedBonds/report-history.mjs", "mktBonds/node-mktTips-update.mjs",
        "mktBonds/node-mktNominals-update.mjs", "mktBonds/node-calc-mktTips-curve.mjs",
        "mktBonds/lib/tips/refCpi.mjs", "mktBonds/job-mktTips-update.sh"].map(name => path.join(root, name));
    const signature = createHash("sha256").update([...sourceFiles, ...codeFiles].map(digest).join("|")).digest("hex");
    const old = fs.existsSync(options.results) ? JSON.parse(fs.readFileSync(options.results, "utf8")) : [];
    const meta = parseCsvToMatrix(fs.readFileSync(sourceFiles[0], "utf8"));
    const cusipColumn = meta[0].map(value => value.trim()).indexOf("cusip");
    const known = new Set(meta.slice(1).map(row => row[cusipColumn]));
    const ref = new Map(parseCsvToMatrix(fs.readFileSync(sourceFiles[1], "utf8")).slice(1).filter(row => row.length >= 6)
        .map(row => [row[0], row[5]]));
    const results = [];
    for (const [index, date] of dates.entries()) {
        const log = path.join(options.output, `${date}.log`);
        let result = { date, status: "failed", signature, log };
        try {
            const horizon = ref.get(date);
            if (!horizon || horizon <= date) {
                result = { ...result, status: "blocked", error: `No future historical CPI horizon: ${horizon ?? "missing"}` };
            } else {
                const previous = old.find(row => row.date === date && row.status === "verified" && row.signature === signature);
                if (!previous) {
                    const fd = fs.openSync(log, "w");
                    try {
                        const child = spawnSync(process.execPath, ["fedBonds/report-history.mjs", date], {
                            cwd: root, stdio: ["ignore", fd, fd], timeout: 600000,
                        });
                        if (child.error) throw child.error;
                        if (child.status !== 0) throw new Error(`Historical report exited ${child.status}; see ${log}`);
                    } finally {
                        fs.closeSync(fd);
                    }
                }
                const quotes = JSON.parse(fs.readFileSync(path.join(options.cloud, `FedInvest/daily/${date}-rate.json`), "utf8"));
                const missing = quotes.filter(row => row.securitytype === "TIPS" && row.maturitydate > horizon
                    && (Number(row.buy) > 0 || Number(row.sell) > 0) && !known.has(row.cusip));
                if (missing.length) throw new Error(`Missing historical TIPS metadata: ${missing.map(row => row.cusip).join(", ")}`);
                result = { ...result, status: "verified", files: verifyDaily(options.cloud, date), horizon, quoteRows: quotes.length };
            }
        } catch (error) {
            result.error = error.message;
        }
        results.push(result);
        fs.writeFileSync(options.results, JSON.stringify(results, null, 2));
        console.log(`${index + 1}/${dates.length} ${date}: ${result.status}${result.error ? ` — ${result.error}` : ""}`);
    }
    const failures = results.filter(row => row.status === "failed");
    console.log(`Verified ${results.filter(row => row.status === "verified").length}; blocked ${results.filter(row => row.status === "blocked").length}; failed ${failures.length}.`);
    if (failures.length) throw new Error(`Research has ${failures.length} failed dates; inspect ${options.results} and rerun to resume.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        runResearch(parseResearchOptions(process.argv.slice(2)));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
