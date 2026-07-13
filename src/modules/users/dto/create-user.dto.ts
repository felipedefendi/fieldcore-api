import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

/** SUPER_ADMIN nunca e atribuivel por este endpoint -- so existe via seed. */
export const ASSIGNABLE_ROLES = [
  Role.ADMIN,
  Role.GESTOR,
  Role.TECNICO,
  Role.CLIENTE_EXTERNO,
] as const;

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES)
  role!: (typeof ASSIGNABLE_ROLES)[number];
}
