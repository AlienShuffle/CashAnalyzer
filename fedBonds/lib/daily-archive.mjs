import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const localDaily = fileURLToPath(new URL("../history/daily/", import.meta.url));
export const publishedDaily = path.join(os.homedir(), "cloudflare/public/Treasuries/fedBonds/daily");

export function dailyReportDirectory(cloud) {
    return path.resolve(cloud, "fedBonds/daily") === publishedDaily
        ? localDaily : path.join(cloud, "fedBonds/daily");
}

export function archivedInputPath(file) {
    return typeof file === "string" && file.startsWith(`${publishedDaily}/`)
        ? path.join(localDaily, path.basename(file)) : file;
}

export function retentionCutoff(today = new Date()) {
    if (!(today instanceof Date) || !Number.isFinite(today.getTime())) throw new Error("Invalid retention date");
    const cutoff = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3, 1));
    const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
    cutoff.setUTCDate(Math.min(today.getUTCDate(), lastDay));
    return cutoff.toISOString().slice(0, 10);
}

function snapshotNames(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).filter(entry => {
        const match = /^(\d{4}-\d{2}-\d{2})(?:T\d{4})?-(?:rate|fed(?:Tips|Nominal|Bei)-.+)\.(json|csv)$/.exec(entry.name);
        if (!match) return false;
        if (!entry.isFile() || !Number.isFinite(Date.parse(match[1]))
            || new Date(match[1]).toISOString().slice(0, 10) !== match[1]) {
            throw new Error(`Invalid daily snapshot: ${path.join(directory, entry.name)}`);
        }
        return true;
    }).map(entry => entry.name).sort();
}

export function copyDailyFile(source, destination) {
    const temp = `${destination}.tmp.${process.pid}`;
    try {
        fs.copyFileSync(source, temp);
        if (!fs.readFileSync(source).equals(fs.readFileSync(temp))) throw new Error(`Archive verification failed: ${source}`);
        fs.renameSync(temp, destination);
    } finally {
        fs.rmSync(temp, { force: true });
    }
}

function writeManifests(directory, names) {
    for (const family of ["Tips", "Nominal", "Bei"]) {
        const csv = names.filter(name => name.includes(`-fed${family}-`) && name.endsWith(".csv"));
        const destination = path.join(directory, `fed${family}-manifest.txt`);
        const temp = `${destination}.tmp.${process.pid}`;
        try {
            fs.writeFileSync(temp, csv.length ? `${csv.join("\n")}\n` : "");
            fs.renameSync(temp, destination);
        } finally {
            fs.rmSync(temp, { force: true });
        }
    }
}

export function syncDailyArchive({ published = publishedDaily, archive = localDaily, today = new Date(), archiveOnly = false } = {}) {
    if (path.resolve(published) === path.resolve(archive)) throw new Error("Published and archive directories must differ");
    const cutoff = retentionCutoff(today);
    fs.mkdirSync(archive, { recursive: true });
    fs.mkdirSync(published, { recursive: true });
    const publishedNames = snapshotNames(published);
    for (const name of publishedNames) {
        const destination = path.join(archive, name);
        if (!fs.existsSync(destination)) copyDailyFile(path.join(published, name), destination);
    }
    const names = snapshotNames(archive);
    writeManifests(archive, names);
    if (archiveOnly) return { cutoff, archived: names.length, published: publishedNames.length, removed: 0 };

    const expired = publishedNames.filter(name => name.slice(0, 10) < cutoff);
    // Verify the entire deletion set before removing any published snapshot.
    for (const name of expired) {
        if (!fs.readFileSync(path.join(published, name)).equals(fs.readFileSync(path.join(archive, name)))) {
            throw new Error(`Refusing to prune differing archive copy: ${name}`);
        }
    }
    const recent = names.filter(name => name.slice(0, 10) >= cutoff);
    for (const name of recent) copyDailyFile(path.join(archive, name), path.join(published, name));
    for (const name of expired) fs.unlinkSync(path.join(published, name));
    writeManifests(published, recent);
    return { cutoff, archived: names.length, published: recent.length, removed: expired.length };
}
