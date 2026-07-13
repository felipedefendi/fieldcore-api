import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { requireCompanyId } from '../../common/utils/require-company-id';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(requireCompanyId(currentUser), dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.GESTOR)
  findAll(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.findAll(requireCompanyId(currentUser));
  }

  @Patch(':id/role')
  updateRole(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(
      requireCompanyId(currentUser),
      id,
      dto.role,
    );
  }

  @Delete(':id')
  deactivate(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.usersService.deactivate(requireCompanyId(currentUser), id);
  }
}
