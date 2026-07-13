import { WorkOrderStatus } from '@prisma/client';

/**
 * Maquina de estados da OS (escopo MVP -- sem PAUSADA ainda, ver PLANNING.md secao 12).
 * Isolada de Nest/Prisma de proposito: testavel sem subir nada.
 */
const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  [WorkOrderStatus.ABERTA]: [
    WorkOrderStatus.EM_ANDAMENTO,
    WorkOrderStatus.CANCELADA,
  ],
  [WorkOrderStatus.EM_ANDAMENTO]: [
    WorkOrderStatus.CONCLUIDA,
    WorkOrderStatus.CANCELADA,
  ],
  [WorkOrderStatus.CONCLUIDA]: [],
  [WorkOrderStatus.CANCELADA]: [],
};

export class InvalidWorkOrderTransitionError extends Error {
  constructor(
    public readonly from: WorkOrderStatus,
    public readonly to: WorkOrderStatus,
  ) {
    super(`Transicao de status invalida: ${from} -> ${to}`);
    this.name = 'InvalidWorkOrderTransitionError';
  }
}

export function canTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertValidTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidWorkOrderTransitionError(from, to);
  }
}
