import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class AddCommentDto {
  @ApiProperty({ example: 'Peça substituída, aguardando teste final.' })
  @IsString()
  @MinLength(2)
  body!: string;

  @ApiPropertyOptional({
    default: true,
    description: 'false = visível ao cliente externo',
  })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
