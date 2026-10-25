const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { randomUUID } = require('node:crypto');

const sqs = new SQSClient({});
const ALLOWED_TYPES = new Set(['visit', 'click', 'lead', 'cart_add', 'purchase']);
const MAX_BODY_BYTES = 32 * 1024;

function response(statusCode, body, origin) {
  const origins = new Set((process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '*')
    .split(',').map((value) => value.trim()).filter(Boolean));
  const allowOrigin = origins.has('*') ? '*' : origins.has(origin) ? origin : 'null';
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Content-Type': 'application/json',
      'Vary': 'Origin',
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  if (typeof event.body !== 'string') throw new Error('Request body is required');
  const bytes = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
  if (bytes.length === 0 || bytes.length > MAX_BODY_BYTES) throw new Error('Request body must be between 1 and 32768 bytes');
  let payload;
  try {
    payload = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('Request body must be valid JSON');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Request body must be a JSON object');
  return payload;
}

function nonNegativeNumber(value, name) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || number > 100000000) throw new Error(`${name} is outside the accepted range`);
  return number;
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method === 'OPTIONS') return response(204, {}, origin);
  if (method && method !== 'POST') return response(405, { error: 'Method not allowed' }, origin);

  try {
    if (!process.env.TELEMETRY_QUEUE_URL) throw new Error('TELEMETRY_QUEUE_URL is not configured');
    const input = parseBody(event);
    const type = String(input.type || input.event_type || '').toLowerCase();
    if (!ALLOWED_TYPES.has(type)) return response(400, { error: 'Unsupported telemetry event type' }, origin);
    const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) return response(400, { error: 'timestamp must be a valid date' }, origin);
    const payload = {
      id: String(input.id || input.trace_id || randomUUID()).slice(0, 128),
      type,
      timestamp: timestamp.toISOString(),
      customer_name: typeof input.customer_name === 'string' ? input.customer_name.slice(0, 200) : undefined,
      customer_id: typeof input.customer_id === 'string' ? input.customer_id.slice(0, 128) : undefined,
      customer_email: typeof input.customer_email === 'string' ? input.customer_email.slice(0, 320) : undefined,
      product_id: typeof input.product_id === 'string' ? input.product_id.slice(0, 128) : undefined,
      product_name: typeof input.product_name === 'string' ? input.product_name.slice(0, 200) : undefined,
      campaign_id: typeof input.campaign_id === 'string' ? input.campaign_id.slice(0, 128) : undefined,
      campaign_name: typeof input.campaign_name === 'string' ? input.campaign_name.slice(0, 200) : undefined,
      channel_id: typeof input.channel_id === 'string' ? input.channel_id.slice(0, 128) : undefined,
      channel_name: typeof input.channel_name === 'string' ? input.channel_name.slice(0, 200) : undefined,
      revenue: nonNegativeNumber(input.revenue, 'revenue'),
      cost: nonNegativeNumber(input.cost, 'cost'),
      campaign_budget: nonNegativeNumber(input.campaign_budget ?? input.budget, 'campaign_budget'),
    };
    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.TELEMETRY_QUEUE_URL,
      MessageBody: JSON.stringify(payload),
    }));
    return response(202, { accepted: true, id: payload.id }, origin);
  } catch (error) {
    const clientError = /required|valid JSON|JSON object|bytes|range/.test(error.message);
    if (clientError) return response(400, { error: error.message }, origin);
    console.error('Telemetry enqueue failed', error.message);
    return response(503, { error: 'Telemetry service is temporarily unavailable' }, origin);
  }
};
