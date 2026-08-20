import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { verifyTotp, generateBackupCodes, decryptTotpSecret } from "@/lib/totp";
import { isRateLimited, recordFailure, clearAttempts } from "@/lib/rate-limiter";

export async function POST(req: NextRequest) {
  const result = await requireAdmin();
  if (result instanceof Response) return result;
  const { user } = result;

  const rl = isRateLimited(`2fa:${user.id}`);
  if (rl.limited) {
    return NextResponse.json({ error: "Liian monta yritystä. Yritä myöhemmin uudelleen." }, { status: 429 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.totpSecret) {
    return NextResponse.json({ error: "Aloita ensin 2FA-asetukset." }, { status: 400 });
  }
  if (dbUser.totpEnabled) {
    return NextResponse.json({ error: "2FA on jo käytössä." }, { status: 400 });
  }

  const { totpCode } = await req.json();
  if (!totpCode || !verifyTotp(decryptTotpSecret(dbUser.totpSecret), totpCode)) {
    recordFailure(`2fa:${user.id}`);
    return NextResponse.json({ error: "Virheellinen koodi." }, { status: 400 });
  }
  clearAttempts(`2fa:${user.id}`);

  const { plain, hashed } = generateBackupCodes();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, backupCodes: JSON.stringify(hashed) },
  });

  return NextResponse.json({ backupCodes: plain });
}
