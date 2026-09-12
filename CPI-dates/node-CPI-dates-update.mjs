import { fetchCpiDates } from "../lib/cpiDatesUtils.mjs";

console.log(JSON.stringify(await fetchCpiDates()));

