import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSmtpConfigured, createTransport, SMTP_FROM } from "@/lib/smtp";
import { escapeHtml } from "@/lib/utils";
import { isRateLimited, recordFailure } from "@/lib/rate-limiter";
import crypto from "crypto";

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Per-IP limit first — protects SMTP quota even if the attacker varies emails.
  const ipRl = isRateLimited(`reset-ip:${ip}`);
  if (ipRl.limited) {
    return NextResponse.json({ ok: true }); // Silent — don't reveal the limit
  }
  recordFailure(`reset-ip:${ip}`);

  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ ok: true }); // Don't reveal anything
  }

  // Rate-limit by email regardless of whether the account exists
  const rl = isRateLimited(`reset:${email}`);
  if (rl.limited) {
    return NextResponse.json({ ok: true }); // Don't reveal the limit
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return 200 to avoid leaking whether email exists
  if (!user) {
    recordFailure(`reset:${email}`);
    return NextResponse.json({ ok: true });
  }

  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "SMTP ei ole konfiguroitu. Ota yhteyttä järjestelmänvalvojaan." },
      { status: 503 }
    );
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: tokenHash, resetTokenExpiry: expiry },
  });

  // Build reset URL from a trusted env var — never from request headers, which are attacker-controlled
  const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? process.env.AUTH_URL;
  if (!appUrl) {
    return NextResponse.json(
      { error: "APP_URL ei ole konfiguroitu. Ota yhteyttä järjestelmänvalvojaan." },
      { status: 503 }
    );
  }
  const resetUrl = `${appUrl.replace(/\/$/, "")}/reset-password?token=${token}`;

  const transport = createTransport();
  await transport.sendMail({
    from: SMTP_FROM(),
    to: user.email,
    subject: "Salasanan palautus — Kirjanpito",
    html: `
      <p>Hyvä ${escapeHtml(user.name)},</p>
      <p>olet pyytänyt salasanan palautusta. Käytä alla olevaa linkkiä asettaaksesi uuden salasanan:</p>
      <p><a href="${escapeHtml(resetUrl)}" style="color:#2563eb">${escapeHtml(resetUrl)}</a></p>
      <p>Linkki on voimassa 1 tunnin.</p>
      <p>Jos et pyytänyt salasanan palautusta, voit jättää tämän viestin huomiotta.</p>
      <p style="color:#555">Ystävällisin terveisin,<br>Kirjanpito-järjestelmä</p>
    `,
  });

  return NextResponse.json({ ok: true });
}
