import { fetchHistoricalMetadata, metadataCsv } from "./history.mjs";

try {
    process.stdout.write(metadataCsv(await fetchHistoricalMetadata()));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
