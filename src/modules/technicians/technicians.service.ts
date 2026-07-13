import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateTechnicianDto } from './dto/create-technician.dto';

const userSelect = { id: true, name: true, email: true } as const;

@Injectable()
export class TechniciansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateTechnicianDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, companyId },
    });
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado nesta empresa.');
    }
    if (user.role !== Role.TECNICO) {
      throw new UnprocessableEntityException(
        'O usuario precisa ter o papel TECNICO.',
      );
    }

    const existing = await this.prisma.technician.findUnique({
      where: { userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException(
        'Este usuario ja possui um perfil de tecnico.',
      );
    }

    return this.prisma.technician.create({
      data: { companyId, userId: dto.userId, specialty: dto.specialty },
      include: { user: { select: userSelect } },
    });
  }

  findAll(companyId: string) {
    return this.prisma.technician.findMany({
      where: { companyId },
      include: { user: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWorkOrders(companyId: string, technicianId: string) {
    const technician = await this.prisma.technician.findFirst({
      where: { id: technicianId, companyId },
    });
    if (!technician) {
      throw new NotFoundException('Tecnico nao encontrado.');
    }

    return this.prisma.workOrder.findMany({
      where: { technicianId },
      orderBy: { openedAt: 'desc' },
      include: { customer: true, equipment: true },
    });
  }
}
