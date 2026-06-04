import { Request, Response, NextFunction } from 'express';

export interface RouteMetric {
  count: number;
  totalLatencyMs: number;
}

/** In-memory metrics store. Replace with Prometheus or similar in production. */
export const metricsStore: Record<string, RouteMetric> = {};

/** Whether metrics collection is enabled. Controlled by METRICS_ENABLED env var. */
export function isMetricsEnabled(): boolean {
  return process.env.METRICS_ENABLED !== 'false';
}

/**
 * Express middleware that increments per-route request counts and accumulates latency.
 * Pluggable: swap metricsStore for a Prometheus registry without changing this middleware.
 * Disabled when METRICS_ENABLED=false.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!isMetricsEnabled()) {
    next();
    return;
  }
  const start = Date.now();
  res.on('finish', () => {
    const key = `${req.method} ${req.route?.path ?? req.path}`;
    const latency = Date.now() - start;
    if (!metricsStore[key]) {
      metricsStore[key] = { count: 0, totalLatencyMs: 0 };
    }
    metricsStore[key].count += 1;
    metricsStore[key].totalLatencyMs += latency;
  });
  next();
}

/** Returns a snapshot of collected metrics. */
export function getMetrics(): Record<string, RouteMetric> {
  return { ...metricsStore };
}
