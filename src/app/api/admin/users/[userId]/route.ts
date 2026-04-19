import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/audit";
import { validatePassword } from "@/lib/password-policy";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const { userId } = await params;
  const { name, email, role, password } = await req.json();

  if (password) {
    const policyError = validatePassword(password);
    if (policyError) {
      return NextResponse.json({ error: policyError }, { status: 400 });
    }
  }

  const data: Record<string, string> = {};
  if (name) data.name = name;
  if (email) data.email = email;
  if (role) data.role = role;
  if (password) data.passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, role: true },
  });
  logAction(result.user.id, result.user.name ?? result.user.email ?? "Tuntematon", "UPDATE", "User", userId, `Käyttäjä muokattu: ${user.name}`);
  return NextResponse.json(user);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const { userId } = await params;

  // Prevent deleting yourself
  if (userId === result.user.id) {
    return NextResponse.json({ error: "Et voi poistaa omaa tiliäsi" }, { status: 400 });
  }

  const toDelete = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  await prisma.user.delete({ where: { id: userId } });
  logAction(result.user.id, result.user.name ?? result.user.email ?? "Tuntematon", "DELETE", "User", userId, `Käyttäjä poistettu: ${toDelete?.name ?? userId}`);
  return new NextResponse(null, { status: 204 });
}
