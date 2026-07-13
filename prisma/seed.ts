import { Priority, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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

  const existingWorkOrder = await prisma.workOrder.findFirst({
    where: { companyId: company.id, equipmentId: equipment.id },
  });
  if (!existingWorkOrder) {
    await prisma.workOrder.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        equipmentId: equipment.id,
        priority: Priority.ALTA,
        description: 'Ar-condicionado nao gela, cliente relata ruido no compressor.',
        createdByUserId: admin.id,
      },
    });
  }

  console.log('Seed concluido.');
  console.log(`SUPER_ADMIN: super@fieldcore.dev / ${DEMO_PASSWORD}`);
  console.log(`ADMIN:       admin@fieldcore.dev / ${DEMO_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
