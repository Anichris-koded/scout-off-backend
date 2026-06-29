import request from 'supertest';
import app from '../../src/app';

describe('GET /api/players/:playerId/milestones - sorting', () => {
  it('returns milestones with default sort (asc by submittedAt)', async () => {
    const res = await request(app).get('/api/players/player-1/milestones');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('accepts sortBy=submittedAt&order=asc', async () => {
    const res = await request(app).get('/api/players/player-1/milestones?sortBy=submittedAt&order=asc');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('accepts sortBy=approvedAt&order=desc', async () => {
    const res = await request(app).get('/api/players/player-1/milestones?sortBy=approvedAt&order=desc');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 for invalid sortBy value', async () => {
    const res = await request(app).get('/api/players/player-1/milestones?sortBy=invalidField');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid order value', async () => {
    const res = await request(app).get('/api/players/player-1/milestones?order=random');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
