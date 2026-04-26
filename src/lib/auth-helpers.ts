import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
}

/** Returns the session user or null if not authenticated. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = session.user as SessionUser;
  // Session callback zeros these out when the underlying DB user is gone.
  if (!user.id || !user.role) return null;
  return user;
}

/** Returns 401 Response if not authenticated, otherwise null. */
export async function requireAuth(): Promise<{ user: SessionUser } | Response> {
  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Kirjautuminen vaaditaan" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return { user };
}

/** Returns 403 Response if not admin, otherwise null. */
export async function requireAdmin(): Promise<{ user: SessionUser } | Response> {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  if (result.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Ei oikeuksia" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return result;
}

/** Returns 403 if the user has no access to the given association. Admins always pass. */
export async function requireAssociationAccess(
  associationId: string
): Promise<{ user: SessionUser } | Response> {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;
  if (user.role === "admin") return result;
  const access = await prisma.associationAccess.findUnique({
    where: { userId_associationId: { userId: user.id, associationId } },
  });
  if (!access) {
    return new Response(JSON.stringify({ error: "Ei oikeuksia tähän organisaatioon" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return result;
}

/** requireAssociationAccess + viewer check. */
export async function requireAssociationEditor(
  associationId: string
): Promise<{ user: SessionUser } | Response> {
  const result = await requireAssociationAccess(associationId);
  if (result instanceof Response) return result;
  if (result.user.role === "viewer") {
    return new Response(JSON.stringify({ error: "Vain luku -käyttäjällä ei ole muokkausoikeuksia" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return result;
}

/** Returns 403 Response if the user is a viewer (read-only role). */
export async function requireEditor(): Promise<{ user: SessionUser } | Response> {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  if (result.user.role === "viewer") {
    return new Response(JSON.stringify({ error: "Vain luku -käyttäjällä ei ole muokkausoikeuksia" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return result;
}
