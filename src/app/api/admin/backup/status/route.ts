import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import fs from "fs";
import path from "path";

const BACKUP_META_PATH = path.resolve(process.cwd(), "data/backup-meta.json");

export async function GET() {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  try {
    if (!fs.existsSync(BACKUP_META_PATH)) {
      return NextResponse.json({ lastBackupAt: null, daysSince: null, warning: true });
    }

    const meta = JSON.parse(fs.readFileSync(BACKUP_META_PATH, "utf-8"));
    const lastBackupAt: string | null = meta.lastBackupAt ?? null;

    if (!lastBackupAt) {
      return NextResponse.json({ lastBackupAt: null, daysSince: null, warning: true });
    }

    const daysSince = Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / (1000 * 60 * 60 * 24));
    return NextResponse.json({ lastBackupAt, daysSince, warning: daysSince > 7 });
  } catch {
    return NextResponse.json({ lastBackupAt: null, daysSince: null, warning: true });
  }
}
