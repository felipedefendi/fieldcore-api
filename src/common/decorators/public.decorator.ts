import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca uma rota como publica -- unica excecao a regra "toda rota exige JWT valido". */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
