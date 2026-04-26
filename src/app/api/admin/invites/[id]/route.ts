import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const { id } = await params;
  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite) return NextResponse.json({ error: "Kutsua ei löydy" }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: "Käytettyä kutsua ei voi peruuttaa" }, { status: 400 });

  await prisma.invite.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
