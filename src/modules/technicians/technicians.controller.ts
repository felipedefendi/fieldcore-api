import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { requireCompanyId } from '../../common/utils/require-company-id';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { TechniciansService } from './technicians.service';

@ApiTags('technicians')
@ApiBearerAuth()
@Controller('technicians')
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTechnicianDto,
  ) {
    return this.techniciansService.create(requireCompanyId(user), dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.GESTOR)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.techniciansService.findAll(requireCompanyId(user));
  }

  @Get(':id/work-orders')
  @Roles(Role.ADMIN, Role.GESTOR, Role.TECNICO)
  getWorkOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    if (user.role === Role.TECNICO && user.technicianId !== id) {
      throw new ForbiddenException(
        'Você só pode ver as próprias ordens de serviço.',
      );
    }
    return this.techniciansService.getWorkOrders(requireCompanyId(user), id);
  }
}
