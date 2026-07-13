import { WorkOrderStatus } from '@prisma/client';
import {
  assertValidTransition,
  canTransition,
  InvalidWorkOrderTransitionError,
} from './work-order-status.state-machine';

describe('work-order-status.state-machine', () => {
  it.each([
    [WorkOrderStatus.ABERTA, WorkOrderStatus.EM_ANDAMENTO, true],
    [WorkOrderStatus.ABERTA, WorkOrderStatus.CANCELADA, true],
    [WorkOrderStatus.ABERTA, WorkOrderStatus.CONCLUIDA, false],
    [WorkOrderStatus.EM_ANDAMENTO, WorkOrderStatus.CONCLUIDA, true],
    [WorkOrderStatus.EM_ANDAMENTO, WorkOrderStatus.CANCELADA, true],
    [WorkOrderStatus.EM_ANDAMENTO, WorkOrderStatus.ABERTA, false],
    [WorkOrderStatus.CONCLUIDA, WorkOrderStatus.EM_ANDAMENTO, false],
    [WorkOrderStatus.CONCLUIDA, WorkOrderStatus.ABERTA, false],
    [WorkOrderStatus.CANCELADA, WorkOrderStatus.ABERTA, false],
  ])('%s -> %s deve retornar %s', (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });

  it('lanca InvalidWorkOrderTransitionError para transicao invalida', () => {
    expect(() =>
      assertValidTransition(WorkOrderStatus.CONCLUIDA, WorkOrderStatus.ABERTA),
    ).toThrow(InvalidWorkOrderTransitionError);
  });

  it('nao lanca erro para uma transicao valida', () => {
    expect(() =>
      assertValidTransition(
        WorkOrderStatus.ABERTA,
        WorkOrderStatus.EM_ANDAMENTO,
      ),
    ).not.toThrow();
  });
});
