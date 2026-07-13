import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePartDto {
  @ApiProperty({ example: 'Capacitor de partida 40uF' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'CAP-40UF' })
  @IsString()
  sku!: string;

  @ApiProperty({ example: 89.9 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;
}
