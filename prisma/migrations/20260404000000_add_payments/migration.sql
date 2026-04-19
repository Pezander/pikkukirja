-- CreateTable: Payment (partial/installment payments for invoices)
CREATE TABLE "Payment" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "amount"    REAL NOT NULL,
    "paidAt"    DATETIME NOT NULL,
    "note"      TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT NOT NULL,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
