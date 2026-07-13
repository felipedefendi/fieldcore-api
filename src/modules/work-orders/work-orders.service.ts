import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, WorkOrderStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { PaginatedResult } from '../../common/types/paginated-result';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { ListWorkOrdersQueryDto } from './dto/list-work-orders-query.dto';
import {
  assertValidTransition,
  InvalidWorkOrderTransitionError,
} from './work-order-status.state-machine';

@Injectable()
export class WorkOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    companyId: string,
    createdByUserId: string,
    dto: CreateWorkOrderDto,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, companyId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente nao encontrado nesta empresa.');
    }

    const equipment = await this.prisma.equipment.findFirst({
      where: { id: dto.equipmentId, companyId, customerId: dto.customerId },
    });
    if (!equipment) {
      throw new NotFoundException(
        'Equipamento nao encontrado para este cliente.',
      );
    }

    return this.prisma.workOrder.create({
      data: {
        companyId,
        customerId: dto.customerId,
        equipmentId: dto.equipmentId,
        priority: dto.priority,
        description: dto.description,
        createdByUserId,
      },
    });
  }

  async findAll(
    companyId: string,
    query: ListWorkOrdersQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const { page, limit, search, status } = query;
    const where: Prisma.WorkOrderWhereInput = {
      companyId,
      ...(status ? { status } : {}),
      ...(search
        ? { description: { contains: search, mode: 'insensitive' } }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { openedAt: 'desc' },
        include: { customer: true, equipment: true },
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(companyId: string, id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, companyId },
      include: { customer: true, equipment: true },
    });

    if (!workOrder) {
      throw new NotFoundException('Ordem de servico nao encontrada.');
    }

    return workOrder;
  }

  async updateStatus(
    companyId: string,
    id: string,
    newStatus: WorkOrderStatus,
  ) {
    const workOrder = await this.findOne(companyId, id);

    try {
      assertValidTransition(workOrder.status, newStatus);
    } catch (error) {
      if (error instanceof InvalidWorkOrderTransitionError) {
        throw new UnprocessableEntityException(error.message);
      }
      throw error;
    }

    const timestampField = timestampFieldFor(newStatus);

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        status: newStatus,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
      },
    });
  }
}

function timestampFieldFor(
  status: WorkOrderStatus,
): 'startedAt' | 'resolvedAt' | 'closedAt' | null {
  switch (status) {
    case WorkOrderStatus.EM_ANDAMENTO:
      return 'startedAt';
    case WorkOrderStatus.CONCLUIDA:
      return 'resolvedAt';
    case WorkOrderStatus.CANCELADA:
      return 'closedAt';
    default:
      return null;
  }
}
