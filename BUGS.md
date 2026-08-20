# Bug analysis — proposed fixes

**Audience:** Sonnet (implementer). **Reviewer:** Fable 5. **Date:** 2026-07-03.

Bugs found in a correctness pass over Pikkukirja (Next.js App Router + Prisma/SQLite).
Ordered by impact. Each item has the file, the concrete failure, and the intended fix.

**How to work this list:** do B1–B3 first (data-integrity / data-loss). Verify each fix by
exercising the flow (create/close/regenerate), not just a typecheck. Do **not** refactor
surrounding code; make the smallest correct change. Security-flavoured findings (e.g. CSV
formula injection) live in `SECURITY_FIXES.md`, not here.

---

## B1 — Generating invoices for a subset of members deletes everyone else's invoices  🔴

**File:** `src/app/api/associations/[id]/fiscal-years/[fyId]/invoices/route.ts` (POST, line ~97).

The endpoint accepts an optional `memberIds` array to invoice only selected members
(line 50, used to filter `members` at line 86). But the regeneration delete ignores it:

```ts
await prisma.invoice.deleteMany({ where: { fiscalYearId: fyId } }); // deletes ALL invoices
```

So invoicing 3 selected members **wipes every other member's invoice** in that fiscal year,
then recreates only the 3. Combined with the invoice-numbering reset (`seq = 1`), this also
renumbers them. This is silent data loss.

**Fix:** scope the delete to the members being regenerated. When `memberIds` is provided,
only delete invoices for those members:

```ts
await prisma.invoice.deleteMany({
  where: {
    fiscalYearId: fyId,
    ...(memberIds?.length ? { memberId: { in: memberIds } } : {}),
  },
});
```

Also reconsider the invoice-number sequence: when regenerating a subset, `seq` should not
collide with existing invoices. Simplest correct approach — continue numbering from the
current max `invoiceNumber` suffix in the fiscal year rather than resetting to 1. If that's
too large a change, at minimum document that subset regeneration is only safe on an empty
fiscal year and gate the UI accordingly. **Confirm the intended UX with the existing
invoice screen before changing numbering.**

**Acceptance:** generating invoices for a subset leaves other members' invoices (and their
payments) untouched; numbers don't collide.

---

## B2 — Vouchers can be created, edited, and deleted inside a CLOSED fiscal year  🔴

**Files:**
- `src/app/api/associations/[id]/fiscal-years/[fyId]/vouchers/route.ts` (POST)
- `.../vouchers/[voucherId]/route.ts` (PUT, DELETE)

The `close` route builds a closing entry (income/expense → account 240) and `roll-forward`
computes opening balances from the year's vouchers. But nothing prevents adding or editing
vouchers **after** close. Any post-close voucher change silently invalidates the closing
entry and the next year's opening balances — a bookkeeping-integrity bug.

**Fix:** in the voucher POST, PUT, and DELETE handlers, after resolving the fiscal year,
reject writes when `status === "closed"`:

```ts
const fy = await prisma.fiscalYear.findFirst({
  where: { id: fyId, associationId: id },
  select: { id: true, status: true },
});
if (!fy) return NextResponse.json({ error: "Not found" }, { status: 404 });
if (fy.status === "closed") {
  return NextResponse.json(
    { error: "Tilikausi on suljettu. Avaa tilikausi ennen tositteiden muokkausta." },
    { status: 409 }
  );
}
```

(The current POST only selects `{ id: true }` — extend it to include `status`.) Consider
whether you also need a "reopen fiscal year" action so a closed year can be corrected; if so
that's a separate admin-guarded endpoint that deletes the closing voucher and sets status
back to `open`. Note that as a deliberate exception, the **close** route itself must still be
able to create its closing voucher — don't apply the guard there.

**Acceptance:** POST/PUT/DELETE voucher against a closed year returns 409; open years work
as before.

---

## B3 — Voucher numbers assigned by read-max-then-increment (race condition)  🟠

**Files:** all four places that mint a voucher number:
- `vouchers/route.ts` POST — `nextNumber = Number(lastVoucher?.number ?? 0) + 1`
- `close/route.ts`
- `roll-forward/route.ts`
- `invoices/[invoiceId]/payments/route.ts` (auto-voucher)

Each reads the current max `number` and adds 1, outside any atomic guarantee. Two concurrent
requests in the same fiscal year get the **same** number. For a small association this is
rare but real (e.g. two tabs, or the payment auto-voucher racing a manual entry).

**Fix options (pick one, apply consistently):**
1. **Preferred:** add a unique constraint on `(fiscalYearId, number)` in the Prisma schema +
   a migration, then wrap the mint+create in a transaction and retry once on unique-violation.
   This makes duplicates impossible even under races.
2. Lighter: do the max-lookup and the create inside a single `prisma.$transaction`, and add
   the unique index so a race surfaces as an error rather than silent duplication.

Since migrations here are hand-written SQL in `prisma/migrations/`, add the index migration
in the same style. Check for existing duplicate `(fiscalYearId, number)` rows before adding
the constraint (write a quick query) so the migration doesn't fail on existing data.

**Acceptance:** concurrent voucher creation never yields duplicate numbers in one fiscal year.

---

## B4 — Two divergent payment-tracking paths can disagree  🟠

**Files:**
- `.../invoices/[invoiceId]/payments/route.ts` — creates `Payment` rows and recomputes
  `invoice.paidAmount` as the **sum** of payments.
- `.../invoices/[invoiceId]/route.ts` PATCH (lines ~23–35) — "mark paid" sets
  `paidAt` / `paidAmount` **directly**, without creating a `Payment` row.

These two mechanisms track the same fact independently. Marking an invoice paid via PATCH
leaves `Payment` rows empty; later adding a `Payment` recomputes `paidAmount` from the sum
and **overwrites** the manual mark. Conversely, deleting all payments (`DELETE` in the
payments route) resets `paidAt`/`paidAmount`, discarding a manual mark. The invoice's paid
status is therefore not reliable.

**Fix:** make `Payment` rows the single source of truth.
- In the PATCH "mark paid" branch, instead of writing `paidAmount` directly, create a
  `Payment` row for the outstanding balance (or reject and direct callers to the payments
  endpoint). Then derive `paidAmount`/`paidAt` the same way the payments route does.
- Keep one helper (e.g. `recalcInvoicePaid(invoiceId)`) that both routes call after mutating
  payments, so the recompute logic isn't duplicated.

If you'd rather not unify the model right now, at minimum document the invariant and make the
PATCH mark-paid branch create a matching `Payment` so the two never diverge.

**Acceptance:** marking paid, adding a payment, and removing payments all leave
`paidAmount`/`paidAt` consistent with the sum of `Payment` rows.

---

## B5 — Bank CSV amount parser mishandles thousands separators  🟠

**File:** `src/lib/parseBankCsv.ts` — `parseAmount` (line ~27).

```ts
const cleaned = s.trim().replace(/\s/g, "").replace(",", ".");
return parseFloat(cleaned) || 0;
```

- `"1 234,56"` → spaces stripped → `"1234,56"` → `"1234.56"` ✓ (works)
- `"1.234,56"` (dot thousands, comma decimal — common in some exports) → `.replace(",", ".")`
  gives `"1.234.56"` → `parseFloat` → **1.234** ✗ (off by 1000×)
- `.replace(",", ".")` only replaces the **first** comma.

Amounts ≥ 1000 in the dot-thousands format silently import at 1/1000 of their value, which
then feeds payment matching / bookkeeping.

**Fix:** normalize by detecting the decimal separator as the **last** `,` or `.` and treating
everything else as grouping:

```ts
function parseAmount(s: string): number {
  let t = s.trim().replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  const decimalSep = lastComma > lastDot ? "," : (lastDot > -1 ? "." : "");
  if (decimalSep) {
    const groupSep = decimalSep === "," ? "." : ",";
    t = t.split(groupSep).join("");           // remove grouping
    t = t.replace(decimalSep, ".");            // decimal → dot
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}
```

Add a couple of unit tests: `"1.234,56" → 1234.56`, `"1,234.56" → 1234.56`,
`"1 234,56" → 1234.56`, `"-45,00" → -45`, `"0,00" → 0`.

**Acceptance:** the four cases above parse correctly.

---

## B6 — `validateViitenumero` rejects valid references with leading zeros  🟡

**File:** `src/lib/viitenumero.ts` — `validateViitenumero` (line ~21).

The validator round-trips through `parseInt(base, 10)`, which drops leading zeros:
a reference like `"01234"` has base `"0123"`; `parseInt("0123")` → `123`;
`generateViitenumero(123)` → `"123" + check`, which never equals `"0123" + check`. Valid
Finnish reference numbers that start with zero are reported invalid. The check on line 26 is
also convoluted and redundant.

**Fix:** validate by recomputing the check digit over the **string** base without integer
round-tripping. Refactor `generateViitenumero` to accept the digit string, or add an internal
`checkDigitFor(digits: string)` and compare:

```ts
export function validateViitenumero(ref: string): boolean {
  const digits = ref.replace(/\D/g, "");
  if (digits.length < 4 || digits.length > 20) return false;
  const base = digits.slice(0, -1);
  const check = Number(digits.slice(-1));
  return checkDigit(base) === check; // checkDigit works on the string, no parseInt
}
```

Note `generateViitenumero(base: number)` in invoice/member creation can also lose leading
zeros, but bases there come from sequential counters so it's latent. Prefer making the core
operate on digit strings.

**Acceptance:** `validateViitenumero("01234...")` with a correct check digit returns true;
existing valid refs still validate.

---

## B7 — VAT period bucketing uses local-time bounds against UTC voucher dates  🟡

**File:** `src/app/api/associations/[id]/fiscal-years/[fyId]/vat/route.ts`
(`quarterBounds` / `monthBounds`, and the comparison at line ~57).

Period bounds are built with `new Date(year, month, 1)` (local timezone), while voucher
dates are stored as UTC (created via `new Date(dateString)` and UTC literals elsewhere). For
a Finland user (UTC+2/+3), a voucher dated on the first/last day of a quarter can fall on the
wrong side of the boundary, moving its VAT into the adjacent period.

**Fix:** compare in a single consistent zone. Simplest: build bounds in UTC and compare on
the date portion only (ignore time). E.g. derive `YYYY-MM` / `YYYY-Qn` from the voucher's
date string and match against the period key, rather than doing `Date` `<`/`>` comparisons
across timezones. Keep the same period-count logic (12 months / 4 quarters).

**Acceptance:** a voucher dated exactly on a quarter boundary lands in the expected quarter
regardless of server timezone.

---

## B8 — Editing an account's number can silently break close / roll-forward / payment vouchers  🟡

**File:** `src/app/api/associations/[id]/accounts/[accountId]/route.ts` (PATCH).

`close` looks up account `"240"`, `roll-forward` looks up `"222"`/`"240"`, and the payment
auto-voucher defaults to `"100"`/`"310"` — all by `number`. The account PATCH lets an editor
change any account's `number` with no uniqueness check and no protection for these
system-critical numbers. Renumbering 240 makes close fail ("Tiliä 240 ei löydy"); duplicating
a number makes `findFirst` ambiguous.

**Fix:**
- Enforce uniqueness of `number` within an association (unique constraint on
  `(associationId, number)` + migration, plus a friendly 409 in the handler on violation).
- Optionally, guard the well-known system numbers (100, 222, 240, 310) from renumbering, or
  surface a warning. At minimum, prevent creating a **duplicate** number.

**Acceptance:** cannot set an account number that collides with another account in the same
association; close/roll-forward continue to resolve their system accounts.

---

## B9 — Roll-forward silently drops retained earnings if account 222 is missing  🟡

**File:** `.../roll-forward/route.ts` (lines ~55, ~90).

If account `"222"` doesn't exist, `account222` is null and the block that writes the merged
`222 + 240` retained-earnings opening line is skipped entirely — so the new year's opening
balance is unbalanced (assets/liabilities carried but equity dropped), with no error.

**Fix:** if `account222` (or `240`) is missing when there is retained earnings to carry,
return a clear 400 ("Tiliä 222 ei löydy — avaustasetta ei voi muodostaa") instead of
producing a silently unbalanced opening voucher. Mirror the existing "Tiliä 240 ei löydy"
check in `close`.

**Acceptance:** roll-forward either produces a balanced opening voucher or fails loudly with
a clear message; it never writes an unbalanced avaustase.

---

## B10 — Minor robustness issues (batch as one small PR)

- **`splitCsv` doesn't handle escaped quotes** (`parseBankCsv.ts` line ~32): a `""` inside a
  quoted field toggles `inQuotes` twice and drops the literal quote. Match the more correct
  logic already used in `members/import/route.ts` (`if (inQuotes && line[i+1] === '"')`).
- **CAMT amount sign relies solely on `CdtDbtInd`** (`parseBankCamt.ts` line ~41): fine for
  standard files, but if `CdtDbtInd` is missing the amount is forced positive. Consider
  defaulting unknown indicators to skip rather than assume credit.
- **Date construction mixes UTC literals and local getters** (`finnish-barcode.ts` due-date,
  `close`/`roll-forward` date literals). Low risk for Finland but standardize on UTC date
  handling to avoid off-by-one-day near midnight.
- **Account PATCH accepts `type` changes** with no validation against the allowed enum
  (`income`/`expense`/asset/liability/equity). A typo'd type breaks report grouping. Validate
  against the known set.
- **Bank-transaction match doesn't scope `txId` to the statement/association**
  (`bank-statements/[statementId]/transactions/[txId]/route.ts` PATCH): it verifies the
  *statement* belongs to the association, then does `bankTransaction.update({ where: { id: txId } })`
  with no check that `txId` belongs to that statement. An editor could pass a `txId` from
  another association and reassign its `voucherId`. Low severity (requires editor role + a
  guessed id), but fix by filtering `where: { id: txId, statementId }` and confirming a row
  matched.

---

## Suggested PR order

1. **B1 + B2** — stop the data loss (small, high value). Ship first.
2. **B3 + B8** — add the two unique constraints + transactional numbering (one migration PR).
3. **B4** — unify payment tracking.
4. **B5 + B6 + B7** — parser/number/date correctness (with unit tests).
5. **B9 + B10** — robustness cleanup.

For each: exercise the actual flow (create a voucher, close a year, regenerate invoices,
import a CSV with amounts ≥ 1000) and confirm the observed behavior, not just the build.
