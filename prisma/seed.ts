import { Priority, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { calculateSlaDueAt } from '../src/modules/work-orders/sla';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Senha123!';

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: 'super@fieldcore.dev' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'super@fieldcore.dev',
      passwordHash,
      role: Role.SUPER_ADMIN,
    },
  });

  const company = await prisma.company.upsert({
    where: { document: '00.000.000/0001-00' },
    update: {},
    create: {
      name: 'FieldCore Demo Ltda',
      document: '00.000.000/0001-00',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@fieldcore.dev' },
    update: {},
    create: {
      companyId: company.id,
      name: 'Admin Demo',
      email: 'admin@fieldcore.dev',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const technicianUser = await prisma.user.upsert({
    where: { email: 'tecnico@fieldcore.dev' },
    update: {},
    create: {
      companyId: company.id,
      name: 'Técnico Demo',
      email: 'tecnico@fieldcore.dev',
      passwordHash,
      role: Role.TECNICO,
    },
  });

  const technician = await prisma.technician.upsert({
    where: { userId: technicianUser.id },
    update: {},
    create: {
      companyId: company.id,
      userId: technicianUser.id,
      specialty: 'Climatização e refrigeração',
    },
  });

  let customer = await prisma.customer.findFirst({
    where: { companyId: company.id, document: '11.111.111/0001-11' },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        name: 'Condominio Edificio Central',
        document: '11.111.111/0001-11',
        email: 'sindico@edificiocentral.com.br',
        phone: '(44) 99999-0000',
        address: 'Av. Brasil, 1000 - Maringa/PR',
      },
    });
  }

  let equipment = await prisma.equipment.findFirst({
    where: { companyId: company.id, customerId: customer.id, serialNumber: 'AC-2024-001' },
  });
  if (!equipment) {
    equipment = await prisma.equipment.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        name: 'Ar-condicionado Split 18000 BTUs',
        type: 'Climatizacao',
        brand: 'Daikin',
        serialNumber: 'AC-2024-001',
        installedAt: new Date('2024-03-01'),
      },
    });
  }

  let part = await prisma.part.findFirst({
    where: { companyId: company.id, sku: 'CAP-40UF' },
  });
  if (!part) {
    part = await prisma.part.create({
      data: {
        companyId: company.id,
        name: 'Capacitor de partida 40uF',
        sku: 'CAP-40UF',
        unitPrice: 89.9,
        stockQty: 15,
      },
    });
  }

  let workOrder = await prisma.workOrder.findFirst({
    where: { companyId: company.id, equipmentId: equipment.id },
  });
  if (!workOrder) {
    const openedAt = new Date();
    workOrder = await prisma.workOrder.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        equipmentId: equipment.id,
        priority: Priority.ALTA,
        description: 'Ar-condicionado nao gela, cliente relata ruido no compressor.',
        createdByUserId: admin.id,
        openedAt,
        slaDueAt: calculateSlaDueAt(openedAt, Priority.ALTA),
      },
    });
  }

  // Garante tecnico/peca/comentario mesmo que a OS ja existisse de um seed anterior
  // (antes da versao intermediaria, que introduziu esses recursos).
  if (!workOrder.technicianId) {
    workOrder = await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: { technicianId: technician.id },
    });
  }

  const existingPart = await prisma.workOrderPart.findFirst({
    where: { workOrderId: workOrder.id },
  });
  if (!existingPart) {
    await prisma.workOrderPart.create({
      data: {
        workOrderId: workOrder.id,
        partId: part.id,
        quantity: 1,
        unitPriceAtUse: part.unitPrice,
      },
    });
  }

  const existingComment = await prisma.comment.findFirst({
    where: { workOrderId: workOrder.id },
  });
  if (!existingComment) {
    await prisma.comment.create({
      data: {
        workOrderId: workOrder.id,
        authorUserId: technicianUser.id,
        body: 'Capacitor de partida substituído. Aguardando teste de funcionamento.',
        isInternal: true,
      },
    });
  }

  console.log('Seed concluido.');
  console.log(`SUPER_ADMIN: super@fieldcore.dev / ${DEMO_PASSWORD}`);
  console.log(`ADMIN:       admin@fieldcore.dev / ${DEMO_PASSWORD}`);
  console.log(`TECNICO:     tecnico@fieldcore.dev / ${DEMO_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
