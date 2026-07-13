import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Prisma retorna campos Decimal como instancias de Prisma.Decimal, que o
 * Express serializa via toJSON() como STRING (ex.: "89.9"). Isso normaliza
 * pra numero antes de responder, pra API entregar um contrato consistente.
 */
@Injectable()
export class DecimalToNumberInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => transform(data)));
  }
}

function transform(value: unknown): unknown {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(transform);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = transform(val);
    }
    return result;
  }
  return value;
}
