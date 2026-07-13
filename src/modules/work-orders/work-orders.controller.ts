import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { requireCompanyId } from '../../common/utils/require-company-id';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { ListWorkOrdersQueryDto } from './dto/list-work-orders-query.dto';
import { UpdateWorkOrderStatusDto } from './dto/update-work-order-status.dto';
import { WorkOrdersService } from './work-orders.service';

// TECNICO tera acesso escopado as proprias OS quando o modulo Technician
// (atribuicao) for implementado -- ver PLANNING.md, versao intermediaria.
@ApiTags('work-orders')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.GESTOR)
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkOrderDto,
  ) {
    return this.workOrdersService.create(requireCompanyId(user), user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListWorkOrdersQueryDto,
  ) {
    return this.workOrdersService.findAll(requireCompanyId(user), query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.workOrdersService.findOne(requireCompanyId(user), id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkOrderStatusDto,
  ) {
    return this.workOrdersService.updateStatus(
      requireCompanyId(user),
      id,
      dto.status,
    );
  }
}
