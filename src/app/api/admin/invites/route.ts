import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

export async function GET() {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: "desc" },
    include: { association: { select: { name: true } } },
  });
  return NextResponse.json(invites);
}

export async function POST(req: NextRequest) {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const { email, role, associationId } = await req.json();
  if (!email || !role || !associationId) {
    return NextResponse.json({ error: "Sähköposti, rooli ja organisaatio vaaditaan" }, { status: 400 });
  }

  const existing = await prisma.invite.findUnique({ where: { email } });
  if (existing && !existing.usedAt && existing.expiresAt > new Date()) {
    return NextResponse.json({ error: "Tälle sähköpostille on jo voimassa oleva kutsu" }, { status: 409 });
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invite = existing
    ? await prisma.invite.update({
        where: { email },
        data: { role, associationId, invitedById: result.user.id, expiresAt, usedAt: null },
      })
    : await prisma.invite.create({
        data: { email, role, associationId, invitedById: result.user.id, expiresAt },
      });

  logAction(result.user.id, result.user.name ?? result.user.email ?? "Tuntematon", "CREATE", "Invite", invite.id, `Kutsu: ${email} (rooli: ${role})`);
  return NextResponse.json(invite, { status: 201 });
}
