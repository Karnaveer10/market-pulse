const { createClient } = require('redis');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secrets = new SecretsManagerClient({});
let clientPromise;

const UPDATE_EVENT_SCRIPT = `
  if redis.call('EXISTS', KEYS[1]) == 1 then
    local retryAlert = redis.call('GET', KEYS[5]) == ARGV[5] and 1 or 0
    return {0, redis.call('HGET', KEYS[2], 'spent') or '0', retryAlert}
  end
  local cost = tonumber(ARGV[1]) or 0
  local revenue = tonumber(ARGV[2]) or 0
  local budget = tonumber(ARGV[3]) or 0
  local priorSpent = tonumber(redis.call('HGET', KEYS[2], 'spent') or '0')
  if cost ~= 0 then redis.call('HINCRBYFLOAT', KEYS[2], 'spent', cost) end
  if revenue ~= 0 then redis.call('HINCRBYFLOAT', KEYS[2], 'revenue', revenue) end
  if ARGV[4] ~= '' then redis.call('HINCRBY', KEYS[3], ARGV[4], 1) end
  if revenue ~= 0 then redis.call('HINCRBYFLOAT', KEYS[3], 'revenue', revenue) end
  redis.call('HINCRBY', KEYS[4], 'interactions', 1)
  redis.call('HINCRBYFLOAT', KEYS[4], 'revenue', revenue)
  redis.call('SET', KEYS[1], '1', 'EX', 1296000)
  local currentSpent = priorSpent + cost
  local alert = 0
  if budget > 0 and priorSpent < (budget * 0.9) and currentSpent >= (budget * 0.9) then
    alert = redis.call('SET', KEYS[5], ARGV[5], 'NX', 'EX', 2592000) and 1 or 0
  end
  return {1, tostring(currentSpent), alert}
`;

async function getRedisClient() {
  if (!clientPromise) {
    let url = process.env.REDIS_URL;
    if (!url) {
      if (!process.env.REDIS_SECRET_ARN || !process.env.REDIS_ENDPOINT) {
        throw new Error('REDIS_URL or REDIS_SECRET_ARN and REDIS_ENDPOINT must be configured');
      }
      const response = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.REDIS_SECRET_ARN }));
      const value = response.SecretString || '';
      let password = value;
      try {
        password = JSON.parse(value).password || '';
      } catch {
        // Plain SecretString values remain supported for local configurations.
      }
      if (!password) throw new Error('Redis secret is missing its password');
      url = `rediss://:${encodeURIComponent(password)}@${process.env.REDIS_ENDPOINT}:${Number(process.env.REDIS_PORT || 6379)}`;
    }
    const client = createClient({
      url,
      socket: url.startsWith('rediss:') || process.env.REDIS_TLS === 'true'
        ? { tls: true, rejectUnauthorized: true }
        : undefined,
    });
    client.on('error', (error) => console.error('Redis connection error:', error.message));
    clientPromise = client.connect().then(() => client).catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }
  return clientPromise;
}

async function updateEventCache({ sourceId, campaignId, channelId, type, revenue, cost, budget = 0 }) {
  const redis = await getRedisClient();
  const keys = [
    `marketpulse:processed:${sourceId}`,
    `marketpulse:campaign:${campaignId}`,
    `marketpulse:channel:${channelId}`,
    'marketpulse:totals',
    `marketpulse:budget-alert:${campaignId}`,
  ];
  return redis.eval(UPDATE_EVENT_SCRIPT, {
    keys,
    arguments: [
      String(cost),
      String(revenue),
      String(budget),
      type === 'click' ? 'clicks' : type === 'purchase' ? 'purchases' : '',
      String(sourceId),
    ],
  });
}

async function readAnalyticsCache({ campaignId, channelId } = {}) {
  const redis = await getRedisClient();
  const startedAt = process.hrtime.bigint();
  const [totals, campaign, channel] = await Promise.all([
    redis.hGetAll('marketpulse:totals'),
    campaignId ? redis.hGetAll(`marketpulse:campaign:${campaignId}`) : Promise.resolve({}),
    channelId ? redis.hGetAll(`marketpulse:channel:${channelId}`) : Promise.resolve({}),
  ]);
  const readLatencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  return { totals, campaign, channel, readLatencyMs };
}

module.exports = { getRedisClient, updateEventCache, readAnalyticsCache };
