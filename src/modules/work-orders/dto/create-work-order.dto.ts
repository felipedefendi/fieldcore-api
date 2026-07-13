import { ApiProperty } from '@nestjs/swagger';
import { Priority } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class CreateWorkOrderDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty()
  @IsString()
  equipmentId!: string;

  @ApiProperty({ enum: Priority })
  @IsEnum(Priority)
  priority!: Priority;

  @ApiProperty({
    example: 'Ar-condicionado nao gela, cliente relata ruido no compressor.',
  })
  @IsString()
  @MinLength(5)
  description!: string;
}
