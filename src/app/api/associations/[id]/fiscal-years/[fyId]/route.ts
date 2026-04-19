import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/json";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;


  const fy = await prisma.fiscalYear.findFirst({
    where: { id: fyId, associationId: id },
    include: {
      association: true,
      vouchers: {
        orderBy: { number: "asc" },
        include: {
          lines: {
            include: { account: true },
          },
          attachments: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!fy) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return jsonResponse(fy);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const existing = await prisma.fiscalYear.findFirst({
    where: { id: fyId, associationId: id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (body.status !== undefined) data.status = body.status;
  if (body.reportSections !== undefined) data.reportSections = JSON.stringify(body.reportSections);
  const fy = await prisma.fiscalYear.update({ where: { id: fyId }, data });
  return jsonResponse(fy);
}
