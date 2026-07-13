import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, Role, WorkOrderStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { PaginatedResult } from '../../common/types/paginated-result';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { ListWorkOrdersQueryDto } from './dto/list-work-orders-query.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { AddWorkOrderPartDto } from './dto/add-work-order-part.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { UpdateWorkOrderStatusDto } from './dto/update-work-order-status.dto';
import {
  assertValidTransition,
  InvalidWorkOrderTransitionError,
} from './work-order-status.state-machine';
import { calculateSlaDueAt, isSlaBreached } from './sla';
import { calculateWorkOrderCost } from './cost';

const workOrderInclude = {
  customer: true,
  equipment: true,
  technician: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  parts: { include: { part: true } },
  comments: { orderBy: { createdAt: 'desc' as const } },
  statusHistory: { orderBy: { changedAt: 'desc' as const } },
} satisfies Prisma.WorkOrderInclude;

type WorkOrderWithRelations = Prisma.WorkOrderGetPayload<{
  include: typeof workOrderInclude;
}>;

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

    const openedAt = new Date();

    const workOrder = await this.prisma.workOrder.create({
      data: {
        companyId,
        customerId: dto.customerId,
        equipmentId: dto.equipmentId,
        priority: dto.priority,
        description: dto.description,
        createdByUserId,
        openedAt,
        slaDueAt: calculateSlaDueAt(openedAt, dto.priority),
      },
      include: workOrderInclude,
    });

    return decorateWorkOrder(workOrder);
  }

  async findAll(
    companyId: string,
    query: ListWorkOrdersQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<unknown>> {
    const { page, limit, search, status } = query;
    const where: Prisma.WorkOrderWhereInput = {
      companyId,
      ...(status ? { status } : {}),
      ...(search
        ? { description: { contains: search, mode: 'insensitive' } }
        : {}),
      ...(currentUser.role === Role.TECNICO
        ? { technicianId: currentUser.technicianId }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { openedAt: 'desc' },
        include: workOrderInclude,
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    return { data: rows.map(decorateWorkOrder), total, page, limit };
  }

  async findOne(companyId: string, id: string, currentUser: AuthenticatedUser) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, companyId },
      include: workOrderInclude,
    });

    if (!workOrder) {
      throw new NotFoundException('Ordem de servico nao encontrada.');
    }

    this.assertTechnicianOwnership(workOrder, currentUser);

    return decorateWorkOrder(workOrder);
  }

  async assignTechnician(
    companyId: string,
    id: string,
    dto: AssignTechnicianDto,
  ) {
    await this.findRawOrThrow(companyId, id);

    const technician = await this.prisma.technician.findFirst({
      where: { id: dto.technicianId, companyId, isActive: true },
    });
    if (!technician) {
      throw new NotFoundException(
        'Tecnico nao encontrado ou inativo nesta empresa.',
      );
    }

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { technicianId: dto.technicianId },
      include: workOrderInclude,
    });

    return decorateWorkOrder(updated);
  }

  async updateStatus(
    companyId: string,
    id: string,
    dto: UpdateWorkOrderStatusDto,
    currentUser: AuthenticatedUser,
  ) {
    const workOrder = await this.findRawOrThrow(companyId, id);
    this.assertTechnicianOwnership(workOrder, currentUser);

    try {
      assertValidTransition(workOrder.status, dto.status);
    } catch (error) {
      if (error instanceof InvalidWorkOrderTransitionError) {
        throw new UnprocessableEntityException(error.message);
      }
      throw error;
    }

    const timestampField = timestampFieldFor(dto.status);

    const [updated] = await this.prisma.$transaction([
      this.prisma.workOrder.update({
        where: { id },
        data: {
          status: dto.status,
          ...(timestampField ? { [timestampField]: new Date() } : {}),
        },
        include: workOrderInclude,
      }),
      this.prisma.workOrderStatusHistory.create({
        data: {
          workOrderId: id,
          fromStatus: workOrder.status,
          toStatus: dto.status,
          changedByUserId: currentUser.id,
          note: dto.note,
        },
      }),
    ]);

    return decorateWorkOrder(updated);
  }

  async addPart(
    companyId: string,
    id: string,
    dto: AddWorkOrderPartDto,
    currentUser: AuthenticatedUser,
  ) {
    const workOrder = await this.findRawOrThrow(companyId, id);
    this.assertTechnicianOwnership(workOrder, currentUser);

    const part = await this.prisma.part.findFirst({
      where: { id: dto.partId, companyId },
    });
    if (!part) {
      throw new NotFoundException('Peca nao encontrada nesta empresa.');
    }

    await this.prisma.workOrderPart.create({
      data: {
        workOrderId: id,
        partId: dto.partId,
        quantity: dto.quantity,
        unitPriceAtUse: part.unitPrice,
      },
    });

    return this.findOne(companyId, id, currentUser);
  }

  async addComment(
    companyId: string,
    id: string,
    dto: AddCommentDto,
    currentUser: AuthenticatedUser,
  ) {
    const workOrder = await this.findRawOrThrow(companyId, id);
    this.assertTechnicianOwnership(workOrder, currentUser);

    await this.prisma.comment.create({
      data: {
        workOrderId: id,
        authorUserId: currentUser.id,
        body: dto.body,
        isInternal: dto.isInternal ?? true,
      },
    });

    return this.findOne(companyId, id, currentUser);
  }

  private async findRawOrThrow(companyId: string, id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, companyId },
    });
    if (!workOrder) {
      throw new NotFoundException('Ordem de servico nao encontrada.');
    }
    return workOrder;
  }

  private assertTechnicianOwnership(
    workOrder: { technicianId: string | null },
    currentUser: AuthenticatedUser,
  ) {
    if (
      currentUser.role === Role.TECNICO &&
      workOrder.technicianId !== currentUser.technicianId
    ) {
      throw new ForbiddenException(
        'Voce so pode acessar ordens de servico atribuidas a voce.',
      );
    }
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

/** Enriquece a OS com campos derivados (nunca armazenados): SLA estourado e custo total. */
function decorateWorkOrder(
  workOrder: WorkOrderWithRelations | Prisma.WorkOrderGetPayload<object>,
) {
  const parts =
    'parts' in workOrder
      ? workOrder.parts.map((p) => ({
          quantity: p.quantity,
          unitPriceAtUse: Number(p.unitPriceAtUse),
        }))
      : [];

  return {
    ...workOrder,
    slaBreached: isSlaBreached({
      slaDueAt: workOrder.slaDueAt,
      status: workOrder.status,
      resolvedAt: workOrder.resolvedAt,
    }),
    totalCost: calculateWorkOrderCost(parts, Number(workOrder.laborCost ?? 0)),
  };
}
