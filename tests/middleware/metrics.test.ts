import { Request, Response, NextFunction } from 'express';
import { metricsMiddleware, metricsStore, getMetrics, isMetricsEnabled } from '../../src/middleware/metrics';

function makeReqRes(path = '/test', method = 'GET') {
  const listeners: Record<string, Function> = {};
  const req = { method, path, route: undefined } as unknown as Request;
  const res = {
    on: (event: string, cb: Function) => { listeners[event] = cb; },
    emit: (event: string) => listeners[event]?.(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next, emit: (e: string) => (res as any).emit(e) };
}

beforeEach(() => {
  Object.keys(metricsStore).forEach((k) => delete metricsStore[k]);
  delete process.env.METRICS_ENABLED;
});

describe('metricsMiddleware', () => {
  it('increments count after response finish', () => {
    const { req, res, next, emit } = makeReqRes('/api/players');
    metricsMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    emit('finish');
    const metrics = getMetrics();
    const key = Object.keys(metrics)[0];
    expect(metrics[key].count).toBe(1);
  });

  it('accumulates latency across multiple requests', () => {
    for (let i = 0; i < 3; i++) {
      const { req, res, next, emit } = makeReqRes('/api/scouts');
      metricsMiddleware(req, res, next);
      emit('finish');
    }
    const metrics = getMetrics();
    const key = Object.keys(metrics)[0];
    expect(metrics[key].count).toBe(3);
    expect(metrics[key].totalLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('skips collection when METRICS_ENABLED=false', () => {
    process.env.METRICS_ENABLED = 'false';
    const { req, res, next, emit } = makeReqRes('/api/players');
    metricsMiddleware(req, res, next);
    emit('finish');
    expect(Object.keys(metricsStore)).toHaveLength(0);
    expect(next).toHaveBeenCalled();
  });

  it('tracks different routes separately', () => {
    const a = makeReqRes('/api/players');
    const b = makeReqRes('/api/scouts');
    metricsMiddleware(a.req, a.res, a.next);
    metricsMiddleware(b.req, b.res, b.next);
    a.emit('finish');
    b.emit('finish');
    const metrics = getMetrics();
    expect(Object.keys(metrics)).toHaveLength(2);
  });
});

describe('isMetricsEnabled', () => {
  it('returns true by default', () => {
    expect(isMetricsEnabled()).toBe(true);
  });

  it('returns false when METRICS_ENABLED=false', () => {
    process.env.METRICS_ENABLED = 'false';
    expect(isMetricsEnabled()).toBe(false);
  });
});
