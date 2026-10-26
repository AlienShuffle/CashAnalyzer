import { pathToFileURL } from "node:url";
import { syncDailyArchive } from "./lib/daily-archive.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        const options = {};
        for (const arg of process.argv.slice(2)) {
            if (arg === "--archive-only") options.archiveOnly = true;
            else if (arg.startsWith("--published=") && arg.slice(12)) options.published = arg.slice(12);
            else throw new Error(`Unknown publication option: ${arg}`);
        }
        console.log("FedInvest daily archive:", syncDailyArchive(options));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
