import { calculateWorkOrderCost } from './cost';

describe('calculateWorkOrderCost', () => {
  it('soma pecas (quantidade x preco congelado) mais mao de obra', () => {
    const parts = [
      { quantity: 2, unitPriceAtUse: 50 },
      { quantity: 1, unitPriceAtUse: 120.5 },
    ];
    expect(calculateWorkOrderCost(parts, 200)).toBe(2 * 50 + 120.5 + 200);
  });

  it('funciona sem mao de obra informada', () => {
    expect(calculateWorkOrderCost([{ quantity: 3, unitPriceAtUse: 10 }])).toBe(
      30,
    );
  });

  it('funciona sem nenhuma peca usada', () => {
    expect(calculateWorkOrderCost([], 150)).toBe(150);
  });

  it('arredonda para duas casas decimais', () => {
    const parts = [{ quantity: 3, unitPriceAtUse: 0.1 }];
    expect(calculateWorkOrderCost(parts, 0)).toBe(0.3);
  });
});
