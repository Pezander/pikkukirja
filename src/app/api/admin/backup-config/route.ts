import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { readBackupConfig, writeBackupConfig } from "@/lib/backup-config";
import { logAction } from "@/lib/audit";

export async function GET() {
  const result = await requireAdmin();
  if (result instanceof Response) return result;
  return NextResponse.json(readBackupConfig());
}

export async function PUT(req: NextRequest) {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const { enabled, backupDir, keepLast } = await req.json();
  const current = readBackupConfig();
  const updated = {
    ...current,
    enabled: Boolean(enabled),
    backupDir: backupDir ?? current.backupDir,
    keepLast: Math.max(1, Math.min(100, parseInt(keepLast) || current.keepLast)),
  };
  writeBackupConfig(updated);
  logAction(result.user.id, result.user.name ?? result.user.email ?? "Tuntematon", "UPDATE", "BackupConfig", "backup", `Varmuuskopiointi: ${updated.enabled ? "käytössä" : "pois käytöstä"}, hakemisto: ${updated.backupDir}`);
  return NextResponse.json(updated);
}
