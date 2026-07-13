import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { requireCompanyId } from '../../common/utils/require-company-id';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { EquipmentService } from './equipment.service';

@ApiTags('equipment')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.GESTOR)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEquipmentDto,
  ) {
    return this.equipmentService.create(requireCompanyId(user), dto);
  }

  @Get(':id/history')
  getHistory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.equipmentService.getHistory(requireCompanyId(user), id);
  }
}
