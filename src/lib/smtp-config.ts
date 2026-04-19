import fs from "fs";
import path from "path";

const CONFIG_PATH = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "smtp-config.json");

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export function readSmtpConfig(): Partial<SmtpConfig> {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function writeSmtpConfig(config: Partial<SmtpConfig>) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
