import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePartDto } from './dto/create-part.dto';

@Injectable()
export class PartsService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreatePartDto) {
    return this.prisma.part.create({ data: { ...dto, companyId } });
  }

  findAll(companyId: string) {
    return this.prisma.part.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }
}
