import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { readBackupConfig, writeBackupConfig } from "@/lib/backup-config";

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
  return NextResponse.json(updated);
}
