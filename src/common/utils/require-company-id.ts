import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Toda rota escopada por empresa exige um usuario vinculado a uma (hoje, so
 * o SUPER_ADMIN tem companyId nulo, e ele nao acessa essas rotas por causa
 * do @Roles() -- esta funcao so formaliza essa invariante com um erro claro).
 */
export function requireCompanyId(user: AuthenticatedUser): string {
  if (!user.companyId) {
    throw new ForbiddenException(
      'Esta acao exige um usuario vinculado a uma empresa.',
    );
  }
  return user.companyId;
}
