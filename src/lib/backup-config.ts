import fs from "fs";
import path from "path";
import crypto from "crypto";

const CONFIG_PATH = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "backup-config.json");

export interface BackupConfig {
  enabled: boolean;
  key: string;
  backupDir: string;
  keepLast: number;
}

export function readBackupConfig(): BackupConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {
      enabled: false,
      key: crypto.randomBytes(24).toString("hex"),
      backupDir: "data/backups",
      keepLast: 7,
    };
  }
}

export function writeBackupConfig(config: BackupConfig) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
