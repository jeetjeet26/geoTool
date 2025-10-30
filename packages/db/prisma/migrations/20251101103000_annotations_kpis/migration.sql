-- Create new enums for annotation tags and KPI units
CREATE TYPE "QueryAnnotationTagEnum" AS ENUM ('win', 'risk', 'gap', 'missing_citation', 'visibility', 'competitor');
CREATE TYPE "KpiUnitEnum" AS ENUM ('percent', 'number', 'currency', 'ratio');

-- Extend client metadata to support narratives, cadence, and baselines
ALTER TABLE "Client"
  ADD COLUMN "narrativeNotes" TEXT,
  ADD COLUMN "reportingCadence" TEXT,
  ADD COLUMN "baselineRunId" TEXT,
  ADD COLUMN "visibilityTarget" DECIMAL(65,30);

CREATE UNIQUE INDEX "Client_baselineRunId_key" ON "Client"("baselineRunId");

ALTER TABLE "Client"
  ADD CONSTRAINT "Client_baselineRunId_fkey"
  FOREIGN KEY ("baselineRunId") REFERENCES "Run"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Table to track annotations per query/run combo
CREATE TABLE "QueryAnnotation" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "queryId" TEXT NOT NULL,
  "runId" TEXT,
  "surface" "SurfaceEnum",
  "tags" "QueryAnnotationTagEnum"[] NOT NULL DEFAULT ARRAY[]::"QueryAnnotationTagEnum"[],
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "QueryAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QueryAnnotation_clientId_idx" ON "QueryAnnotation"("clientId");
CREATE INDEX "QueryAnnotation_queryId_idx" ON "QueryAnnotation"("queryId");
CREATE INDEX "QueryAnnotation_runId_idx" ON "QueryAnnotation"("runId");

ALTER TABLE "QueryAnnotation"
  ADD CONSTRAINT "QueryAnnotation_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QueryAnnotation"
  ADD CONSTRAINT "QueryAnnotation_queryId_fkey"
  FOREIGN KEY ("queryId") REFERENCES "Query"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QueryAnnotation"
  ADD CONSTRAINT "QueryAnnotation_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "Run"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Evidence attachments for annotations
CREATE TABLE "QueryEvidence" (
  "id" TEXT NOT NULL,
  "annotationId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "excerpt" TEXT,
  "url" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "QueryEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QueryEvidence_annotationId_idx" ON "QueryEvidence"("annotationId");

ALTER TABLE "QueryEvidence"
  ADD CONSTRAINT "QueryEvidence_annotationId_fkey"
  FOREIGN KEY ("annotationId") REFERENCES "QueryAnnotation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Client KPI tracking table
CREATE TABLE "ClientKpi" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "unit" "KpiUnitEnum" NOT NULL,
  "targetValue" DECIMAL(65,30),
  "currentValue" DECIMAL(65,30),
  "visibilityLink" DECIMAL(65,30),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClientKpi_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientKpi_clientId_idx" ON "ClientKpi"("clientId");

ALTER TABLE "ClientKpi"
  ADD CONSTRAINT "ClientKpi_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;




