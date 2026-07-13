import { Priority, WorkOrderStatus } from '@prisma/client';
import { addDuration } from '../../common/utils/duration';

const SLA_DURATION_BY_PRIORITY: Record<Priority, string> = {
  URGENTE: '4h',
  ALTA: '8h',
  MEDIA: '24h',
  BAIXA: '72h',
};

/** Prazo de SLA calculado na abertura, com base na prioridade da OS. */
export function calculateSlaDueAt(openedAt: Date, priority: Priority): Date {
  return addDuration(openedAt, SLA_DURATION_BY_PRIORITY[priority]);
}

type SlaCheckInput = {
  slaDueAt: Date;
  status: WorkOrderStatus;
  resolvedAt: Date | null;
};

/**
 * Uma OS cancelada nao conta como "estourada" -- o SLA deixa de fazer
 * sentido nesse caso. Para as demais, compara a resolucao (ou agora, se
 * ainda estiver aberta) contra o prazo.
 */
export function isSlaBreached(workOrder: SlaCheckInput): boolean {
  if (workOrder.status === WorkOrderStatus.CANCELADA) {
    return false;
  }

  const reference = workOrder.resolvedAt ?? new Date();
  return reference.getTime() > workOrder.slaDueAt.getTime();
}
