import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Manutencao Predial ABC Ltda' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: '12.345.678/0001-99' })
  @IsString()
  @MinLength(5)
  document!: string;
}
