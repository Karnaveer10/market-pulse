export interface TelemetryEvent {
  type: 'visit' | 'click' | 'lead' | 'cart_add' | 'purchase';
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  product_id?: string;
  product_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  channel_id?: string;
  channel_name?: string;
  revenue?: number;
  cost?: number; // e.g. CPC cost
  metadata?: Record<string, unknown>;
}

export interface XRaySegment {
  id: string;
  name: string;
  start_time: number;
  end_time: number;
  duration_ms: number;
  status: 'ok' | 'fault' | 'throttle';
  subsegments?: {
    name: string;
    duration_ms: number;
    details?: string;
  }[];
}

export interface XRayTrace {
  trace_id: string;
  event_type: string;
  timestamp: string;
  total_duration_ms: number;
  segments: XRaySegment[];
  payload: Record<string, unknown>;
}

// In-Memory simulated Redis & X-Ray trace buffer
const XRAY_TRACES: XRayTrace[] = [];
type TraceListener = (traces: XRayTrace[]) => void;
const traceListeners: Set<TraceListener> = new Set();

export function subscribeToTraces(listener: TraceListener) {
  traceListeners.add(listener);
  listener([...XRAY_TRACES]);
  return () => {
    traceListeners.delete(listener);
  };
}

export function getRecentTraces(): XRayTrace[] {
  return [...XRAY_TRACES];
}

/**
 * Simulates the AWS Cloud Pipeline with AWS X-Ray Distributed Tracing:
 * Browser Fetch (15ms)
 * -> Amazon API Gateway (4-12ms)
 * -> Amazon SQS FIFO Buffer (2-8ms)
 * -> AWS Lambda stream-processor (35-70ms)
 *    -> Amazon RDS PostgreSQL Insert
 *    -> Redis/ElastiCache In-Memory Counter Atomic Increment
 *    -> Amazon SNS Alert evaluation
 */
export async function dispatchTelemetryEvent(event: TelemetryEvent): Promise<{
  success: boolean;
  trace: XRayTrace;
}> {
  const startTime = Date.now();
  const traceId = `1-${Math.random().toString(16).substring(2, 10)}-${Math.random().toString(16).substring(2, 26)}`;

  // Segment 1: Client fetch
  const clientStart = 0;
  const clientDuration = Math.floor(Math.random() * 10) + 12; // 12-22ms

  // Segment 2: API Gateway
  const apigwStart = clientDuration;
  const apigwDuration = Math.floor(Math.random() * 6) + 4; // 4-10ms

  // Segment 3: SQS Queue
  const sqsStart = apigwStart + apigwDuration;
  const sqsDuration = Math.floor(Math.random() * 5) + 3; // 3-8ms

  // Segment 4: Lambda compute
  const lambdaStart = sqsStart + sqsDuration;
  const rdsQueryTime = Math.floor(Math.random() * 15) + 18; // 18-33ms
  const redisIncrTime = Math.floor(Math.random() * 2) + 1; // 1-3ms sub-ms in-memory cache!
  const snsEvalTime = event.type === 'purchase' ? 6 : 1;
  const lambdaDuration = rdsQueryTime + redisIncrTime + snsEvalTime + 10;

  const totalDuration = lambdaStart + lambdaDuration;

  const trace: XRayTrace = {
    trace_id: traceId,
    event_type: event.type.toUpperCase(),
    timestamp: new Date().toLocaleTimeString(),
    total_duration_ms: totalDuration,
    payload: {
      type: event.type,
      product: event.product_name,
      campaign: event.campaign_name,
      channel: event.channel_name,
      revenue: event.revenue || 0,
    },
    segments: [
      {
        id: `seg-client-${Math.random().toString(16).slice(2, 8)}`,
        name: 'Browser Client (HTTP Fetch)',
        start_time: clientStart,
        end_time: clientDuration,
        duration_ms: clientDuration,
        status: 'ok',
        subsegments: [
          { name: 'DNS & SSL Handshake', duration_ms: Math.floor(clientDuration * 0.4) },
          { name: 'Payload Serialization', duration_ms: Math.floor(clientDuration * 0.6) },
        ],
      },
      {
        id: `seg-apigw-${Math.random().toString(16).slice(2, 8)}`,
        name: 'Amazon API Gateway (REST)',
        start_time: apigwStart,
        end_time: apigwStart + apigwDuration,
        duration_ms: apigwDuration,
        status: 'ok',
        subsegments: [
          { name: 'Request Validation & Throttle Check', duration_ms: 2 },
          { name: 'SQS Direct Integration', duration_ms: apigwDuration - 2 },
        ],
      },
      {
        id: `seg-sqs-${Math.random().toString(16).slice(2, 8)}`,
        name: 'Amazon SQS (Buffer Queue)',
        start_time: sqsStart,
        end_time: sqsStart + sqsDuration,
        duration_ms: sqsDuration,
        status: 'ok',
        subsegments: [
          { name: 'Enqueue Deduplication & Retention', duration_ms: sqsDuration },
        ],
      },
      {
        id: `seg-lambda-${Math.random().toString(16).slice(2, 8)}`,
        name: 'AWS Lambda (stream-processor)',
        start_time: lambdaStart,
        end_time: totalDuration,
        duration_ms: lambdaDuration,
        status: 'ok',
        subsegments: [
          { name: 'Amazon RDS PostgreSQL: INSERT interaction', duration_ms: rdsQueryTime, details: 'ACID Relational write' },
          { name: 'Redis / ElastiCache: HINCRBY atomic counter', duration_ms: redisIncrTime, details: 'In-Memory sub-ms aggregation' },
          { name: 'Amazon SNS: Budget threshold check', duration_ms: snsEvalTime, details: event.revenue ? 'SNS Alert Evaluated' : 'Skipped' },
        ],
      },
    ],
  };

  XRAY_TRACES.unshift(trace);
  if (XRAY_TRACES.length > 50) XRAY_TRACES.pop();
  traceListeners.forEach((l) => l([...XRAY_TRACES]));

  return { success: true, trace };
}
