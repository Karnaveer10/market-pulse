const { readAnalyticsCache } = require('./redis-cache');

function response(statusCode, body, origin = '') {
  const origins = new Set((process.env.ALLOWED_ORIGINS || 'http://localhost:8080').split(',').map((value) => value.trim()));
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': origins.has(origin) ? origin : 'null',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
      'Vary': 'Origin',
    },
    body: statusCode === 204 ? '' : JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  if (event.httpMethod === 'OPTIONS') return response(204, {}, origin);
  if (event.httpMethod !== 'GET') return response(405, { error: 'Method not allowed' }, origin);
  if (!event.requestContext?.authorizer?.claims?.sub) return response(401, { error: 'Sign-in is required' }, origin);

  try {
    const campaignId = event.queryStringParameters?.campaignId || '';
    const channelId = event.queryStringParameters?.channelId || '';
    const result = await readAnalyticsCache({ campaignId, channelId });
    return response(200, {
      totals: result.totals,
      campaign: result.campaign,
      channel: result.channel,
      readLatencyMs: result.readLatencyMs,
    }, origin);
  } catch (error) {
    console.error('Redis analytics read failed', error.message);
    return response(503, { error: 'Analytics cache is temporarily unavailable' }, origin);
  }
};
