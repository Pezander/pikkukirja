-- CreateTable
CREATE TABLE "RoadEstateProperty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kiinteistoId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "distanceKm" REAL NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "memberId" TEXT NOT NULL,
    CONSTRAINT "RoadEstateProperty_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrafficAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trafficType" TEXT NOT NULL,
    "subType" TEXT NOT NULL DEFAULT '',
    "areaHa" REAL NOT NULL DEFAULT 0,
    "correctionFactor" REAL NOT NULL DEFAULT 1.0,
    "cropCorrection" TEXT NOT NULL DEFAULT 'none',
    "muuTripsPerYear" INTEGER NOT NULL DEFAULT 0,
    "muuVehicleWeightT" REAL NOT NULL DEFAULT 0,
    "muuCargoWeightT" REAL NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "roadPropertyId" TEXT NOT NULL,
    CONSTRAINT "TrafficAllocation_roadPropertyId_fkey" FOREIGN KEY ("roadPropertyId") REFERENCES "RoadEstateProperty" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoadUnitCalculation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "pricePerUnit" REAL NOT NULL DEFAULT 0,
    "adminFee" REAL NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "associationId" TEXT NOT NULL,
    CONSTRAINT "RoadUnitCalculation_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoadUnitResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberName" TEXT NOT NULL,
    "totalTkm" REAL NOT NULL,
    "sharePercent" REAL NOT NULL,
    "breakdown" TEXT NOT NULL DEFAULT '[]',
    "calculationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    CONSTRAINT "RoadUnitResult_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "RoadUnitCalculation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoadUnitResult_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
