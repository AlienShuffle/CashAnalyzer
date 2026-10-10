import { parseIoArgs, readJson, runMain } from "./jsonIO.mjs";
const io = parseIoArgs();

runMain(async () => {
    // read the JSON object.
    const json = await readJson(io.input);
    // return the list of object keys in the top level of the object.
    console.log(Object.keys(json[0]));
});
