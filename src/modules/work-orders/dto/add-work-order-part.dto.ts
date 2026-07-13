import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class AddWorkOrderPartDto {
  @ApiProperty()
  @IsString()
  partId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}
