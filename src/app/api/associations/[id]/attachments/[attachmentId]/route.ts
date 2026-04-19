import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";
import fs from "fs";
import path from "path";

const ATTACHMENTS_DIR = path.resolve(process.cwd(), "data/attachments");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;

  const attachment = await prisma.voucherAttachment.findFirst({ where: { id: attachmentId, associationId: id } });
  if (!attachment) return NextResponse.json({ error: "Liite ei löydy" }, { status: 404 });

  const filePath = path.join(ATTACHMENTS_DIR, attachmentId);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Tiedosto ei löydy" }, { status: 404 });

  const data = fs.readFileSync(filePath);
  const isInline = attachment.mimeType.startsWith("image/") || attachment.mimeType === "application/pdf";
  return new NextResponse(data, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `${isInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
    },
  });
}

// PATCH — update note or match to a voucher
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const existing = await prisma.voucherAttachment.findFirst({ where: { id: attachmentId, associationId: id } });
  if (!existing) return NextResponse.json({ error: "Liite ei löydy" }, { status: 404 });

  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if ("voucherId" in body) {
    if (body.voucherId) {
      const voucherOk = await prisma.voucher.findFirst({
        where: { id: body.voucherId, fiscalYear: { associationId: id } },
        select: { id: true },
      });
      if (!voucherOk) return NextResponse.json({ error: "Tositetta ei löydy" }, { status: 404 });
    }
    data.voucherId = body.voucherId ?? null;
  }
  if ("note" in body) data.note = body.note;

  const updated = await prisma.voucherAttachment.update({ where: { id: attachmentId }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const existing = await prisma.voucherAttachment.findFirst({ where: { id: attachmentId, associationId: id } });
  if (!existing) return NextResponse.json({ error: "Liite ei löydy" }, { status: 404 });

  await prisma.voucherAttachment.delete({ where: { id: attachmentId } });
  const filePath = path.join(ATTACHMENTS_DIR, attachmentId);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  return new NextResponse(null, { status: 204 });
}
