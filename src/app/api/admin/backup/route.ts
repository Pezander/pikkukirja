import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import fs from "fs";
import path from "path";

const BACKUP_META_PATH = path.resolve(/* turbopackIgnore: true */ process.cwd(), "data/backup-meta.json");

function writeBackupMeta() {
  try {
    const dir = path.dirname(BACKUP_META_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BACKUP_META_PATH, JSON.stringify({ lastBackupAt: new Date().toISOString() }));
  } catch {
    // Non-fatal
  }
}

export async function GET() {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const relativePath = dbUrl.replace(/^file:/, "");
  const dbPath = path.resolve(/* turbopackIgnore: true */ process.cwd(), relativePath);

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: "Tietokanta ei löydy" }, { status: 404 });
  }

  const data = fs.readFileSync(dbPath);
  const date = new Date().toISOString().split("T")[0];

  writeBackupMeta();

  return new NextResponse(data, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="kirjanpito-backup-${date}.db"`,
    },
  });
}
