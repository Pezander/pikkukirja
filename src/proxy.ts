import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { isRateLimited, recordFailure } from "@/lib/rate-limiter";

const API_IP_MAX_REQUESTS = 120;
const API_IP_WINDOW_MS = 60 * 1000;

function getClientIp(req: { headers: Headers }): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Blunt, IP-based throttle across all API routes — protects against scripted abuse
  // regardless of auth state. Auth-sensitive endpoints (login, 2FA, reset) layer their
  // own tighter, key-specific limits on top of this via rate-limiter.ts.
  if (pathname.startsWith("/api")) {
    const ip = getClientIp(req);
    const key = `api-ip:${ip}`;
    const rl = isRateLimited(key, API_IP_MAX_REQUESTS, API_IP_WINDOW_MS);
    if (rl.limited) {
      return NextResponse.json(
        { error: "Liian monta pyyntöä. Yritä hetken kuluttua uudelleen." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }
    recordFailure(key, API_IP_WINDOW_MS);
  }

  // Always allow public auth pages and next-auth API routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes
  const role = (req.auth?.user as { role?: string })?.role;
  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
