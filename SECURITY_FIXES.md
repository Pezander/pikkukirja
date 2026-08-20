# Security review — proposed fixes

**Audience:** Sonnet 5.0 (implementer). **Reviewer:** Fable 5. **Date:** 2026-07-03.

This document lists concrete, ready-to-implement fixes from a security pass over the
Pikkukirja codebase (Next.js App Router + Prisma/SQLite, NextAuth v5).

## How to use this document

Work top-down: **P1 first, then P2, then P3.** Each item is self-contained with the
target file, the problem, and the intended change. After each fix:

1. Make the smallest change that resolves the issue — do not refactor surrounding code.
2. Run `npm run build` (or `npx tsc --noEmit`) to confirm no type breakage.
3. For rate-limit / auth changes, re-read the call sites listed so you don't break a caller.
4. Do **not** weaken any existing check while adding a new one.

## What is already good (do not "fix" these)

- Authorization is applied consistently: every `/api` route calls `requireAuth` /
  `requireAdmin` / `requireAssociationAccess` / `requireAssociationEditor`, except the
  three intentionally public auth routes (`request-reset`, `reset-password`,
  `[...nextauth]`) and the token-guarded `cron/*` and `admin/backup` routes.
- Association-scoped queries consistently filter by `associationId` (and `fiscalYearId`),
  so there is no obvious IDOR — keep this pattern in any new fix.
- Attachment upload validates magic bytes (`detectMimeFromBytes`), caps size, and stores
  files under DB-generated IDs (no path traversal from `originalName`). Leave as is.
- Password reset uses hashed, 1-hour, single-use tokens and does not leak account
  existence. HTML in outbound email is escaped via `escapeHtml`. Reset URL is built from
  a trusted env var, not request headers. Good.
- Security headers + CSP are set in `next.config.ts`. TOTP secret encryption (AES-256-GCM)
  and constant-ish auth error handling are present.

---

## P1 — Fix now

### P1-1. Vulnerable dependencies (`npm audit`: 1 high, 7 moderate, 1 low)

**Where:** `package.json` / `package-lock.json`.

`npm audit --omit=dev` currently reports 9 advisories. The notable ones:

| Package | Severity | Issue |
|---|---|---|
| `hono` (via `@prisma/dev`) | high | path traversal / CORS wildcard-with-credentials |
| `postcss` (via `next`) | moderate | XSS via unescaped `</style>` |
| `qs` | moderate | DoS in `qs.stringify` |
| `js-yaml` | moderate | quadratic-complexity DoS |
| `@babel/core` | (low/mod) | arbitrary file read via sourceMappingURL |

**Fix:**
1. Run `npm audit fix` (non-breaking) first and commit the lockfile change.
2. Re-run `npm audit`. For anything left that only pulls in through `@prisma/dev` /
   `prisma` dev tooling (the `hono` chain), confirm it is a **devDependency / build-time**
   path and not shipped to the running server. If it is dev-only, record that in the PR
   description rather than force-upgrading Prisma (a major bump — do **not** run
   `npm audit fix --force` without checking the Prisma changelog).
3. Do **not** downgrade `next` (the audit's "fix" suggests `next@9` — ignore that).

**Acceptance:** `npm audit --omit=dev` shows no **high** advisories reachable at runtime;
remaining items are documented as dev-only.

---

### P1-2. CSV formula injection in member export

**Where:** `src/app/api/associations/[id]/members/export/route.ts`.

`csvEscape` quotes and doubles `"`, but does not neutralize spreadsheet formula triggers.
A member whose name (or notes, city, etc.) begins with `=`, `+`, `-`, `@`, tab, or CR —
e.g. `=HYPERLINK("http://evil","click")` or `=cmd|'/c calc'!A1` — executes when the
exported `jasenet.csv` is opened in Excel/LibreOffice. Member fields are attacker-supplied
via the members UI and the CSV **import** endpoint, so this is stored → exported injection.

**Fix:** prefix any cell whose first character is a formula trigger with a single quote (or
a leading `'`/tab-guard) before quoting. Update `csvEscape`:

```ts
function csvEscape(v: string | null | undefined) {
  let s = v ?? "";
  // Neutralize spreadsheet formula injection (=, +, -, @, and leading control chars)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
```

Apply the **same** guard to any other CSV/TSV export you find (search for
`text/csv` and `Content-Disposition.*\.csv`). At minimum the members export here.

**Acceptance:** exporting a member named `=1+1` yields a cell `"'=1+1"` that renders as
literal text, not a formula.

---

## P2 — Fix soon

### P2-1. IP rate limiting is bypassable via `X-Forwarded-For` spoofing

**Where:** `src/proxy.ts` (`getClientIp`) and
`src/app/api/auth/request-reset/route.ts` (`getClientIp`).

Both take the **first** value of the client-supplied `x-forwarded-for` header as the client
IP. If the app is not behind a proxy that *overwrites* (not appends) this header, a client
can send `X-Forwarded-For: <random>` on each request and get a fresh rate-limit bucket every
time — defeating the global 120/req/min API throttle **and** the password-reset SMTP throttle.

**Fix:**
1. Determine the real deployment topology from `RUNBOOK.md` / hosting. If there is exactly
   one trusted reverse proxy (nginx/Caddy/Vercel), read the client IP from the value that
   proxy sets, and **trust only that hop** — e.g. take the *last* entry appended by your
   proxy, or a platform header you control, rather than the first client-controlled entry.
2. Introduce a single shared helper (e.g. `getClientIp` in a lib) configured by an env var
   such as `TRUSTED_PROXY_COUNT`, and use it in both `proxy.ts` and `request-reset`. Do not
   leave two divergent copies.
3. Document in `RUNBOOK.md` that the reverse proxy **must** overwrite `X-Forwarded-For`.

**Note for implementer:** the login brute-force limiter keys on **email**, not IP, so it is
not affected by this — do not change that. This item is only about the IP-keyed buckets.

**Acceptance:** with a fixed real client IP, varying the `X-Forwarded-For` header does not
reset the throttle.

---

### P2-2. TOTP secret encryption silently degrades to plaintext

**Where:** `src/lib/totp.ts` — `encryptTotpSecret` / `decryptTotpSecret` /
`getEncryptionKey`.

If `TOTP_ENCRYPTION_KEY` is unset, `encryptTotpSecret` returns the secret **in plaintext**
and it is stored that way. This is a deliberate migration convenience, but in production it
means a DB compromise yields working 2FA secrets. Nothing warns the operator.

**Fix:** fail closed in production. When `NODE_ENV === "production"` and no key is
configured, throw at startup / on first use rather than storing plaintext:

```ts
function getEncryptionKey(): Buffer | null {
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TOTP_ENCRYPTION_KEY is required in production");
    }
    return null; // dev/test only
  }
  if (hex.length !== 64) throw new Error("TOTP_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  return Buffer.from(hex, "hex");
}
```

Keep the transparent plaintext-passthrough in `decryptTotpSecret` (for already-migrated
rows), but add a one-time console warning when it reads a non-`v1:` secret in production.
Ensure `TOTP_ENCRYPTION_KEY` is listed in `.env.example` and `RUNBOOK.md`.

**Acceptance:** starting the server in production without `TOTP_ENCRYPTION_KEY` fails loudly;
with it set, new secrets are stored as `v1:...`.

---

### P2-3. Verify Google email is verified before account linking

**Where:** `src/lib/auth.ts` — `signIn` callback (Google branch, lines ~79–115).

The callback links a Google identity to any existing local user, and creates new users,
based purely on matching `user.email`. It does not check Google's `email_verified` claim.
If an attacker could obtain a Google token for an *unverified* address matching a pending
invite / existing account, they could take it over. Google normally only returns verified
emails for the standard flow, so this is defense-in-depth, but it is cheap to add.

**Fix:** in the `signIn` callback, reject when the Google profile's `email_verified` is not
true. With NextAuth v5, read it from the `profile` argument:

```ts
async signIn({ user, account, profile }) {
  if (account?.provider !== "google") return true;
  if (profile && profile.email_verified === false) return false;
  // ...existing logic...
}
```

**Acceptance:** a Google sign-in with `email_verified: false` is rejected.

---

## P3 — Hardening / defense-in-depth (lower priority)

### P3-1. Backup codes hashed with unsalted SHA-256

**Where:** `src/lib/totp.ts` — `hashCode` / `generateBackupCodes` / `verifyBackupCode`.

Backup codes are stored as plain `sha256(code)`. The codes have ~40 bits of entropy so
offline cracking of a stolen DB is non-trivial, but SHA-256 is fast and unsalted (identical
codes across users share a hash). This is lower risk than passwords (which correctly use
bcrypt) but worth aligning.

**Fix (optional):** hash backup codes with bcrypt as well. Because `verifyBackupCode`
currently does an O(1) `indexOf` on the hash, switching to bcrypt means iterating the stored
codes and `bcrypt.compare`-ing each — acceptable for 10 codes. Keep the JSON-array storage
shape. If you judge the effort not worth it, at minimum add a per-deployment salt (HMAC with
a server key) instead of bare SHA-256. Document the decision either way.

### P3-2. Constrain the login `callbackUrl` to same-origin paths

**Where:** `src/app/login/page.tsx` (line ~14, `callbackUrl`), used in `router.push`
(line 45) and `signIn("google", { callbackUrl })` (line 171).

`callbackUrl` comes straight from the query string. NextAuth validates its own redirects to
the same origin, and `router.push` to an absolute external URL is client-side navigation, so
practical open-redirect risk is low — but validate anyway:

```ts
const raw = searchParams.get("callbackUrl") ?? "/";
// Only allow same-origin relative paths
const callbackUrl = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
```

### P3-3. Rate limiter is in-memory (single instance, resets on restart)

**Where:** `src/lib/rate-limiter.ts`.

The `Map`-based store is per-process: it is wiped on restart and **not shared across
instances**. Under a multi-instance / serverless deployment, login brute-force and reset
throttles weaken (each instance has its own counter). For the current single-instance
self-hosted model this is acceptable.

**Fix (only if deployment is/ becomes multi-instance):** back the limiter with a shared store
(e.g. SQLite table or Redis). Otherwise, add a comment documenting the single-instance
assumption and note it in `RUNBOOK.md`. No code change required for single-instance.

### P3-4. Strengthen password policy (optional)

**Where:** `src/lib/password-policy.ts`.

Current policy: ≥8 chars and at least one digit-or-special. Consider raising the minimum to
10–12 and/or checking against a small local list of the most common passwords. Low urgency;
do not block P1/P2 on this.

### P3-5. SMTP password stored in plaintext on disk

**Where:** `src/lib/smtp-config.ts` (`data/smtp-config.json`).

The SMTP password is written to `data/smtp-config.json` in plaintext. For a self-hosted
single-tenant app with filesystem access controls this is a common tradeoff, and the GET
route already masks it in API responses (`hasPass`). If you want parity with TOTP handling,
encrypt the `pass` field at rest with the same AES-256-GCM key mechanism. Otherwise, ensure
`data/` is not web-served and is excluded from backups that leave the host, and document it.
(`data/` is not under `public/`, so it is not served — confirm this stays true.)

### P3-6. Login events don't capture IP / user-agent

**Where:** `src/lib/auth.ts` — `jwt` callback `loginEvent.create` (lines ~128–133).

The `LoginEvent` schema has `ipAddress` and `userAgent` columns and the profile page renders
them, but the create call only stores `provider`. This is a **functional gap**, not a
vulnerability, but it weakens the "login history" security feature (users can't spot a
login from an unknown device/IP). Populate these from request headers if available in the
callback context; if the headers aren't reachable there, record the login event from the
credentials `authorize` path / a route handler that has the `Request`.

---

## Suggested PR breakdown

- **PR 1 (P1):** `npm audit fix` lockfile + CSV export escaping. Small, ship first.
- **PR 2 (P2):** shared trusted-proxy `getClientIp`, TOTP key fail-closed, Google
  `email_verified`.
- **PR 3 (P3):** pick from hardening items as time allows; each is independent.

Each PR: run `npm run build`, and for auth/rate-limit changes do a manual smoke test of
login, password reset, and 2FA enable/disable before merging.
