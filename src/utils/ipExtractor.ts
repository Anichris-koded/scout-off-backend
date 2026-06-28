import { Request } from 'express';

/**
 * Trusted proxy count. Set via TRUSTED_PROXY_COUNT env var (default: 1).
 * When behind a load balancer, the rightmost IP in X-Forwarded-For that
 * is NOT from a trusted proxy is the real client IP.
 */
const TRUSTED_PROXY_COUNT = parseInt(process.env.TRUSTED_PROXY_COUNT ?? '1', 10);

/**
 * Extract the real client IP from a request.
 * Respects X-Forwarded-For header and a trusted proxy count.
 */
export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      .split(',')
      .map((ip) => ip.trim());
    // The real client IP is at index: length - 1 - TRUSTED_PROXY_COUNT
    const idx = Math.max(0, ips.length - 1 - TRUSTED_PROXY_COUNT);
    if (ips[idx]) return ips[idx];
  }
  return req.socket.remoteAddress ?? 'unknown';
}
