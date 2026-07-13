const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Converte "15m", "7d" etc. em milissegundos. */
export function parseDurationToMs(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration.trim());

  if (!match) {
    throw new Error(
      `Formato de duracao invalido: "${duration}". Use algo como "15m" ou "7d".`,
    );
  }

  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit];
}

export function addDuration(date: Date, duration: string): Date {
  return new Date(date.getTime() + parseDurationToMs(duration));
}
