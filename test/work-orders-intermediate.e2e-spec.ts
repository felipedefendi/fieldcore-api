import type { INestApplication } from '@nestjs/common';
import { PrismaClient, Priority, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-test-app';

// Roda contra o banco real (Neon) -- cria dados marcados com um sufixo unico
// e limpa tudo no afterAll. Chamadas de rede reais podem demorar mais que o
// timeout padrao do Jest.
jest.setTimeout(30_000);

const TEST_PASSWORD = 'TesteE2E123!';
const RUN_ID = Date.now().toString(36);

describe('Work Orders (e2e) — isolamento multi-tenant, RBAC e SLA/custo', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const companyIds: string[] = [];
  const userIds: string[] = [];

  let adminAToken: string;
  let adminBToken: string;
  let technicianAToken: string;
  let technicianAId: string;
  let customerAId: string;
  let equipmentAId: string;
  let partAId: string;
  let workOrderId: string;
  let unassignedWorkOrderId: string;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = new PrismaClient();

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    const companyA = await prisma.company.create({
      data: {
        name: `TESTE E2E Empresa A ${RUN_ID}`,
        document: `E2E-A-${RUN_ID}`,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `TESTE E2E Empresa B ${RUN_ID}`,
        document: `E2E-B-${RUN_ID}`,
      },
    });
    companyIds.push(companyA.id, companyB.id);

    const adminA = await prisma.user.create({
      data: {
        companyId: companyA.id,
        name: 'Admin A E2E',
        email: `admin-a-${RUN_ID}@e2e.test`,
        passwordHash,
        role: Role.ADMIN,
      },
    });
    const adminB = await prisma.user.create({
      data: {
        companyId: companyB.id,
        name: 'Admin B E2E',
        email: `admin-b-${RUN_ID}@e2e.test`,
        passwordHash,
        role: Role.ADMIN,
      },
    });
    const technicianUserA = await prisma.user.create({
      data: {
        companyId: companyA.id,
        name: 'Tecnico A E2E',
        email: `tecnico-a-${RUN_ID}@e2e.test`,
        passwordHash,
        role: Role.TECNICO,
      },
    });
    userIds.push(adminA.id, adminB.id, technicianUserA.id);

    const technicianA = await prisma.technician.create({
      data: { companyId: companyA.id, userId: technicianUserA.id },
    });
    technicianAId = technicianA.id;

    const customerA = await prisma.customer.create({
      data: {
        companyId: companyA.id,
        name: 'Cliente E2E',
        document: `DOC-${RUN_ID}`,
      },
    });
    customerAId = customerA.id;

    const equipmentA = await prisma.equipment.create({
      data: {
        companyId: companyA.id,
        customerId: customerA.id,
        name: 'Equip E2E',
        type: 'Teste',
      },
    });
    equipmentAId = equipmentA.id;

    const partA = await prisma.part.create({
      data: {
        companyId: companyA.id,
        name: 'Peça E2E',
        sku: `SKU-${RUN_ID}`,
        unitPrice: 75,
      },
    });
    partAId = partA.id;

    // Login pela API de verdade (exercita o fluxo completo de autenticação).
    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminA.email, password: TEST_PASSWORD })
      .expect(201);
    adminAToken = loginA.body.accessToken;

    const loginB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminB.email, password: TEST_PASSWORD })
      .expect(201);
    adminBToken = loginB.body.accessToken;

    const loginTech = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: technicianUserA.email, password: TEST_PASSWORD })
      .expect(201);
    technicianAToken = loginTech.body.accessToken;
  });

  afterAll(async () => {
    await prisma.workOrderStatusHistory.deleteMany({
      where: { workOrder: { companyId: { in: companyIds } } },
    });
    await prisma.comment.deleteMany({
      where: { workOrder: { companyId: { in: companyIds } } },
    });
    await prisma.workOrderPart.deleteMany({
      where: { workOrder: { companyId: { in: companyIds } } },
    });
    await prisma.workOrder.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.part.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.technician.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.equipment.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.customer.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('ADMIN da empresa A cria uma OS urgente com SLA calculado', async () => {
    const res = await request(app.getHttpServer())
      .post('/work-orders')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        customerId: customerAId,
        equipmentId: equipmentAId,
        priority: Priority.URGENTE,
        description: 'OS de teste e2e',
      })
      .expect(201);

    workOrderId = res.body.id;
    expect(res.body.status).toBe('ABERTA');

    const expectedSlaDueAt = new Date(res.body.openedAt);
    expectedSlaDueAt.setUTCHours(expectedSlaDueAt.getUTCHours() + 4);
    expect(new Date(res.body.slaDueAt).toISOString()).toBe(
      expectedSlaDueAt.toISOString(),
    );
  });

  it('empresa B não enxerga nenhum dado da empresa A (isolamento multi-tenant)', async () => {
    const customers = await request(app.getHttpServer())
      .get('/customers')
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(200);
    expect(customers.body.data).toHaveLength(0);

    const workOrders = await request(app.getHttpServer())
      .get('/work-orders')
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(200);
    expect(workOrders.body.data).toHaveLength(0);

    await request(app.getHttpServer())
      .get(`/work-orders/${workOrderId}`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(404);
  });

  it('ADMIN A atribui a OS ao técnico A', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/work-orders/${workOrderId}/assign`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ technicianId: technicianAId })
      .expect(200);

    expect(res.body.technicianId).toBe(technicianAId);
  });

  it('cria uma segunda OS sem atribuir a ninguém', async () => {
    const res = await request(app.getHttpServer())
      .post('/work-orders')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        customerId: customerAId,
        equipmentId: equipmentAId,
        priority: Priority.BAIXA,
        description: 'OS não atribuída',
      })
      .expect(201);

    unassignedWorkOrderId = res.body.id;
  });

  it('técnico só vê a própria OS atribuída na listagem', async () => {
    const res = await request(app.getHttpServer())
      .get('/work-orders')
      .set('Authorization', `Bearer ${technicianAToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(workOrderId);
  });

  it('técnico não consegue acessar OS que não é dele', async () => {
    await request(app.getHttpServer())
      .get(`/work-orders/${unassignedWorkOrderId}`)
      .set('Authorization', `Bearer ${technicianAToken}`)
      .expect(403);
  });

  it('técnico consegue mudar o status da própria OS (transição válida)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/work-orders/${workOrderId}/status`)
      .set('Authorization', `Bearer ${technicianAToken}`)
      .send({ status: 'EM_ANDAMENTO' })
      .expect(200);

    expect(res.body.status).toBe('EM_ANDAMENTO');
  });

  it('técnico não acessa rota exclusiva de SUPER_ADMIN', async () => {
    await request(app.getHttpServer())
      .get('/companies')
      .set('Authorization', `Bearer ${technicianAToken}`)
      .expect(403);
  });

  it('registra peça usada e calcula o custo total corretamente', async () => {
    await request(app.getHttpServer())
      .post(`/work-orders/${workOrderId}/parts`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ partId: partAId, quantity: 2 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/work-orders/${workOrderId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(res.body.totalCost).toBe(150); // 2 x 75
    expect(typeof res.body.totalCost).toBe('number');
    expect(res.body.slaBreached).toBe(false);
  });

  it('transição de status inválida é rejeitada com 422', async () => {
    await request(app.getHttpServer())
      .patch(`/work-orders/${unassignedWorkOrderId}/status`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ status: 'CONCLUIDA' })
      .expect(422);
  });

  it('histórico de status foi registrado automaticamente', async () => {
    const res = await request(app.getHttpServer())
      .get(`/work-orders/${workOrderId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(res.body.statusHistory.length).toBeGreaterThan(0);
    expect(res.body.statusHistory[0].toStatus).toBe('EM_ANDAMENTO');
  });
});
