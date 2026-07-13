import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateTechnicianDto {
  @ApiProperty({ description: 'Id de um User existente com role TECNICO' })
  @IsString()
  userId!: string;

  @ApiPropertyOptional({ example: 'Refrigeração e climatização' })
  @IsOptional()
  @IsString()
  specialty?: string;
}
