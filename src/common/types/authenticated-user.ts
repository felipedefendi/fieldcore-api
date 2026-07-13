import type { Role } from '@prisma/client';

/** Formato do usuario anexado a `request.user` pela JwtStrategy apos validar o token. */
export type AuthenticatedUser = {
  id: string;
  email: string;
  role: Role;
  companyId: string | null;
};
