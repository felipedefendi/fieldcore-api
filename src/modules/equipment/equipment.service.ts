import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateEquipmentDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, companyId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente nao encontrado nesta empresa.');
    }

    return this.prisma.equipment.create({
      data: {
        companyId,
        customerId: dto.customerId,
        name: dto.name,
        type: dto.type,
        brand: dto.brand,
        serialNumber: dto.serialNumber,
        installedAt: dto.installedAt ? new Date(dto.installedAt) : undefined,
      },
    });
  }

  /** Historico de manutencao: todas as ordens de servico ja abertas para este equipamento. */
  async getHistory(companyId: string, id: string) {
    const equipment = await this.prisma.equipment.findFirst({
      where: { id, companyId },
    });
    if (!equipment) {
      throw new NotFoundException('Equipamento nao encontrado.');
    }

    const workOrders = await this.prisma.workOrder.findMany({
      where: { equipmentId: id },
      orderBy: { openedAt: 'desc' },
    });

    return { equipment, workOrders };
  }
}
