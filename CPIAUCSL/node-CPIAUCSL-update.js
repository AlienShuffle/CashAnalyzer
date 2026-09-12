import {
    roundToFixed
} from "../lib/utils.mjs";
import { fetchFredCpiMonths } from "../lib/fredCpiUtils.mjs";

const series = "CPIAUCSL";
const months = await fetchFredCpiMonths(series, { startDateString: "1913-01-01" });

console.log(`date,${series}`);
for (let i = 0; i < months.length; i++) {
    const r = months[i];
    console.log(`${r.fullDate},${roundToFixed(r.CPI, 3)}`);
}
