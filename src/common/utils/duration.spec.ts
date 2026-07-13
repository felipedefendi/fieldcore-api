import { addDuration, parseDurationToMs } from './duration';

describe('parseDurationToMs', () => {
  it('converte segundos, minutos, horas e dias corretamente', () => {
    expect(parseDurationToMs('30s')).toBe(30_000);
    expect(parseDurationToMs('15m')).toBe(15 * 60_000);
    expect(parseDurationToMs('2h')).toBe(2 * 3_600_000);
    expect(parseDurationToMs('7d')).toBe(7 * 86_400_000);
  });

  it('lanca erro para formato invalido', () => {
    expect(() => parseDurationToMs('1w')).toThrow();
    expect(() => parseDurationToMs('abc')).toThrow();
  });
});

describe('addDuration', () => {
  it('soma a duracao a partir de uma data base', () => {
    const base = new Date('2026-01-01T00:00:00.000Z');
    const result = addDuration(base, '1d');
    expect(result.toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });
});
