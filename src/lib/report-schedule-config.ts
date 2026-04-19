import fs from "fs";
import path from "path";
import crypto from "crypto";

const CONFIG_PATH = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "report-schedule-config.json");

export type ReportType = "income-statement" | "invoice-aging";

export interface ReportScheduleConfig {
  enabled: boolean;
  key: string;
  reportType: ReportType;
  recipients: string[];       // email addresses
  associationIds: string[];   // empty = all associations
}

export function readReportScheduleConfig(): ReportScheduleConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {
      enabled: false,
      key: crypto.randomBytes(24).toString("hex"),
      reportType: "invoice-aging",
      recipients: [],
      associationIds: [],
    };
  }
}

export function writeReportScheduleConfig(config: ReportScheduleConfig) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
