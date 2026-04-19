import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import bcrypt from "bcryptjs";
import { validatePassword } from "@/lib/password-policy";

export async function POST(req: NextRequest) {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Nykyinen ja uusi salasana vaaditaan" }, { status: 400 });
  }
  const policyError = validatePassword(newPassword);
  if (policyError) {
    return NextResponse.json({ error: policyError }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Käyttäjää ei löydy" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Nykyinen salasana on väärä" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
