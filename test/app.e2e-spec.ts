import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-test-app';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET) retorna status ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });
});
