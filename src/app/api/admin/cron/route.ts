import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { readCronConfig, writeCronConfig } from "@/lib/cron-config";

export async function GET() {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const config = readCronConfig();
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const body = await req.json();
  const current = readCronConfig();
  const updated = {
    enabled: body.enabled ?? current.enabled,
    key: current.key, // key is never changed via UI
    overdueOnly: body.overdueOnly ?? current.overdueOnly,
  };
  writeCronConfig(updated);
  return NextResponse.json(updated);
}
