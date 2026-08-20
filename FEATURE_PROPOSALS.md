# Feature proposals

**Audience:** Sonnet (implementer) + product owner. **Author:** Fable 5. **Date:** 2026-07-03.

Proposed additions for Pikkukirja. Every idea here is chosen to **stay within the app's
spirit**: lightweight bookkeeping and invoicing for small Finnish associations — *tiekunta*,
*metsästysseura*, *taloyhtiö*, *toiminimi* — run by volunteers, not accountants.

**Explicit non-goals (do not build these):**
- ❌ Direct bank API / PSD2 / payment-initiation integration — regulatory + security burden,
  out of scope. File-based bank import (CSV / CAMT.053) stays the ceiling.
- ❌ Full double-entry "pro" accounting features (cost centers, multi-currency, consolidation).
- ❌ Anything that turns this into heavy-duty ERP. Keep flows a volunteer treasurer can finish
  in one sitting.

Each proposal notes **why it fits**, **effort**, and **build notes**. Fix the items in
`BUGS.md` before building on top of invoicing/payments — several proposals depend on that code
being correct (especially B1 and B4).

---

## Tier 1 — high value, strongly in-spirit

### F1. Bank-statement → invoice reconciliation by reference number  ⭐

**What:** After importing a bank statement (feature already exists), show an "unmatched
credits" view that auto-suggests which **open invoice** each incoming payment settles, matched
on the Finnish reference number (`viitenumero`). One click marks the invoice paid (creating a
proper `Payment` row) and optionally the bookkeeping voucher.

**Why it fits:** The parsers (`parseBankCsv`, `parseCamt053`) already extract `reference` and
`amount`, and the README even advertises "automaattinen täsmäytys viitenumeron perusteella" —
but the current transaction PATCH only matches a transaction to a *voucher* manually; there's
no invoice reconciliation. This closes the loop treasurers most want, using only files the
user already downloads from their bank. No bank integration.

**Effort:** Medium.

**Build notes:**
- Add an endpoint `GET .../bank-statements/[statementId]/suggestions` that, for each credit
  transaction with no linked payment, finds the open invoice whose member's `referenceNumber`
  matches (normalize with `viitenumero.ts`) and whose amount is within a small tolerance.
- Add `POST .../reconcile` that, given `{ transactionId, invoiceId }`, creates a `Payment`
  (reusing the fixed payments logic from BUGS B4) and links the transaction.
- Surface confidence: exact ref + exact amount = "varma"; ref match but amount differs =
  "tarkista". Never auto-apply without the user confirming.
- Depends on BUGS **B4** (single source of truth for payments) and **B5** (amount parsing).

### F2. Overdue reminders with configurable late fee (viivästyskorko/muistutusmaksu)  ⭐

**What:** Extend the existing reminder cron so a reminder can optionally add a fixed
reminder fee (*muistutusmaksu*) and/or statutory late interest (*viivästyskorko*) to the
amount shown, and track how many reminders each invoice has had.

**Why it fits:** Reminders already exist (`cron/reminders`). Small associations routinely add
a few euros muistutusmaksu on the second notice; doing it by hand is error-prone. This is pure
in-app calculation — no external service.

**Effort:** Small–Medium.

**Build notes:**
- Add `reminderCount` / `lastReminderAt` to `Invoice` (migration).
- Association-level settings: `reminderFee` (flat €) and `lateInterestPercent` (annual %,
  Finnish default reference rate + margin — make it a plain configurable number, don't try to
  auto-fetch the Bank of Finland rate).
- Compute interest as `principal × rate/100 × overdueDays/365`, rounded to cents.
- Show the breakdown on the reminder email/PDF. Keep it optional per association.

### F3. Treasurer dashboard: unpaid totals + aging  ⭐

**What:** A compact dashboard card set: total invoiced this fiscal year, total paid, total
outstanding, and an aging bucket (0–30 / 31–60 / 60+ days overdue), plus current cash/bank
account balance from the ledger.

**Why it fits:** A `dashboard` route already exists — this enriches it. It's the one screen a
volunteer treasurer checks before a meeting. All data is already in the DB; no new inputs.

**Effort:** Small.

**Build notes:**
- Aggregate from `Invoice` + `Payment` (post-BUGS-B4) and from account 100/bank ledger balance.
- Keep it read-only and fast; cache nothing, the datasets are tiny.

---

## Tier 2 — clear value, moderate effort

### F4. Annual meeting document pack (tiekunta / yhdistys kokous)

**What:** Generate the standard meeting document set for the fiscal year from data already in
the system: agenda (esityslista), the financial statement (tilinpäätös — already a PDF),
proposed unit prices / budget, and a member roll-call sheet. Bundle as one PDF or ZIP.

**Why it fits:** These associations are legally required to hold an annual meeting and present
accounts. The app already has meetings, decisions, tilinpäätös PDF, budget, and member lists —
this stitches them into the packet a chair actually needs. No new problem domain.

**Effort:** Medium (mostly PDF composition, reusing existing components).

**Build notes:** Reuse `YearlyReviewPDF` and the meeting PDF renderer; add a cover/agenda page.
Let the user pick which sections to include.

### F5. Read-only shareable invoice / statement link for members

**What:** A tokenized public URL (`/i/<token>`) that lets a single member view *their own*
invoice and payment status without logging in — the link you paste into an email or SMS.

**Why it fits:** Members of a tiekunta are not app users and shouldn't be. A per-invoice
capability URL is the lightweight way to let them see "what do I owe / did my payment land".
Mirrors the existing tokenized password-reset pattern.

**Effort:** Medium.

**Build notes:**
- Per-invoice random token (32 bytes, hashed at rest like reset tokens), optional expiry.
- A minimal public route that renders one invoice read-only — **no** member list, no totals,
  no navigation. Rate-limit it (reuse `rate-limiter.ts`) and keep it out of the authed layout.
- Security review this one before shipping (it's a new unauthenticated surface).

### F6. Budget vs. actual variance report

**What:** Show the entered budget next to actual income/expense per account for the fiscal
year, with the variance and percent. A `budget` route already stores the numbers.

**Why it fits:** Volunteers set a budget at the annual meeting and want to see how the year
tracked against it — the natural companion to the existing budget entry. Pure reporting.

**Effort:** Small–Medium.

**Build notes:** Join stored budget lines to ledger actuals by account; render in the existing
report/PDF style. No new data model.

---

## Tier 3 — nice-to-have / polish

### F7. "Copy last year's settings" when opening a new fiscal year
Prefill unit price, admin fee, member-type fees, and budget from the previous year at
roll-forward time. Small quality-of-life win; the treasurer usually repeats last year ±a bit.

### F8. Duplicate-payment / duplicate-voucher guard surfaced in UI
A `vouchers/check-duplicate` endpoint already exists — surface its result inline when entering
a voucher, and add the same for recording a payment that looks like one already entered.

### F9. Member statement of account
Per-member view/PDF: all invoices, all payments, running balance across fiscal years. Useful
when a member disputes what they owe. Reuses invoice/payment data.

### F10. CSV/Excel export of the financial statement
Reports are currently PDF-only. A CSV export of trial balance / income statement lets a
treasurer hand numbers to an auditor or paste into a spreadsheet. Low effort; **apply the CSV
formula-injection guard from `SECURITY_FIXES.md` (P1-2) to any new export.**

### F11. Simple onboarding checklist for a new association
A first-run checklist (add accounts → add members → set unit price → create fiscal year) so a
new treasurer isn't staring at an empty app. Pure front-end.

---

## Suggested sequencing

1. **Land the `BUGS.md` fixes first** — F1/F2/F3 all sit on the invoicing + payment code.
2. **F3 (dashboard)** — cheapest, immediately visible, no schema change.
3. **F1 (reconciliation)** — the flagship treasurer feature; depends on B4/B5.
4. **F2 (reminders + fees)** and **F6 (budget vs actual)** — independent, medium effort.
5. **F4 (meeting pack)** and **F5 (share links)** — larger; F5 needs a security pass.
6. Tier 3 as filler.

**Guardrail for every feature:** if implementing it starts to require a bank/payment-provider
integration, a new always-on background service, or accounting concepts a volunteer wouldn't
recognize, stop and reconsider — that's the app leaving its lane. Prefer file import/export
and on-demand generation over live external connections.
