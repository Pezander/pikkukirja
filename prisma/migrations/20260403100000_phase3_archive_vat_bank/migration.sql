-- Phase 3: Document Archive, VAT Reporting, Bank Statement Import
-- SQLite requires table recreation to make a column nullable (voucherId on VoucherAttachment)

-- Step 1: Recreate VoucherAttachment with nullable voucherId + new associationId + note fields
CREATE TABLE "VoucherAttachment_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voucherId" TEXT,
    "associationId" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "VoucherAttachment_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VoucherAttachment_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Step 2: Migrate existing rows, backfilling associationId via Voucher → FiscalYear
INSERT INTO "VoucherAttachment_new"
    ("id", "originalName", "mimeType", "size", "note", "createdAt", "voucherId", "associationId")
SELECT
    va."id",
    va."originalName",
    va."mimeType",
    va."size",
    '' AS "note",
    va."createdAt",
    va."voucherId",
    fy."associationId"
FROM "VoucherAttachment" va
JOIN "Voucher" v ON v."id" = va."voucherId"
JOIN "FiscalYear" fy ON fy."id" = v."fiscalYearId";

-- Step 3: Swap tables
DROP TABLE "VoucherAttachment";
ALTER TABLE "VoucherAttachment_new" RENAME TO "VoucherAttachment";

-- Step 4: Add VAT columns to VoucherLine
ALTER TABLE "VoucherLine" ADD COLUMN "vatAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "VoucherLine" ADD COLUMN "vatRate" REAL NOT NULL DEFAULT 0;

-- Step 5: VatPeriod table
CREATE TABLE "VatPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'quarter',
    "status" TEXT NOT NULL DEFAULT 'open',
    "submittedAt" DATETIME,
    "vatCollected" REAL NOT NULL DEFAULT 0,
    "vatDeductible" REAL NOT NULL DEFAULT 0,
    "vatPayable" REAL NOT NULL DEFAULT 0,
    "fiscalYearId" TEXT NOT NULL,
    CONSTRAINT "VatPeriod_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Step 6: BankStatement table
CREATE TABLE "BankStatement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filename" TEXT NOT NULL,
    "openingBalance" REAL NOT NULL DEFAULT 0,
    "closingBalance" REAL NOT NULL DEFAULT 0,
    "fiscalYearId" TEXT NOT NULL,
    CONSTRAINT "BankStatement_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Step 7: BankTransaction table
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "referenceNumber" TEXT NOT NULL DEFAULT '',
    "counterparty" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "voucherId" TEXT,
    "statementId" TEXT NOT NULL,
    CONSTRAINT "BankTransaction_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BankTransaction_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
