-- Recreate BankStatement and BankTransaction with association-level scope
-- (replacing the fiscal-year-scoped design)

DROP TABLE IF EXISTS "BankTransaction";
DROP TABLE IF EXISTS "BankStatement";

CREATE TABLE "BankStatement" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "importedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filename"      TEXT NOT NULL,
    "format"        TEXT NOT NULL DEFAULT 'csv',
    "associationId" TEXT NOT NULL,
    CONSTRAINT "BankStatement_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BankTransaction" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "date"        DATETIME NOT NULL,
    "amount"      REAL NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "reference"   TEXT NOT NULL DEFAULT '',
    "archiveId"   TEXT NOT NULL DEFAULT '',
    "voucherId"   TEXT,
    "statementId" TEXT NOT NULL,
    CONSTRAINT "BankTransaction_voucherId_fkey"   FOREIGN KEY ("voucherId")   REFERENCES "Voucher" ("id")        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BankTransaction_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement" ("id")  ON DELETE CASCADE  ON UPDATE CASCADE
);
