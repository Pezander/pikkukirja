-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FiscalYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportSections" TEXT NOT NULL DEFAULT '[]',
    "associationId" TEXT NOT NULL,
    CONSTRAINT "FiscalYear_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FiscalYear" ("associationId", "createdAt", "id", "status", "year") SELECT "associationId", "createdAt", "id", "status", "year" FROM "FiscalYear";
DROP TABLE "FiscalYear";
ALTER TABLE "new_FiscalYear" RENAME TO "FiscalYear";
CREATE UNIQUE INDEX "FiscalYear_associationId_year_key" ON "FiscalYear"("associationId", "year");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
