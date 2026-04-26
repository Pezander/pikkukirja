import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// GET — returns a structured JSON export of all personal data stored for the current user.
export async function GET() {
  const result = await requireAuth();
  if (result instanceof Response) return result;

  const user = await prisma.user.findUnique({
    where: { id: result.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      authProvider: true,
      createdAt: true,
      updatedAt: true,
      totpEnabled: true,
      accesses: {
        include: { association: { select: { id: true, name: true } } },
      },
      loginEvents: {
        orderBy: { timestamp: "desc" },
        take: 200,
        select: { provider: true, ipAddress: true, userAgent: true, timestamp: true },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const auditEntries = await prisma.auditLog.findMany({
    where: { userId: result.user.id },
    orderBy: { timestamp: "desc" },
    take: 500,
    select: { timestamp: true, action: true, entityType: true, entityId: true, description: true },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      authProvider: user.authProvider,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      totpEnabled: user.totpEnabled,
    },
    associationAccess: user.accesses.map((a) => ({
      associationId: a.associationId,
      associationName: a.association.name,
    })),
    loginHistory: user.loginEvents,
    auditLog: auditEntries,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="gdpr-export-${user.id}.json"`,
    },
  });
}
