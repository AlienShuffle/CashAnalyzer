import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkedDate } from "./research-calendar.mjs";

export function parseResearchOptions(args) {
    const options = {
        from: "2015-01-01", through: new Date().toISOString().slice(0, 10),
        cloud: path.join(os.homedir(), "cloudflare/public/Treasuries"),
        output: path.resolve("fedBonds/history/research"), results: null, run: false,
    };
    for (const arg of args) {
        if (arg === "--run") options.run = true;
        else {
            const match = /^--(from|through|cloud|output|results)=(.+)$/.exec(arg);
            if (!match) throw new Error(`Unknown research option: ${arg}`);
            options[match[1]] = ["from", "through"].includes(match[1]) ? match[2] : path.resolve(match[2]);
        }
    }
    checkedDate(options.from); checkedDate(options.through);
    if (options.from < "2015-01-01" || options.through < options.from) throw new Error("Research range must start in 2015 or later");
    options.results ??= path.join(options.output, "research-results.json");
    return options;
}

export function readResearchResults(file) {
    const results = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(results)) throw new Error(`Expected research results array: ${file}`);
    for (const row of results) {
        checkedDate(row.date);
        if (!["verified", "failed", "blocked"].includes(row.status)) throw new Error(`Invalid research status: ${row.status}`);
    }
    if (results.some(row => row.status === "failed")) throw new Error("Research has failed dates; resolve them before analysis");
    return results;
}
