-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "memberNumber" TEXT NOT NULL DEFAULT '',
    "referenceNumber" TEXT NOT NULL DEFAULT '',
    "memberType" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "associationId" TEXT NOT NULL,
    CONSTRAINT "Member_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("address", "associationId", "city", "email", "id", "memberType", "name", "notes", "postalCode", "referenceNumber") SELECT "address", "associationId", "city", "email", "id", "memberType", "name", "notes", "postalCode", "referenceNumber" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE TABLE "new_VoucherAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voucherId" TEXT,
    "associationId" TEXT NOT NULL,
    CONSTRAINT "VoucherAttachment_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VoucherAttachment_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VoucherAttachment" ("associationId", "createdAt", "id", "mimeType", "note", "originalName", "size", "voucherId") SELECT "associationId", "createdAt", "id", "mimeType", "note", "originalName", "size", "voucherId" FROM "VoucherAttachment";
DROP TABLE "VoucherAttachment";
ALTER TABLE "new_VoucherAttachment" RENAME TO "VoucherAttachment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
