/**
 * OpenTelemetry distributed tracing setup (#344).
 *
 * Initialises the SDK with auto-instrumentation (covers HTTP calls to Soroban
 * RPC and Pinata/IPFS) and an OTLP/HTTP exporter when
 * OTEL_EXPORTER_OTLP_ENDPOINT is set.  When the env var is absent the SDK
 * runs with a NoopSpanExporter so there is zero overhead.
 *
 * Must be imported/called BEFORE any other module that makes HTTP requests.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NoopSpanExporter } from '@opentelemetry/sdk-trace-base';

let sdk: NodeSDK | null = null;

export function initTracing(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  const exporter = endpoint
    ? new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })
    : new NoopSpanExporter();

  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'scout-off-backend',
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // disable noisy FS instrumentation
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
}

export async function shutdownTracing(): Promise<void> {
  if (sdk) await sdk.shutdown();
}
