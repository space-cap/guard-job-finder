import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnv(path = ".env") {
  const envPath = resolve(path);
  if (!existsSync(envPath)) return false;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex < 1) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    const value = unquote(trimmed.slice(equalIndex + 1).trim());

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  return true;
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
