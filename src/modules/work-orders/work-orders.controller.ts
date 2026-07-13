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
import { AddCommentDto } from './dto/add-comment.dto';
import { AddWorkOrderPartDto } from './dto/add-work-order-part.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { ListWorkOrdersQueryDto } from './dto/list-work-orders-query.dto';
import { UpdateWorkOrderStatusDto } from './dto/update-work-order-status.dto';
import { WorkOrdersService } from './work-orders.service';

@ApiTags('work-orders')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.GESTOR, Role.TECNICO)
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Post()
  @Roles(Role.ADMIN, Role.GESTOR)
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
    return this.workOrdersService.findAll(requireCompanyId(user), query, user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.workOrdersService.findOne(requireCompanyId(user), id, user);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN, Role.GESTOR)
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignTechnicianDto,
  ) {
    return this.workOrdersService.assignTechnician(
      requireCompanyId(user),
      id,
      dto,
    );
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
      dto,
      user,
    );
  }

  @Post(':id/parts')
  addPart(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddWorkOrderPartDto,
  ) {
    return this.workOrdersService.addPart(
      requireCompanyId(user),
      id,
      dto,
      user,
    );
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.workOrdersService.addComment(
      requireCompanyId(user),
      id,
      dto,
      user,
    );
  }
}
