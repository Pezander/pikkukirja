import fs from "fs";
import path from "path";
import crypto from "crypto";

const CONFIG_PATH = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "cron-config.json");

export interface CronConfig {
  enabled: boolean;
  key: string;
  overdueOnly: boolean;
}

export function readCronConfig(): CronConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return { enabled: false, key: crypto.randomBytes(24).toString("hex"), overdueOnly: true };
  }
}

export function writeCronConfig(config: CronConfig) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
