-- AlterTable: add VAT rate to Association (toiminimi ALV support)
ALTER TABLE "Association" ADD COLUMN "vatRate" REAL;

-- AlterTable: add VAT fields to Invoice
ALTER TABLE "Invoice" ADD COLUMN "vatRate" REAL;
ALTER TABLE "Invoice" ADD COLUMN "vatAmount" REAL;
