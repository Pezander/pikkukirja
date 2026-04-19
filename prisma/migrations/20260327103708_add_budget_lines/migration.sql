-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL DEFAULT 0,
    "accountId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    CONSTRAINT "BudgetLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetLine_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_accountId_fiscalYearId_key" ON "BudgetLine"("accountId", "fiscalYearId");
