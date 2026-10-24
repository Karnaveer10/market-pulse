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

const STORAGE_KEY = 'marketpulse_xray_traces_v1';

// Seed default traces so the X-Ray modal is NEVER blank on initial load
const DEFAULT_TRACES: XRayTrace[] = [
  {
    trace_id: '1-6adcc08d-a31924f641e16e2d54afdb3a',
    event_type: 'PURCHASE',
    timestamp: 'Just now',
    total_duration_ms: 68,
    payload: {
      type: 'purchase',
      product: 'Noise ColorFit Ultra 3 Smartwatch',
      campaign: 'Diwali Mega Sale 2026',
      channel: 'Instagram Sponsored',
      revenue: 4499,
      customer: 'Aarav Sharma',
    },
    segments: [
      {
        id: 'seg-client-01',
        name: 'Browser Client (HTTP Fetch)',
        start_time: 0,
        end_time: 14,
        duration_ms: 14,
        status: 'ok',
        subsegments: [
          { name: 'DNS & SSL Handshake', duration_ms: 5 },
          { name: 'Payload Serialization', duration_ms: 9 },
        ],
      },
      {
        id: 'seg-apigw-01',
        name: 'Amazon API Gateway (REST)',
        start_time: 14,
        end_time: 21,
        duration_ms: 7,
        status: 'ok',
        subsegments: [
          { name: 'Request Validation & Throttle Check', duration_ms: 2 },
          { name: 'SQS Direct Integration', duration_ms: 5 },
        ],
      },
      {
        id: 'seg-sqs-01',
        name: 'Amazon SQS (marketpulse-telemetry-queue)',
        start_time: 21,
        end_time: 26,
        duration_ms: 5,
        status: 'ok',
        subsegments: [
          { name: 'Enqueue Deduplication & Retention', duration_ms: 5 },
        ],
      },
      {
        id: 'seg-lambda-01',
        name: 'AWS Lambda (marketpulse-stream-processor)',
        start_time: 26,
        end_time: 68,
        duration_ms: 42,
        status: 'ok',
        subsegments: [
          { name: 'Amazon RDS PostgreSQL: INSERT interaction', duration_ms: 24, details: 'ACID Relational write' },
          { name: 'Redis / ElastiCache: HINCRBY atomic counter', duration_ms: 1, details: 'In-Memory sub-ms aggregation' },
          { name: 'Amazon SNS: Budget threshold check', duration_ms: 7, details: 'SNS Alert Evaluated' },
        ],
      },
    ],
  },
  {
    trace_id: '1-6adcc073-7d04df95230713a375467c4c',
    event_type: 'CART_ADD',
    timestamp: '2 min ago',
    total_duration_ms: 48,
    payload: {
      type: 'cart_add',
      product: 'boAt Airdopes 141 ANC',
      campaign: 'Republic Day Tech Fest',
      channel: 'Google Search Ads',
      revenue: 1699,
      customer: 'Ananya Deshmukh',
    },
    segments: [
      {
        id: 'seg-client-02',
        name: 'Browser Client (HTTP Fetch)',
        start_time: 0,
        end_time: 12,
        duration_ms: 12,
        status: 'ok',
        subsegments: [{ name: 'Payload Serialization', duration_ms: 12 }],
      },
      {
        id: 'seg-apigw-02',
        name: 'Amazon API Gateway (REST)',
        start_time: 12,
        end_time: 18,
        duration_ms: 6,
        status: 'ok',
      },
      {
        id: 'seg-sqs-02',
        name: 'Amazon SQS (marketpulse-telemetry-queue)',
        start_time: 18,
        end_time: 22,
        duration_ms: 4,
        status: 'ok',
      },
      {
        id: 'seg-lambda-02',
        name: 'AWS Lambda (marketpulse-stream-processor)',
        start_time: 22,
        end_time: 48,
        duration_ms: 26,
        status: 'ok',
        subsegments: [
          { name: 'Amazon RDS PostgreSQL: INSERT event', duration_ms: 22, details: 'Cart status write' },
          { name: 'Redis / ElastiCache: INCR funnel:cart', duration_ms: 1, details: 'Counter bump' },
        ],
      },
    ],
  },
  {
    trace_id: '1-6adcc04d-228a2368dc299afac64cfdcf',
    event_type: 'LEAD',
    timestamp: '5 min ago',
    total_duration_ms: 41,
    payload: {
      type: 'lead',
      customer: 'Rohan Mehta',
      campaign: 'Spring Launch 2026',
      channel: 'Facebook Feed Ads',
    },
    segments: [
      {
        id: 'seg-client-03',
        name: 'Browser Client (HTTP Fetch)',
        start_time: 0,
        end_time: 10,
        duration_ms: 10,
        status: 'ok',
      },
      {
        id: 'seg-apigw-03',
        name: 'Amazon API Gateway (REST)',
        start_time: 10,
        end_time: 16,
        duration_ms: 6,
        status: 'ok',
      },
      {
        id: 'seg-sqs-03',
        name: 'Amazon SQS (marketpulse-telemetry-queue)',
        start_time: 16,
        end_time: 19,
        duration_ms: 3,
        status: 'ok',
      },
      {
        id: 'seg-lambda-03',
        name: 'AWS Lambda (marketpulse-stream-processor)',
        start_time: 19,
        end_time: 41,
        duration_ms: 22,
        status: 'ok',
        subsegments: [
          { name: 'Amazon RDS PostgreSQL: INSERT customer', duration_ms: 19, details: 'Lead record creation' },
          { name: 'Redis / ElastiCache: SADD leads:today', duration_ms: 1, details: 'Set add' },
        ],
      },
    ],
  },
];

function loadStoredTraces(): XRayTrace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse stored X-Ray traces:', e);
  }
  return [...DEFAULT_TRACES];
}

const XRAY_TRACES: XRayTrace[] = loadStoredTraces();
type TraceListener = (traces: XRayTrace[]) => void;
const traceListeners: Set<TraceListener> = new Set();

function persistTraces() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(XRAY_TRACES));
  } catch (e) {
    console.error('Failed to save traces to localStorage:', e);
  }
}

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
  const traceId = `1-${Math.random().toString(16).substring(2, 10)}-${Math.random().toString(16).substring(2, 26)}`;

  // Segment 1: Client fetch
  const clientStart = 0;
  const clientDuration = Math.floor(Math.random() * 8) + 10; // 10-18ms

  // Segment 2: API Gateway
  const apigwStart = clientDuration;
  const apigwDuration = Math.floor(Math.random() * 5) + 4; // 4-9ms

  // Segment 3: SQS Queue
  const sqsStart = apigwStart + apigwDuration;
  const sqsDuration = Math.floor(Math.random() * 4) + 3; // 3-7ms

  // Segment 4: Lambda compute
  const lambdaStart = sqsStart + sqsDuration;
  const rdsQueryTime = Math.floor(Math.random() * 12) + 16; // 16-28ms
  const redisIncrTime = Math.floor(Math.random() * 2) + 1; // 1-2ms sub-ms in-memory cache
  const snsEvalTime = event.type === 'purchase' ? 6 : 1;
  const lambdaDuration = rdsQueryTime + redisIncrTime + snsEvalTime + 6;

  const totalDuration = lambdaStart + lambdaDuration;

  const trace: XRayTrace = {
    trace_id: traceId,
    event_type: event.type.toUpperCase(),
    timestamp: new Date().toLocaleTimeString(),
    total_duration_ms: totalDuration,
    payload: {
      type: event.type,
      product: event.product_name || 'MarketPulse Telemetry Ping',
      campaign: event.campaign_name || 'Spring Launch 2026',
      channel: event.channel_name || 'Instagram Ads',
      revenue: event.revenue || 0,
      customer: event.customer_name || 'Aarav Sharma',
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
        name: 'Amazon SQS (marketpulse-telemetry-queue)',
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
        name: 'AWS Lambda (marketpulse-stream-processor)',
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
  persistTraces();
  traceListeners.forEach((l) => l([...XRAY_TRACES]));

  // Optional Fire-and-forget to live AWS API Gateway endpoint
  try {
    fetch('https://awhhbnom53.execute-api.ap-south-1.amazonaws.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trace_id: traceId,
        event_type: event.type,
        revenue: event.revenue || 0,
        customer_name: event.customer_name || 'Aarav Sharma',
        timestamp: new Date().toISOString(),
      }),
      mode: 'no-cors',
    }).catch(() => {
      // Offline/CORS safe fallback
    });
  } catch {
    // Silent safe fallback
  }

  return { success: true, trace };
}
