import { WorkOrderStatus } from '@prisma/client';
import { calculateSlaDueAt, isSlaBreached } from './sla';

describe('calculateSlaDueAt', () => {
  const openedAt = new Date('2026-01-01T10:00:00.000Z');

  it.each([
    ['URGENTE', '2026-01-01T14:00:00.000Z'],
    ['ALTA', '2026-01-01T18:00:00.000Z'],
    ['MEDIA', '2026-01-02T10:00:00.000Z'],
    ['BAIXA', '2026-01-04T10:00:00.000Z'],
  ] as const)('prioridade %s vence em %s', (priority, expectedIso) => {
    expect(calculateSlaDueAt(openedAt, priority).toISOString()).toBe(
      expectedIso,
    );
  });
});

describe('isSlaBreached', () => {
  const slaDueAt = new Date('2026-01-01T18:00:00.000Z');

  it('nao esta estourada se resolvida antes do prazo', () => {
    expect(
      isSlaBreached({
        slaDueAt,
        status: WorkOrderStatus.CONCLUIDA,
        resolvedAt: new Date('2026-01-01T17:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('esta estourada se resolvida depois do prazo', () => {
    expect(
      isSlaBreached({
        slaDueAt,
        status: WorkOrderStatus.CONCLUIDA,
        resolvedAt: new Date('2026-01-01T19:00:00.000Z'),
      }),
    ).toBe(true);
  });

  it('OS cancelada nunca conta como estourada', () => {
    expect(
      isSlaBreached({
        slaDueAt,
        status: WorkOrderStatus.CANCELADA,
        resolvedAt: null,
      }),
    ).toBe(false);
  });

  it('OS ainda aberta usa o momento atual como referencia', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T19:00:00.000Z'));
    expect(
      isSlaBreached({
        slaDueAt,
        status: WorkOrderStatus.ABERTA,
        resolvedAt: null,
      }),
    ).toBe(true);

    jest.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
    expect(
      isSlaBreached({
        slaDueAt,
        status: WorkOrderStatus.ABERTA,
        resolvedAt: null,
      }),
    ).toBe(false);

    jest.useRealTimers();
  });
});
