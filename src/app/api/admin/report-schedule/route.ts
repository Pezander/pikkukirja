import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { readReportScheduleConfig, writeReportScheduleConfig, ReportType } from "@/lib/report-schedule-config";

export async function GET() {
  const result = await requireAdmin();
  if (result instanceof Response) return result;
  return NextResponse.json(readReportScheduleConfig());
}

export async function PUT(req: NextRequest) {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const { enabled, reportType, recipients, associationIds } = await req.json();
  const current = readReportScheduleConfig();

  const updated = {
    ...current,
    enabled: Boolean(enabled),
    reportType: (reportType as ReportType) ?? current.reportType,
    recipients: Array.isArray(recipients)
      ? recipients.filter((r: string) => typeof r === "string" && r.includes("@"))
      : current.recipients,
    associationIds: Array.isArray(associationIds) ? associationIds : current.associationIds,
  };

  writeReportScheduleConfig(updated);
  return NextResponse.json(updated);
}
