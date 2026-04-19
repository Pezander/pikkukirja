import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { isSmtpConfigured } from "@/lib/smtp";

export async function GET() {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  return NextResponse.json({ configured: isSmtpConfigured() });
}
