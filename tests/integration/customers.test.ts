import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('Customers API', () => {
  it('POST /api/v1/customers creates a record', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .send({ name: 'Test Toys Ltd', company: 'Test Co', status: 'active' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Test Toys Ltd');
    expect(res.body.data.id ?? res.body.data._id).toBeTruthy();
  });

  it('GET /api/v1/customers returns created records', async () => {
    await request(app)
      .post('/api/v1/customers')
      .send({ name: 'Alpha Shop' })
      .expect(201);

    const res = await request(app).get('/api/v1/customers').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Alpha Shop');
    expect(res.body.meta.total).toBe(1);
  });

  it('GET /api/v1/customers/:id returns 404 for missing id', async () => {
    const res = await request(app)
      .get('/api/v1/customers/507f1f77bcf86cd799439011')
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/v1/customers/:id removes the record', async () => {
    const created = await request(app)
      .post('/api/v1/customers')
      .send({ name: 'To Delete' })
      .expect(201);

    const id = (created.body.data.id ?? created.body.data._id) as string;

    await request(app).delete(`/api/v1/customers/${id}`).expect(200);

    await request(app).get(`/api/v1/customers/${id}`).expect(404);
  });
});
