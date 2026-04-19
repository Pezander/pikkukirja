import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { readSmtpConfig, writeSmtpConfig } from "@/lib/smtp-config";
import { isSmtpConfigured } from "@/lib/smtp";

export async function GET() {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const config = readSmtpConfig();
  // Never return the password in plaintext — mask it
  return NextResponse.json({
    host: config.host ?? "",
    port: config.port ?? 587,
    secure: config.secure ?? false,
    user: config.user ?? "",
    hasPass: !!(config.pass),
    from: config.from ?? "",
    configured: isSmtpConfigured(),
    source: (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ? "env" : "file",
  });
}

export async function PUT(req: NextRequest) {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const body = await req.json();
  const { host, port, secure, user, pass, from } = body;

  const current = readSmtpConfig();
  const updated = {
    host: host ?? current.host ?? "",
    port: parseInt(String(port ?? current.port ?? 587)),
    secure: secure ?? current.secure ?? false,
    user: user ?? current.user ?? "",
    pass: pass !== undefined && pass !== "" ? pass : (current.pass ?? ""),
    from: from ?? current.from ?? "",
  };

  writeSmtpConfig(updated);
  return NextResponse.json({ ok: true });
}
