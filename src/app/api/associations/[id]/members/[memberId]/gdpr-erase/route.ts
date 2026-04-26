import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

// POST — anonymises a member's personal data in place.
// Invoices and payment records are preserved for bookkeeping compliance;
// only identifying fields are overwritten. The member record is kept so
// that foreign-key references remain intact.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const existing = await prisma.member.findFirst({
    where: { id: memberId, associationId: id },
    select: { id: true, name: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ERASED = "Poistettu (GDPR)";

  await prisma.member.update({
    where: { id: memberId },
    data: {
      name: ERASED,
      address: "",
      postalCode: "",
      city: "",
      email: "",
      memberNumber: "",
      memberType: "",
      notes: "",
    },
  });

  logAction(
    result.user.id,
    result.user.name ?? result.user.email ?? "Tuntematon",
    "DELETE",
    "Member",
    memberId,
    `GDPR-poisto: jäsenen tiedot anonymisoitu (oli: ${existing.name})`
  );

  return NextResponse.json({ ok: true });
}
