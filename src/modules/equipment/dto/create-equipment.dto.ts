import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEquipmentDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty({ example: 'Ar-condicionado Split 18000 BTUs' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'Climatizacao' })
  @IsString()
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  installedAt?: string;
}
