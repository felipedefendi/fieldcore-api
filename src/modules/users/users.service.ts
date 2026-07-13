import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const PASSWORD_SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Ja existe um usuario com este email.');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        companyId,
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
      },
    });

    return toSafeUser(user);
  }

  async findAll(companyId: string) {
    const users = await this.prisma.user.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(toSafeUser);
  }

  async updateRole(companyId: string, id: string, role: Role) {
    const user = await this.findOwnedOrThrow(companyId, id);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { role },
    });
    return toSafeUser(updated);
  }

  async deactivate(companyId: string, id: string) {
    const user = await this.findOwnedOrThrow(companyId, id);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });
    return toSafeUser(updated);
  }

  private async findOwnedOrThrow(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    return user;
  }
}

/** Lista explicita de campos (em vez de "excluir passwordHash") -- nao vaza
 * um campo sensivel novo por acidente se o model User ganhar mais colunas. */
function toSafeUser(user: User): Omit<User, 'passwordHash'> {
  return {
    id: user.id,
    companyId: user.companyId,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}
