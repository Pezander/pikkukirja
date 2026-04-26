import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const result = await requireAdmin();
  if (result instanceof Response) return result;
  const { user } = result;

  const { password } = await req.json();
  if (!password) {
    return NextResponse.json({ error: "Salasana vaaditaan." }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Käyttäjää ei löydy." }, { status: 404 });

  if (!dbUser.passwordHash) return NextResponse.json({ error: "Tili käyttää Google-kirjautumista." }, { status: 400 });
  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) return NextResponse.json({ error: "Väärä salasana." }, { status: 403 });

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null, backupCodes: "[]" },
  });

  return NextResponse.json({ ok: true });
}
