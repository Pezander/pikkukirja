import { NextRequest, NextResponse } from "next/server";
import { readBackupConfig } from "@/lib/backup-config";
import fs from "fs";
import path from "path";

const BACKUP_META_PATH = path.resolve(/* turbopackIgnore: true */ process.cwd(), "data/backup-meta.json");

function writeBackupMeta() {
  try {
    fs.mkdirSync(path.dirname(BACKUP_META_PATH), { recursive: true });
    fs.writeFileSync(BACKUP_META_PATH, JSON.stringify({ lastBackupAt: new Date().toISOString() }));
  } catch {
    // Non-fatal
  }
}

export async function GET(req: NextRequest) {
  const config = readBackupConfig();

  if (!config.enabled) {
    return NextResponse.json({ ok: false, message: "Auto-backup disabled." });
  }

  const authHeader = req.headers.get("authorization");
  const key = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!key || key !== config.key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const relativePath = dbUrl.replace(/^file:/, "");
  const dbPath = path.resolve(/* turbopackIgnore: true */ process.cwd(), relativePath);

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: "Tietokanta ei löydy" }, { status: 404 });
  }

  // Resolve backup directory
  const backupDir = path.isAbsolute(config.backupDir)
    ? config.backupDir
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), config.backupDir);

  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
  const filename = `kirjanpito-backup-${timestamp}.db`;
  const destPath = path.join(backupDir, filename);

  fs.copyFileSync(dbPath, destPath);

  // Prune old backups beyond keepLast
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith("kirjanpito-backup-") && f.endsWith(".db"))
    .sort()
    .reverse();

  const toDelete = files.slice(config.keepLast);
  for (const f of toDelete) {
    try { fs.unlinkSync(path.join(backupDir, f)); } catch { /* ignore */ }
  }

  writeBackupMeta();

  return NextResponse.json({ ok: true, file: filename, kept: files.length - toDelete.length, deleted: toDelete.length });
}
