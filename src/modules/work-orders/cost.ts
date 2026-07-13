type PartUsage = {
  quantity: number;
  unitPriceAtUse: number;
};

/**
 * custoTotal = soma(quantidade x preco congelado da peca) + mao de obra.
 * Recebe numeros puros (o service converte os Decimal do Prisma antes de
 * chamar) para manter esta funcao livre de dependencia do Prisma.
 */
export function calculateWorkOrderCost(
  parts: PartUsage[],
  laborCost = 0,
): number {
  const partsTotal = parts.reduce(
    (sum, part) => sum + part.quantity * part.unitPriceAtUse,
    0,
  );
  return round2(partsTotal + laborCost);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
