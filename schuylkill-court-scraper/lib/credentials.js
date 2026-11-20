import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_CREDENTIALS_FILE = path.join(APP_DIR, "credentials.json");

/**
 * Load portal login from a local JSON file ({ "username": "...", "password": "..." }).
 * The file is git-ignored and must be created by the user from credentials.example.json.
 */
export function loadCredentials(file = process.env.COURT_CREDENTIALS_FILE || DEFAULT_CREDENTIALS_FILE) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Credentials file not found: ${file}\n` +
      `Create it with:\n` +
      `  cp credentials.example.json credentials.json && chmod 600 credentials.json\n` +
      `then edit it to add your portal username and password.`
    );
  }

  const mode = fs.statSync(file).mode & 0o777;
  if (process.platform !== "win32" && (mode & 0o077)) {
    console.warn(`[WARN] ${file} is readable by other users (mode ${mode.toString(8)}). Run: chmod 600 ${file}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`Credentials file ${file} is not valid JSON: ${e.message}`);
  }

  const username = String(parsed.username ?? "").trim();
  const password = String(parsed.password ?? "");
  if (!username || !password) {
    throw new Error(`Credentials file ${file} must contain non-empty "username" and "password".`);
  }
  if (username === "your-portal-username") {
    throw new Error(`Credentials file ${file} still contains the example placeholder values.`);
  }
  return { username, password };
}
