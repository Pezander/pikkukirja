import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// POST — invalidates all active sessions by stamping the current time.
// The session callback in auth.ts rejects JWTs issued before this timestamp.
export async function POST() {
  const result = await requireAuth();
  if (result instanceof Response) return result;

  await prisma.user.update({
    where: { id: result.user.id },
    data: { sessionsInvalidatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
