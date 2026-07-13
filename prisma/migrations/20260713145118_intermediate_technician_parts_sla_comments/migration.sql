/*
  Warnings:

  - Added the required column `slaDueAt` to the `WorkOrder` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- slaDueAt entra como nullable pra permitir backfill das linhas existentes
-- (ver UPDATE + SET NOT NULL logo abaixo).
ALTER TABLE "WorkOrder" ADD COLUMN     "laborCost" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "laborHours" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "slaDueAt" TIMESTAMP(3),
ADD COLUMN     "technicianId" TEXT;

-- Backfill: calcula o prazo de SLA das ordens ja existentes a partir da
-- prioridade, com a mesma regra usada pela aplicacao (URGENTE=4h, ALTA=8h,
-- MEDIA=24h, BAIXA=72h).
UPDATE "WorkOrder" SET "slaDueAt" = "openedAt" + (CASE "priority"
  WHEN 'URGENTE' THEN INTERVAL '4 hours'
  WHEN 'ALTA' THEN INTERVAL '8 hours'
  WHEN 'MEDIA' THEN INTERVAL '24 hours'
  WHEN 'BAIXA' THEN INTERVAL '72 hours'
END)
WHERE "slaDueAt" IS NULL;

ALTER TABLE "WorkOrder" ALTER COLUMN "slaDueAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "Technician" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specialty" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Technician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "stockQty" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderPart" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceAtUse" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderStatusHistory" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fromStatus" "WorkOrderStatus",
    "toStatus" "WorkOrderStatus" NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "note" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Technician_userId_key" ON "Technician"("userId");

-- AddForeignKey
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderPart" ADD CONSTRAINT "WorkOrderPart_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderPart" ADD CONSTRAINT "WorkOrderPart_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStatusHistory" ADD CONSTRAINT "WorkOrderStatusHistory_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStatusHistory" ADD CONSTRAINT "WorkOrderStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
