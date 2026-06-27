import { Request, Response, NextFunction } from 'express';

export interface RouteMetric {
  count: number;
  totalLatencyMs: number;
}

export type ErrorRange = '4xx' | '5xx';

/** In-memory metrics store. Replace with Prometheus or similar in production. */
export const metricsStore: Record<string, RouteMetric> = {};

/** Tracks http_errors_total counter, labelled by status code range (4xx / 5xx). */
export const errorCountsStore: Record<ErrorRange, number> = { '4xx': 0, '5xx': 0 };

/** Whether metrics collection is enabled. Controlled by METRICS_ENABLED env var. */
export function isMetricsEnabled(): boolean {
  return process.env.METRICS_ENABLED !== 'false';
}

/**
 * Express middleware that increments per-route request counts, accumulates latency,
 * and tracks http_errors_total for 4xx and 5xx responses.
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

    const status = res.statusCode;
    if (status >= 400 && status < 500) {
      errorCountsStore['4xx'] += 1;
    } else if (status >= 500) {
      errorCountsStore['5xx'] += 1;
    }
  });
  next();
}

/** Returns a snapshot of collected route metrics. */
export function getMetrics(): Record<string, RouteMetric> {
  return { ...metricsStore };
}

/** Returns a snapshot of http_errors_total counters. */
export function getErrorMetrics(): Record<ErrorRange, number> {
  return { ...errorCountsStore };
}
