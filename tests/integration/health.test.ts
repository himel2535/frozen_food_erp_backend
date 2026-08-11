import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('GET /health', () => {
  it('returns ok with connected database', async () => {
    const res = await request(app).get('/health').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database).toBe('connected');
  });
});

describe('GET /api/v1', () => {
  it('lists available API endpoints', async () => {
    const res = await request(app).get('/api/v1').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.endpoints.customers).toBe('/api/v1/customers');
    expect(res.body.endpoints.products).toBe('/api/v1/products');
  });
});
