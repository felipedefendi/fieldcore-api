import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ASSIGNABLE_ROLES } from './create-user.dto';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES)
  role!: (typeof ASSIGNABLE_ROLES)[number];
}
