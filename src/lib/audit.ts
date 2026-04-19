import { prisma } from "@/lib/prisma";

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function logAction(
  userId: string,
  userName: string,
  action: string,
  entityType: string,
  entityId: string,
  description: string
): void {
  // Fire-and-forget — don't await, don't block the response
  prisma.auditLog.create({
    data: {
      id: generateId(),
      userId,
      userName,
      action,
      entityType,
      entityId,
      description,
    },
  }).catch(() => {
    // Non-fatal — audit logging must never break the main operation
  });
}
