// File-based I/O for node scripts run by the job shells.
// Node 24.21.0 intermittently crashed in fs.readFileSync(0) when stdin was a pipe, and the truncated
// output of `node ... | jq . >file` pipelines got published. Scripts should be run with
// --input <file> --output <file>; stdin/stdout remain supported (stdin is read as a stream).
const fs = require('fs');
const path = require('path');

// split --input/--output (or --input=/--output=) from the script's own arguments.
function parseIoArgs(argv = process.argv.slice(2)) {
    const io = { input: undefined, output: undefined, args: [] };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const match = /^--(input|output)(?:=(.*))?$/.exec(arg);
        if (!match) {
            io.args.push(arg);
            continue;
        }
        const value = (match[2] !== undefined) ? match[2] : argv[++i];
        if (!value) throw new Error(`--${match[1]} requires a file path`);
        io[match[1]] = value;
    }
    return io;
}

async function readText(file) {
    if (file) return fs.promises.readFile(file, 'utf8');
    process.stdin.setEncoding('utf8');
    let text = '';
    for await (const chunk of process.stdin) text += chunk;
    return text;
}

async function readJson(file) {
    const text = await readText(file);
    try {
        return JSON.parse(text);
    } catch (err) {
        throw new Error(`invalid JSON from ${file || 'stdin'} (${text.length} chars): ${err.message}`);
    }
}

// files are written to a temp name and renamed, so readers never see a partial file.
async function writeText(text, file) {
    if (!file) {
        await new Promise((resolve, reject) => process.stdout.write(text, err => (err ? reject(err) : resolve())));
        return;
    }
    const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp.${process.pid}`);
    try {
        await fs.promises.writeFile(tmp, text, 'utf8');
        await fs.promises.rename(tmp, file);
    } catch (err) {
        await fs.promises.rm(tmp, { force: true });
        throw err;
    }
}

// files are pretty printed (same layout as `jq .`); stdout keeps the historical single-line form.
async function writeJson(data, file) {
    const text = file ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await writeText(text + '\n', file);
}

function runMain(main) {
    Promise.resolve().then(main).catch(err => {
        console.error((err && err.stack) ? err.stack : err);
        process.exitCode = 1;
    });
}

module.exports = { parseIoArgs, readText, readJson, writeText, writeJson, runMain };
