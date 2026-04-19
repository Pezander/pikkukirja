import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { generateTotpSecret, getTotpUri, encryptTotpSecret } from "@/lib/totp";

export async function POST() {
  const result = await requireAdmin();
  if (result instanceof Response) return result;
  const { user } = result;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { totpEnabled: true } });
  if (dbUser?.totpEnabled) {
    return NextResponse.json({ error: "2FA on jo käytössä." }, { status: 400 });
  }

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: encryptTotpSecret(secret), totpEnabled: false },
  });

  const uri = getTotpUri(secret, user.email!);
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 200 });

  return NextResponse.json({ qrDataUrl, secret, uri });
}
