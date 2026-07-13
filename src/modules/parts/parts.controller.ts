import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { requireCompanyId } from '../../common/utils/require-company-id';
import { CreatePartDto } from './dto/create-part.dto';
import { PartsService } from './parts.service';

@ApiTags('parts')
@ApiBearerAuth()
@Controller('parts')
export class PartsController {
  constructor(private readonly partsService: PartsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.GESTOR)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePartDto) {
    return this.partsService.create(requireCompanyId(user), dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.GESTOR, Role.TECNICO)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.partsService.findAll(requireCompanyId(user));
  }
}
