import { ApiProperty } from '@nestjs/swagger';
import { WorkOrderStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateWorkOrderStatusDto {
  @ApiProperty({ enum: WorkOrderStatus })
  @IsEnum(WorkOrderStatus)
  status!: WorkOrderStatus;
}
