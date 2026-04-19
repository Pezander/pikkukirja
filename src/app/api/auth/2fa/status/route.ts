import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = await requireAdmin();
  if (result instanceof Response) return result;
  const { user } = result;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpEnabled: true },
  });

  return NextResponse.json({ totpEnabled: dbUser?.totpEnabled ?? false });
}
