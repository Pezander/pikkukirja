-- CreateTable: VoucherTemplate
CREATE TABLE "VoucherTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "recurrence" TEXT NOT NULL DEFAULT 'none',
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "associationId" TEXT NOT NULL,
    CONSTRAINT "VoucherTemplate_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: VoucherTemplateLine
CREATE TABLE "VoucherTemplateLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debit" REAL NOT NULL DEFAULT 0,
    "credit" REAL NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "accountId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    CONSTRAINT "VoucherTemplateLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VoucherTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VoucherTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: Meeting
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingType" TEXT NOT NULL,
    "meetingDate" DATETIME NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "attendees" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    CONSTRAINT "Meeting_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: Decision
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "outcome" TEXT NOT NULL DEFAULT 'passed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meetingId" TEXT NOT NULL,
    CONSTRAINT "Decision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
