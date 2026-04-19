-- Add liitetiedot (notes to accounts) column to FiscalYear
ALTER TABLE "FiscalYear" ADD COLUMN "liitetiedot" TEXT NOT NULL DEFAULT '[]';
