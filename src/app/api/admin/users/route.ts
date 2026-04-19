import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/audit";
import { validatePassword } from "@/lib/password-policy";

export async function GET() {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      accesses: { select: { associationId: true } },
    },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const { name, email, password, role } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nimi, sähköposti ja salasana vaaditaan" }, { status: 400 });
  }

  const policyError = validatePassword(password);
  if (policyError) {
    return NextResponse.json({ error: policyError }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Sähköposti on jo käytössä" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: role ?? "user" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  logAction(result.user.id, result.user.name ?? result.user.email ?? "Tuntematon", "CREATE", "User", user.id, `Käyttäjä luotu: ${user.name} (${user.email})`);

  return NextResponse.json(user, { status: 201 });
}
