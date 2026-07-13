import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkOrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateWorkOrderStatusDto {
  @ApiProperty({ enum: WorkOrderStatus })
  @IsEnum(WorkOrderStatus)
  status!: WorkOrderStatus;

  @ApiPropertyOptional({ description: 'Registrado no histórico de status' })
  @IsOptional()
  @IsString()
  note?: string;
}
